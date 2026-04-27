import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import themes, { themeKeys } from './themes';

const ThemeContext = createContext();

const STORAGE_KEY = 'cptodo-theme';

export function ThemeProvider({ children }) {
  const [themeKey, setThemeKey] = useState(() => {
    return localStorage.getItem(STORAGE_KEY) || 'forest-sage';
  });

  const theme = themes[themeKey] || themes['forest-sage'];

  const switchTheme = useCallback((key) => {
    if (themes[key]) {
      setThemeKey(key);
      localStorage.setItem(STORAGE_KEY, key);
    }
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    const c = theme.colors;
    root.style.setProperty('--bg-primary', c.bgPrimary);
    root.style.setProperty('--bg-sidebar', c.bgSidebar);
    root.style.setProperty('--bg-card', c.bgCard);
    root.style.setProperty('--bg-card-hover', c.bgCardHover);
    root.style.setProperty('--accent', c.accent);
    root.style.setProperty('--accent-hover', c.accentHover);
    root.style.setProperty('--accent-light', c.accentLight);
    root.style.setProperty('--fg-primary', c.fgPrimary);
    root.style.setProperty('--fg-secondary', c.fgSecondary);
    root.style.setProperty('--fg-muted', c.fgMuted);
    root.style.setProperty('--border', c.border);
    root.style.setProperty('--border-medium', c.borderMedium);
    root.style.setProperty('--overdue', c.overdue);
    root.style.setProperty('--important', c.important);
    root.style.setProperty('--complete', c.complete);
  }, [theme]);

  return (
    <ThemeContext.Provider value={{ themeKey, theme, switchTheme, themes, themeKeys }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
