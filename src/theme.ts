import { useEffect, useState } from 'react';
export type Theme = 'light' | 'dark';
const key = 'lf.theme';
export function readTheme(): Theme {
  try { return localStorage.getItem(key) === 'dark' ? 'dark' : 'light'; }
  catch { return 'light'; }
}
export function useTheme() {
  const [theme, setTheme] = useState<Theme>(readTheme);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try { localStorage.setItem(key, theme); } catch { /* Sin almacenamiento. */ }
  }, [theme]);
  useEffect(() => {
    const sync = (event: StorageEvent) => { if (event.key === key) setTheme(readTheme()); };
    addEventListener('storage', sync); return () => removeEventListener('storage', sync);
  }, []);
  return { theme, setTheme };
}
