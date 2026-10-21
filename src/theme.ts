import { useEffect, useState } from 'react';
export type Theme = 'system' | 'light' | 'dark';
const key = 'lf.theme';
export function readTheme(): Theme {
  try { const value = localStorage.getItem(key); return value === 'light' || value === 'dark' ? value : 'system'; }
  catch { return 'system'; }
}
export function useTheme() {
  const [theme, setTheme] = useState<Theme>(readTheme);
  useEffect(() => {
    const media = matchMedia('(prefers-color-scheme: dark)');
    const apply = () => { document.documentElement.dataset.theme = theme === 'system' ? media.matches ? 'dark' : 'light' : theme; };
    apply();
    try { localStorage.setItem(key, theme); } catch { /* Sin almacenamiento. */ }
    media.addEventListener('change', apply);
    return () => media.removeEventListener('change', apply);
  }, [theme]);
  useEffect(() => {
    const sync = (event: StorageEvent) => { if (event.key === key) setTheme(readTheme()); };
    addEventListener('storage', sync); return () => removeEventListener('storage', sync);
  }, []);
  return { theme, setTheme };
}
