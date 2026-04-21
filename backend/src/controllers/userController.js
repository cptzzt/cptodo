const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../utils/db');

const SALT_ROUNDS = 10;

// 用户注册
async function register(req, res) {
  try {
    const { username, password } = req.body;

    // 输入校验
    if (!username || !password) {
      return res.status(400).json({ success: false, message: '用户名和密码不能为空' });
    }
    if (username.length < 3 || username.length > 50) {
      return res.status(400).json({ success: false, message: '用户名长度需在 3-50 个字符之间' });
    }
    if (password.length < 6) {
      return res.status(400).json({ success: false, message: '密码长度不能少于 6 位' });
    }

    // 检查用户名是否已存在
    const [existingUsers] = await pool.execute(
      'SELECT id FROM users WHERE username = ?',
      [username]
    );
    if (existingUsers.length > 0) {
      return res.status(409).json({ success: false, message: '用户名已存在' });
    }

    // 密码加密
    const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

    // 插入新用户
    const [result] = await pool.execute(
      'INSERT INTO users (username, password) VALUES (?, ?)',
      [username, hashedPassword]
    );

    res.status(201).json({
      success: true,
      message: '注册成功',
      data: { userId: result.insertId, username }
    });
  } catch (error) {
    console.error('注册错误:', error);
    res.status(500).json({ success: false, message: '服务器内部错误' });
  }
}

// 用户登录
async function login(req, res) {
  try {
    const { username, password } = req.body;

    // 输入校验
    if (!username || !password) {
      return res.status(400).json({ success: false, message: '用户名和密码不能为空' });
    }

    // 查询用户
    const [users] = await pool.execute(
      'SELECT id, username, password, no_child_delete_prompt FROM users WHERE username = ?',
      [username]
    );
    if (users.length === 0) {
      return res.status(401).json({ success: false, message: '用户名不存在' });
    }

    const user = users[0];

    // 验证密码
    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      return res.status(401).json({ success: false, message: '密码错误' });
    }

    // 生成 JWT
    const token = jwt.sign(
      { userId: user.id, username: user.username },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      success: true,
      message: '登录成功',
      data: {
        token,
        user: {
          id: user.id,
          username: user.username,
          no_child_delete_prompt: !!user.no_child_delete_prompt
        }
      }
    });
  } catch (error) {
    console.error('登录错误:', error);
    res.status(500).json({ success: false, message: '服务器内部错误' });
  }
}

// 更新用户设置
async function updateSettings(req, res) {
  try {
    const userId = req.user.userId;
    const { no_child_delete_prompt } = req.body;

    if (typeof no_child_delete_prompt === 'boolean') {
      await pool.execute(
        'UPDATE users SET no_child_delete_prompt = ? WHERE id = ?',
        [no_child_delete_prompt ? 1 : 0, userId]
      );
    }

    res.json({ success: true, message: '设置已更新' });
  } catch (error) {
    console.error('更新设置错误:', error);
    res.status(500).json({ success: false, message: '服务器内部错误' });
  }
}

module.exports = { register, login, updateSettings };
