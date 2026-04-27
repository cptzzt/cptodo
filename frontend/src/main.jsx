import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ConfigProvider, App as AntApp } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import { ThemeProvider, useTheme } from './ThemeContext';
import { Storage } from './api';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import App from './App';
import './styles/global.css';

function ProtectedRoute({ children }) {
  if (!Storage.getToken()) {
    return <Navigate to="/login" replace />;
  }
  return children;
}

function ThemedConfigProvider({ children }) {
  const { theme } = useTheme();
  return (
    <ConfigProvider
      locale={zhCN}
      theme={{
        token: {
          colorPrimary: theme.antd.colorPrimary,
          borderRadius: 10,
          fontFamily: "'Inter', 'SF Pro Display', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
          colorBgContainer: theme.antd.colorBgContainer,
          colorBgLayout: theme.antd.colorBgLayout,
          colorBorder: theme.antd.colorBorder,
          colorBorderSecondary: theme.antd.colorBorderSecondary,
          colorText: theme.antd.colorText,
          colorTextSecondary: theme.antd.colorTextSecondary,
          colorTextTertiary: theme.antd.colorTextTertiary,
          fontSize: 14,
        },
        components: {
          Button: { borderRadius: 8, controlHeight: 36 },
          Input: { borderRadius: 8 },
          Select: { borderRadius: 8 },
          Card: { borderRadius: 12 },
          Modal: { borderRadius: 12 },
          Drawer: { borderRadius: 0 },
          Tag: { borderRadius: 6 },
          Badge: { dotSize: 8 },
        },
      }}
    >
      <AntApp>
        {children}
      </AntApp>
    </ConfigProvider>
  );
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ThemeProvider>
      <ThemedConfigProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/" element={
              <ProtectedRoute>
                <App />
              </ProtectedRoute>
            } />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </ThemedConfigProvider>
    </ThemeProvider>
  </StrictMode>,
);
