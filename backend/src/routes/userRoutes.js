const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const { register, login, updateSettings } = require('../controllers/userController');

// 用户注册（无需登录）
router.post('/register', register);

// 用户登录（无需登录）
router.post('/login', login);

// 更新用户设置（需登录）
router.patch('/settings', authenticateToken, updateSettings);

module.exports = router;
