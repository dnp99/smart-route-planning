import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

const targetPaths = process.argv.slice(2);

if (targetPaths.length === 0) {
  console.error('Usage: node scripts/check-es-compat.mjs <path...>');
  process.exit(1);
}

const sourceFilePattern = /\.(ts|tsx|js|jsx)$/;
const restrictedPatterns = [
  { label: 'String.trimEnd', regex: /\.trimEnd\s*\(/g },
  { label: 'String.trimStart', regex: /\.trimStart\s*\(/g },
  { label: 'Array/String.includes', regex: /\.includes\s*\(/g },
  { label: 'Number.isFinite', regex: /Number\.isFinite\s*\(/g },
  { label: 'Number.isNaN', regex: /Number\.isNaN\s*\(/g },
];

const walkFiles = async (entryPath) => {
  const stats = await readdir(entryPath, { withFileTypes: true });
  const nested = await Promise.all(
    stats.map(async (entry) => {
      const absolute = path.join(entryPath, entry.name);

      if (entry.isDirectory()) {
        return walkFiles(absolute);
      }

      if (sourceFilePattern.test(entry.name)) {
        return [absolute];
      }

      return [];
    }),
  );

  return nested.flat();
};

const findViolations = async (filePath) => {
  const contents = await readFile(filePath, 'utf8');
  const lines = contents.split(/\r?\n/);
  const violations = [];

  lines.forEach((line, index) => {
    restrictedPatterns.forEach(({ label, regex }) => {
      regex.lastIndex = 0;
      if (regex.test(line)) {
        violations.push({ filePath, lineNumber: index + 1, label, line: line.trim() });
      }
    });
  });

  return violations;
};

const run = async () => {
  const allFiles = (
    await Promise.all(targetPaths.map((targetPath) => walkFiles(path.resolve(process.cwd(), targetPath))))
  ).flat();

  const violations = (await Promise.all(allFiles.map((filePath) => findViolations(filePath)))).flat();

  if (violations.length === 0) {
    process.exit(0);
  }

  console.error('ES compatibility check failed. Avoid methods requiring newer libs:');
  violations.forEach((violation) => {
    console.error(
      `- ${violation.filePath}:${violation.lineNumber} [${violation.label}] ${violation.line}`,
    );
  });
  process.exit(1);
};

run().catch((error) => {
  console.error('Failed to run ES compatibility check:', error);
  process.exit(1);
});
