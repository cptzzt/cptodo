import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import themes, { themeKeys } from './themes';
import { api, Storage } from './api';

const ThemeContext = createContext();

const STORAGE_KEY = 'cptodo-theme';

// 立即应用 CSS 变量（不等后端），确保登录页也有样式
function applyCSSVariables(colors) {
  const root = document.documentElement;
  root.style.setProperty('--bg-primary', colors.bgPrimary);
  root.style.setProperty('--bg-sidebar', colors.bgSidebar);
  root.style.setProperty('--bg-card', colors.bgCard);
  root.style.setProperty('--bg-card-hover', colors.bgCardHover);
  root.style.setProperty('--accent', colors.accent);
  root.style.setProperty('--accent-hover', colors.accentHover);
  root.style.setProperty('--accent-light', colors.accentLight);
  root.style.setProperty('--fg-primary', colors.fgPrimary);
  root.style.setProperty('--fg-secondary', colors.fgSecondary);
  root.style.setProperty('--fg-muted', colors.fgMuted);
  root.style.setProperty('--border', colors.border);
  root.style.setProperty('--border-medium', colors.borderMedium);
  root.style.setProperty('--overdue', colors.overdue);
  root.style.setProperty('--important', colors.important);
  root.style.setProperty('--complete', colors.complete);

  // 触发主题变化事件，让 favicon 知道更新
  window.dispatchEvent(new Event('themeChanged'));
}

export function ThemeProvider({ children }) {
  const [themeKey, setThemeKey] = useState(() => {
    return localStorage.getItem(STORAGE_KEY) || 'forest-sage';
  });
  const [lastToken, setLastToken] = useState(Storage.getToken());

  const theme = themes[themeKey] || themes['forest-sage'];

  // 立即应用 CSS 变量（登录页也能看到样式）
  useEffect(() => {
    applyCSSVariables(theme.colors);
  }, [theme]);

  // 从后端获取主题偏好
  const fetchThemePreference = useCallback(async () => {
    const token = Storage.getToken();
    if (!token) return;

    try {
      const res = await api.getThemePreference();
      if (res.success && res.data?.themePreference) {
        const serverTheme = res.data.themePreference;
        setThemeKey(serverTheme);
        localStorage.setItem(STORAGE_KEY, serverTheme);
      }
    } catch (error) {
      console.error('[Theme] 获取主题偏好失败，使用本地缓存:', error);
    }
  }, []);

  // 组件挂载时尝试获取一次
  useEffect(() => {
    fetchThemePreference();
  }, [fetchThemePreference]);

  // 监听 token 变化（登录/退出时刷新）
  useEffect(() => {
    const checkTokenChange = () => {
      const currentToken = Storage.getToken();
      if (currentToken !== lastToken) {
        setLastToken(currentToken);
        if (currentToken) {
          fetchThemePreference();
        }
      }
    };
    const interval = setInterval(checkTokenChange, 500);
    return () => clearInterval(interval);
  }, [lastToken, fetchThemePreference]);

  const switchTheme = useCallback(async (key) => {
    if (!themes[key]) return;

    setThemeKey(key);
    localStorage.setItem(STORAGE_KEY, key);

    const token = Storage.getToken();
    if (token) {
      try {
        await api.updateThemePreference(key);
      } catch (error) {
        console.error('[Theme] 保存主题偏好失败:', error);
      }
    }
  }, []);

  return (
    <ThemeContext.Provider value={{ themeKey, theme, switchTheme, themes, themeKeys }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
