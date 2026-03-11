import type { Theme } from './types';

type ThemeToggleProps = {
  theme: Theme;
  onToggle: () => void;
};

function ThemeToggle({ theme, onToggle }: ThemeToggleProps) {
  const isDark = theme === 'dark';
  const tooltipText = isDark
    ? 'Theme: dark mode active. Click to switch to light mode.'
    : 'Theme: light mode active. Click to switch to dark mode.';

  return (
    <button
      type="button"
      onClick={onToggle}
      className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-slate-300 bg-white text-xl text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
      aria-label={tooltipText}
      title={tooltipText}
    >
      <span aria-hidden="true">{isDark ? '☀️' : '🌙'}</span>
    </button>
  );
}

export default ThemeToggle;
