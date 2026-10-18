import { useEffect, useState } from 'react';

export type AppTheme = 'light' | 'dark';

function readTheme(): AppTheme {
  try { return localStorage.getItem('ae_theme') === 'dark' ? 'dark' : 'light'; }
  catch { return 'light'; }
}

export function useAppTheme() {
  const [theme, setTheme] = useState<AppTheme>(readTheme);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
    try { localStorage.setItem('ae_theme', theme); } catch { /* Theme remains active for this session. */ }
  }, [theme]);

  useEffect(() => {
    const syncTheme = () => setTheme(readTheme());
    window.addEventListener('ae-theme-change', syncTheme);
    return () => window.removeEventListener('ae-theme-change', syncTheme);
  }, []);

  const toggleTheme = () => {
    const nextTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(nextTheme);
    document.documentElement.dataset.theme = nextTheme;
    document.documentElement.style.colorScheme = nextTheme;
    try { localStorage.setItem('ae_theme', nextTheme); } catch { /* Theme remains active for this session. */ }
    window.dispatchEvent(new Event('ae-theme-change'));
  };
  return { theme, toggleTheme };
}
