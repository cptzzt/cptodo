const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const { register, login, sendEmailCode, emailAuth, updateUsername, updateSettings, getThemePreference, updateThemePreference } = require('../controllers/userController');

// 用户注册（无需登录）
router.post('/register', register);

// 用户登录（无需登录）
router.post('/login', login);

// 发送邮箱验证码（无需登录）
router.post('/send-email-code', sendEmailCode);

// 邮箱验证码登录/注册（无需登录）
router.post('/email-auth', emailAuth);

// 修改用户名（需登录）
router.patch('/username', authenticateToken, updateUsername);

// 获取用户主题偏好（需登录）
router.get('/theme', authenticateToken, getThemePreference);

// 更新用户主题偏好（需登录）
router.patch('/theme', authenticateToken, updateThemePreference);

// 更新用户设置（需登录）
router.patch('/settings', authenticateToken, updateSettings);

module.exports = router;
