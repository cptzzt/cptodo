const express = require('express');
const cors = require('cors');
require('dotenv').config();

const pool = require('./utils/db');
const userRoutes = require('./routes/userRoutes');
const itemRoutes = require('./routes/itemRoutes');
const projectRoutes = require('./routes/projectRoutes');
const tagRoutes = require('./routes/tagRoutes');
const projectLabelRoutes = require('./routes/projectLabelRoutes');

const app = express();
const PORT = process.env.PORT || 3000;

// 中间件
app.use(cors());
app.use(express.json());

// 路由
app.use('/api/users', userRoutes);
app.use('/api/items', itemRoutes);
app.use('/api/projects', projectLabelRoutes);  // 项目标签路由（必须在 projectRoutes 之前）
app.use('/api/projects', projectRoutes);
app.use('/api/tags', tagRoutes);

// 健康检查
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: '服务器运行正常' });
});

// 404 处理
app.use((req, res) => {
  res.status(404).json({ success: false, message: '接口不存在' });
});

// 启动服务器
app.listen(PORT, () => {
  console.log(`服务器已启动，端口：${PORT}`);
  console.log(`健康检查：http://localhost:${PORT}/api/health`);
});
