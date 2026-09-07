'use client';

import { useTheme } from '@/lib/theme';

// Sits next to the language switch in the navbar and works the same way: one
// tap flips a two-way choice, remembered for next time.
export default function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const dark = theme === 'dark';
  return (
    <button
      onClick={() => setTheme(dark ? 'light' : 'dark')}
      className="text-sm font-semibold px-2.5 sm:px-3 py-1.5 rounded-lg whitespace-nowrap"
      style={{ background: 'var(--border)', color: 'var(--text-heading)' }}
      title="Toggle dark mode"
      aria-label="Toggle dark mode"
    >
      {dark ? '☀️' : '🌙'}
    </button>
  );
}
