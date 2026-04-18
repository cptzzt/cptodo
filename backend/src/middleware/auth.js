const jwt = require('jsonwebtoken');

// 验证 JWT token
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({ success: false, message: '未登录，请先登录' });
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ success: false, message: 'Token 已过期，请重新登录' });
    }
    req.user = user;
    next();
  });
}

module.exports = { authenticateToken };
