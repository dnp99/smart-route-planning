import { defineConfig } from "vitest/config";

export default defineConfig({
  esbuild: {
    jsx: "automatic",
  },
  test: {
    environment: "jsdom",
    coverage: {
      provider: "v8",
      reporter: ["text", "json-summary"],
      include: [
        "src/components/apiBaseUrl.ts",
        "src/features/route-planner/api/routePlannerService.ts",
        "src/features/route-planner/domain/routePlannerHelpers.ts",
        "src/features/route-planner/state/routePlannerDraft.ts",
        "src/features/route-planner/utils/routeImageExport.ts",
        "src/features/route-planner/utils/routePlannerResultUtils.ts",
        "src/features/route-planner/utils/routePlannerTelemetry.ts",
        "src/features/route-planner/utils/routePlannerUtils.ts",
      ],
      exclude: [
        "src/**/*.test.ts",
        "src/**/*.test.tsx",
        "src/features/route-planner/domain/routePlannerTypes.ts",
      ],
      thresholds: {
        statements: 80,
        branches: 80,
        functions: 80,
        lines: 80,
      },
    },
  },
});
