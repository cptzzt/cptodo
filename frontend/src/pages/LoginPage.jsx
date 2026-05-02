import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Card, Form, Input, Button, Typography, App } from 'antd';
import { UserOutlined, LockOutlined } from '@ant-design/icons';
import { api, Storage } from '../api';

const { Title, Text } = Typography;

export default function LoginPage() {
  const navigate = useNavigate();
  const { message } = App.useApp();
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (Storage.getToken()) {
      navigate('/', { replace: true });
    }
  }, [navigate]);

  async function handleSubmit(values) {
    setSubmitting(true);
    try {
      const res = await api.login(values.username, values.password);
      Storage.setToken(res.data.token);
      Storage.setUser(res.data.user);
      navigate('/', { replace: true });
    } catch (err) {
      message.error(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  const isMobile = window.innerWidth < 768;

  return (
    <div style={{
      minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'var(--bg-sidebar)', padding: isMobile ? '16px' : '0',
    }}>
      <Card
        style={{
          width: isMobile ? '100%' : 420,
          maxWidth: 420,
          borderRadius: 16,
          background: 'var(--bg-card)',
          boxShadow: '0 25px 60px rgba(0,0,0,0.1)',
        }}
        variant="borderless"
      >
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ fontSize: 32, fontWeight: 800, color: 'var(--accent)', marginBottom: 4 }}>CPTodo</div>
          <Text type="secondary" style={{ fontSize: 14 }}>登录以继续使用</Text>
        </div>
        <Form layout="vertical" onFinish={handleSubmit} autoComplete="off" size="large">
          <Form.Item name="username" rules={[
            { required: true, message: '请输入用户名或邮箱' },
          ]}>
            <Input prefix={<UserOutlined />} placeholder="用户名 / 邮箱" />
          </Form.Item>
          <Form.Item name="password" rules={[
            { required: true, message: '请输入密码' },
            { min: 6, message: '密码长度不能少于 6 位' },
          ]}>
            <Input.Password prefix={<LockOutlined />} placeholder="密码" />
          </Form.Item>
          <Form.Item style={{ marginBottom: 16 }}>
            <Button type="primary" htmlType="submit" block loading={submitting}>
              登录
            </Button>
          </Form.Item>
        </Form>
        <div style={{ textAlign: 'center' }}>
          <Text type="secondary">还没有账号？<Link to="/register" style={{ color: 'var(--accent)' }}>去注册</Link></Text>
        </div>
      </Card>
    </div>
  );
}
