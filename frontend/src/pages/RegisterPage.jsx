import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { api, Storage } from '../api';
import '../styles/auth.css';

export default function RegisterPage() {
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (Storage.getToken()) {
    navigate('/', { replace: true });
    return null;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const trimmedUsername = username.trim();

    if (!trimmedUsername || !password || !confirmPassword) {
      setError('请填写所有字段');
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
    if (password !== confirmPassword) {
      setError('两次密码输入不一致');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      await api.register(trimmedUsername, password);
      // 注册成功，自动登录
      const loginRes = await api.login(trimmedUsername, password);
      Storage.setToken(loginRes.data.token);
      Storage.setUser(loginRes.data.user);
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
        <h1 className="auth-title">创建账号</h1>
        <p className="auth-subtitle">注册一个新的 Todo 账号</p>
        <form className="auth-form" onSubmit={handleSubmit}>
          <div className="form-group">
            <label>用户名</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              maxLength={50}
              placeholder="输入用户名"
            />
          </div>
          <div className="form-group">
            <label>密码</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="输入密码（至少 6 位）"
            />
          </div>
          <div className="form-group">
            <label>确认密码</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="再次输入密码"
            />
          </div>
          <button type="submit" className="btn btn-primary btn-full" disabled={submitting}>
            {submitting ? '注册中...' : '注册'}
          </button>
          {error && <div className="auth-error">{error}</div>}
        </form>
        <p className="auth-switch">
          已有账号？<Link to="/login">去登录</Link>
        </p>
      </div>
    </div>
  );
}
