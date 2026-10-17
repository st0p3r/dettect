import { useCallback, useEffect, useState } from 'react';

export function useTheme() {
  const [dark, setDark] = useState(() => document.documentElement.classList.contains('dark'));
  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
  }, [dark]);
  const toggle = useCallback(() => {
    setDark((d) => {
      try {
        localStorage.setItem('theme', d ? 'light' : 'dark');
      } catch {
        /* ignore */
      }
      return !d;
    });
  }, []);
  return { dark, toggle };
}
