import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Card, Form, Input, Button, Typography, App } from 'antd';
import { MailOutlined, LockOutlined } from '@ant-design/icons';
import { api, Storage } from '../api';

const { Title, Text } = Typography;

export default function RegisterPage() {
  const navigate = useNavigate();
  const { message } = App.useApp();
  const [submitting, setSubmitting] = useState(false);
  const [form] = Form.useForm();
  const [countdown, setCountdown] = useState(0);

  useEffect(() => {
    if (Storage.getToken()) {
      navigate('/', { replace: true });
    }
  }, [navigate]);

  // 倒计时
  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  // 发送验证码
  async function handleSendCode() {
    const email = form.getFieldValue('email');
    if (!email) {
      message.warning('请输入邮箱');
      return;
    }
    try {
      await api.sendEmailCode(email, 'register');
      message.success('验证码已发送，请查收邮件');
      setCountdown(60);
    } catch (err) {
      message.error(err.message);
    }
  }

  // 邮箱注册
  async function handleRegister(values) {
    setSubmitting(true);
    try {
      const res = await api.emailAuth(values.email, values.code, 'register', '', values.password);
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
          <Text type="secondary" style={{ fontSize: 14 }}>注册一个新的账号</Text>
        </div>

        <Form form={form} layout="vertical" onFinish={handleRegister} autoComplete="off" size="large">
          <Form.Item name="email" rules={[
            { required: true, message: '请输入邮箱' },
            { type: 'email', message: '邮箱格式不正确' },
          ]}>
            <Input prefix={<MailOutlined />} placeholder="邮箱地址" />
          </Form.Item>

          <Form.Item name="code" rules={[
            { required: true, message: '请输入验证码' },
            { len: 6, message: '验证码为6位数字' },
          ]}>
            <Input
              placeholder="验证码"
              maxLength={6}
              suffix={
                <Button
                  type="link"
                  size="small"
                  disabled={countdown > 0}
                  onClick={handleSendCode}
                  style={{ padding: 0, color: 'var(--accent)' }}
                >
                  {countdown > 0 ? `${countdown}秒后重试` : '发送验证码'}
                </Button>
              }
            />
          </Form.Item>

          <Form.Item name="password" rules={[
            { required: true, message: '请设置密码' },
            { min: 6, message: '密码长度不能少于 6 位' },
          ]}>
            <Input.Password prefix={<LockOutlined />} placeholder="设置密码（至少 6 位）" />
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
          <Text type="secondary">已有账号？<Link to="/login" style={{ color: 'var(--accent)' }}>去登录</Link></Text>
        </div>
      </Card>
    </div>
  );
}
