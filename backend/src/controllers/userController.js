const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../utils/db');
const { sendVerificationCode } = require('../utils/email');

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
      return res.status(400).json({ success: false, message: '用户名/邮箱和密码不能为空' });
    }

    // 查询用户（支持用户名或邮箱）
    const [users] = await pool.execute(
      'SELECT id, username, password, email, no_child_delete_prompt FROM users WHERE username = ? OR email = ?',
      [username, username]
    );
    if (users.length === 0) {
      return res.status(401).json({ success: false, message: '用户不存在' });
    }

    const user = users[0];

    // 验证密码
    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      return res.status(401).json({ success: false, message: '密码错误' });
    }

    // 生成 JWT（7天有效期）
    const token = jwt.sign(
      { userId: user.id, username: user.username },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      success: true,
      message: '登录成功',
      data: {
        token,
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          no_child_delete_prompt: !!user.no_child_delete_prompt
        }
      }
    });
  } catch (error) {
    console.error('登录错误:', error);
    res.status(500).json({ success: false, message: '服务器内部错误' });
  }
}

// 获取用户主题偏好
async function getThemePreference(req, res) {
  try {
    const userId = req.user.userId;
    const [users] = await pool.execute(
      'SELECT theme_preference FROM users WHERE id = ?',
      [userId]
    );
    if (users.length === 0) {
      return res.status(404).json({ success: false, message: '用户不存在' });
    }
    const themePref = users[0].theme_preference || 'forest-sage';
    console.log(`[Theme] 用户 ${userId} 的主题偏好:`, themePref);
    res.json({
      success: true,
      data: { themePreference: themePref }
    });
  } catch (error) {
    console.error('获取主题偏好错误:', error);
    res.status(500).json({ success: false, message: '服务器内部错误' });
  }
}

// 更新用户主题偏好
async function updateThemePreference(req, res) {
  try {
    const userId = req.user.userId;
    const { themePreference } = req.body;
    const validThemes = ['forest-sage', 'warm-linen', 'lavender-mist', 'minimal-ink'];

    if (!themePreference || !validThemes.includes(themePreference)) {
      return res.status(400).json({ success: false, message: '无效的主题选择' });
    }

    await pool.execute(
      'UPDATE users SET theme_preference = ? WHERE id = ?',
      [themePreference, userId]
    );

    res.json({ success: true, message: '主题偏好已更新' });
  } catch (error) {
    console.error('更新主题偏好错误:', error);
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

// 生成6位随机验证码
function generateCode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// 发送邮箱验证码
async function sendEmailCode(req, res) {
  try {
    const { email, type = 'login' } = req.body;

    // 输入校验
    if (!email) {
      return res.status(400).json({ success: false, message: '邮箱不能为空' });
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ success: false, message: '邮箱格式不正确' });
    }
    if (!['login', 'register'].includes(type)) {
      return res.status(400).json({ success: false, message: '无效的类型' });
    }

    // 检查邮箱是否已注册（注册时）
    if (type === 'register') {
      const [existing] = await pool.execute('SELECT id FROM users WHERE email = ?', [email]);
      if (existing.length > 0) {
        return res.status(409).json({ success: false, message: '该邮箱已注册' });
      }
    }

    // 检查邮箱是否存在（登录时）
    if (type === 'login') {
      const [existing] = await pool.execute('SELECT id FROM users WHERE email = ?', [email]);
      if (existing.length === 0) {
        return res.status(404).json({ success: false, message: '该邮箱未注册' });
      }
    }

    // 限制：60秒内只能发送一次
    const oneMinuteAgo = new Date(Date.now() - 60 * 1000);
    const [recentCodes] = await pool.execute(
      'SELECT id FROM verification_codes WHERE email = ? AND created_at > ?',
      [email, oneMinuteAgo]
    );
    if (recentCodes.length > 0) {
      return res.status(429).json({ success: false, message: '请60秒后再试' });
    }

    // 生成验证码
    const code = generateCode();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5分钟后过期

    // 保存到数据库
    await pool.execute(
      'INSERT INTO verification_codes (email, code, type, expires_at) VALUES (?, ?, ?, ?)',
      [email, code, type, expiresAt]
    );

    // 发送邮件
    await sendVerificationCode(email, code, type);

    res.json({
      success: true,
      message: '验证码已发送，请查收邮件'
    });
  } catch (error) {
    console.error('发送验证码错误:', error);
    res.status(500).json({ success: false, message: error.message || '服务器内部错误' });
  }
}

// 邮箱验证码登录/注册
async function emailAuth(req, res) {
  try {
    const { email, code, type = 'login', username, password } = req.body;

    // 输入校验
    if (!email || !code) {
      return res.status(400).json({ success: false, message: '邮箱和验证码不能为空' });
    }
    if (!['login', 'register'].includes(type)) {
      return res.status(400).json({ success: false, message: '无效的类型' });
    }

    // 查找验证码
    const [codes] = await pool.execute(
      'SELECT * FROM verification_codes WHERE email = ? AND code = ? AND type = ? AND used = 0 AND expires_at > NOW() ORDER BY created_at DESC LIMIT 1',
      [email, code, type]
    );

    if (codes.length === 0) {
      return res.status(400).json({ success: false, message: '验证码无效或已过期' });
    }

    const verificationCode = codes[0];

    // 标记验证码已使用
    await pool.execute('UPDATE verification_codes SET used = 1 WHERE id = ?', [verificationCode.id]);

    let user;

    if (type === 'register') {
      // 注册新用户
      if (!password) {
        return res.status(400).json({ success: false, message: '请设置密码' });
      }
      if (password.length < 6) {
        return res.status(400).json({ success: false, message: '密码长度不能少于 6 位' });
      }

      // 用户名可选，为空时设为 NULL
      let finalUsername = null;
      if (username && username.trim()) {
        finalUsername = username.trim();
        // 检查用户名是否已存在
        const [existing] = await pool.execute('SELECT id FROM users WHERE username = ?', [finalUsername]);
        if (existing.length > 0) {
          return res.status(409).json({ success: false, message: '用户名已存在' });
        }
      }

      const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

      const [result] = await pool.execute(
        'INSERT INTO users (username, password, email) VALUES (?, ?, ?)',
        [finalUsername, hashedPassword, email]
      );

      user = { id: result.insertId, username: finalUsername, email };
    } else {
      // 登录：查找用户
      const [users] = await pool.execute(
        'SELECT id, username, email, no_child_delete_prompt FROM users WHERE email = ?',
        [email]
      );

      if (users.length === 0) {
        return res.status(404).json({ success: false, message: '用户不存在' });
      }

      user = users[0];
    }

    // 生成 JWT（7天有效期）
    const token = jwt.sign(
      { userId: user.id, username: user.username },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      success: true,
      message: type === 'register' ? '注册成功' : '登录成功',
      data: {
        token,
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          no_child_delete_prompt: !!user.no_child_delete_prompt
        }
      }
    });
  } catch (error) {
    console.error('邮箱验证码认证错误:', error);
    res.status(500).json({ success: false, message: '服务器内部错误' });
  }
}

// 修改用户名
async function updateUsername(req, res) {
  try {
    const userId = req.user.userId;
    const { username } = req.body;

    if (!username || !username.trim()) {
      return res.status(400).json({ success: false, message: '用户名不能为空' });
    }
    if (username.length < 3 || username.length > 50) {
      return res.status(400).json({ success: false, message: '用户名长度需在 3-50 个字符之间' });
    }

    const trimmedUsername = username.trim();

    // 检查用户名是否已被其他用户使用
    const [existing] = await pool.execute(
      'SELECT id FROM users WHERE username = ? AND id != ?',
      [trimmedUsername, userId]
    );
    if (existing.length > 0) {
      return res.status(409).json({ success: false, message: '用户名已被使用' });
    }

    // 更新用户名
    await pool.execute(
      'UPDATE users SET username = ? WHERE id = ?',
      [trimmedUsername, userId]
    );

    res.json({ success: true, message: '用户名已更新' });
  } catch (error) {
    console.error('修改用户名错误:', error);
    res.status(500).json({ success: false, message: '服务器内部错误' });
  }
}

module.exports = { register, login, sendEmailCode, emailAuth, updateUsername, updateSettings, getThemePreference, updateThemePreference };
