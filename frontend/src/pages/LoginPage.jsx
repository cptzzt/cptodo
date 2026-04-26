import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { api, Storage } from '../api';
import '../styles/auth.css';

export default function LoginPage() {
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // 已登录则跳转
  if (Storage.getToken()) {
    navigate('/', { replace: true });
    return null;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const trimmedUsername = username.trim();

    if (!trimmedUsername || !password) {
      setError('请填写用户名和密码');
      return;
    }
    if (trimmedUsername.length < 3 || trimmedUsername.length > 50) {
      setError('用户名长度需在 3-50 个字符之间');
      return;
    }
    if (password.length < 6) {
      setError('密码长度不能少于 6 位');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      const res = await api.login(trimmedUsername, password);
      Storage.setToken(res.data.token);
      Storage.setUser(res.data.user);
      navigate('/', { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <h1 className="auth-title">欢迎回来</h1>
        <p className="auth-subtitle">登录以继续使用 Todo</p>
        <form className="auth-form" onSubmit={handleSubmit}>
          <div className="form-group">
            <label>用户名</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              maxLength={50}
              autoComplete="username"
              placeholder="输入用户名"
            />
          </div>
          <div className="form-group">
            <label>密码</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              placeholder="输入密码"
            />
          </div>
          <button type="submit" className="btn btn-primary btn-full" disabled={submitting}>
            {submitting ? '登录中...' : '登录'}
          </button>
          {error && <div className="auth-error">{error}</div>}
        </form>
        <p className="auth-switch">
          还没有账号？<Link to="/register">去注册</Link>
        </p>
      </div>
    </div>
  );
}
