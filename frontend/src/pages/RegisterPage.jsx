import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Card, Form, Input, Button, Typography, App } from 'antd';
import { UserOutlined, LockOutlined } from '@ant-design/icons';
import { api, Storage } from '../api';

const { Title, Text } = Typography;

export default function RegisterPage() {
  const navigate = useNavigate();
  const { message } = App.useApp();
  const [submitting, setSubmitting] = useState(false);

  if (Storage.getToken()) {
    navigate('/', { replace: true });
    return null;
  }

  async function handleSubmit(values) {
    setSubmitting(true);
    try {
      await api.register(values.username, values.password);
      const loginRes = await api.login(values.username, values.password);
      Storage.setToken(loginRes.data.token);
      Storage.setUser(loginRes.data.user);
      navigate('/', { replace: true });
    } catch (err) {
      message.error(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'var(--bg-sidebar)',
    }}>
      <Card style={{
        width: 420, borderRadius: 16, border: 'none',
        background: 'var(--bg-card)',
        boxShadow: '0 25px 60px rgba(0,0,0,0.1)',
      }} bordered={false}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ fontSize: 32, fontWeight: 800, color: 'var(--accent)', marginBottom: 4 }}>CPTodo</div>
          <Text type="secondary" style={{ fontSize: 14 }}>注册一个新的账号</Text>
        </div>
        <Form layout="vertical" onFinish={handleSubmit} autoComplete="off" size="large">
          <Form.Item name="username" rules={[
            { required: true, message: '请输入用户名' },
            { min: 3, max: 50, message: '用户名长度需在 3-50 个字符之间' },
          ]}>
            <Input prefix={<UserOutlined />} placeholder="用户名" maxLength={50} />
          </Form.Item>
          <Form.Item name="password" rules={[
            { required: true, message: '请输入密码' },
            { min: 6, message: '密码长度不能少于 6 位' },
          ]}>
            <Input.Password prefix={<LockOutlined />} placeholder="密码（至少 6 位）" />
          </Form.Item>
          <Form.Item name="confirmPassword" dependencies={['password']} rules={[
            { required: true, message: '请确认密码' },
            ({ getFieldValue }) => ({
              validator(_, value) {
                if (!value || getFieldValue('password') === value) return Promise.resolve();
                return Promise.reject(new Error('两次密码输入不一致'));
              },
            }),
          ]}>
            <Input.Password prefix={<LockOutlined />} placeholder="确认密码" />
          </Form.Item>
          <Form.Item style={{ marginBottom: 16 }}>
            <Button type="primary" htmlType="submit" block loading={submitting}>
              注册
            </Button>
          </Form.Item>
        </Form>
        <div style={{ textAlign: 'center' }}>
          <Text type="secondary">已有账号？<Link to="/login">去登录</Link></Text>
        </div>
      </Card>
    </div>
  );
}
