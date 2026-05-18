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

// ===== 定期清理过期重复任务 =====
// 服务端定时器，弥补客户端（尤其 Capacitor/Android）挂起时无法触发清理的问题
async function cleanupAllUsers() {
  try {
    const [users] = await pool.execute('SELECT id FROM users');
    for (const user of users) {
      // 复用 itemController 的清理逻辑（直接 SQL，避免循环依赖）
      // 1. target=1 的过期重复任务：删旧建新
      const [expired] = await pool.execute(
        `SELECT id, user_id, title, content, notes, priority, recurring, due_date, original_created_at
         FROM items
         WHERE user_id = ? AND recurring IS NOT NULL AND type = 'task'
         AND recurring_target = 1
         AND deleted_at IS NULL
         AND (
           (recurring = 'daily' AND due_date < CURDATE())
           OR
           (recurring = 'weekly' AND due_date < DATE_SUB(CURDATE(), INTERVAL WEEKDAY(CURDATE()) DAY))
         )`,
        [user.id]
      );

      for (const task of expired) {
        let nextDateStr;
        if (task.recurring === 'daily') {
          const d = new Date();
          nextDateStr = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
        } else if (task.recurring === 'weekly') {
          const now = new Date();
          now.setHours(0, 0, 0, 0);
          const orig = new Date(task.due_date);
          const targetDay = orig.getDay();
          const currentDay = now.getDay();
          let diff = targetDay - currentDay;
          if (diff < 0) diff += 7;
          now.setDate(now.getDate() + diff);
          nextDateStr = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
        }
        if (!nextDateStr) continue;

        const originalCreatedAt = task.original_created_at || null;
        const [nextResult] = await pool.execute(
          `INSERT INTO items (user_id, type, title, content, notes, due_date, completed, priority, recurring, original_created_at)
           VALUES (?, 'task', ?, ?, ?, ?, 0, ?, ?, ?)`,
          [task.user_id, task.title, task.content, task.notes, nextDateStr, task.priority, task.recurring, originalCreatedAt]
        );

        const [tagRows] = await pool.execute(
          'SELECT tag_id FROM item_tags WHERE item_id = ?', [task.id]
        );
        if (tagRows.length > 0) {
          const tagValues = tagRows.map(r => `(${nextResult.insertId}, ${r.tag_id})`).join(',');
          await pool.execute(`INSERT INTO item_tags (item_id, tag_id) VALUES ${tagValues}`);
        }

        await pool.execute('DELETE FROM items WHERE id = ?', [task.id]);
      }

      // 2. target>1 周频次重置
      await pool.execute(
        `UPDATE items
         SET recurring_count = 0,
             due_date = DATE_SUB(CURDATE(), INTERVAL WEEKDAY(CURDATE()) DAY)
         WHERE user_id = ? AND recurring = 'weekly' AND recurring_target > 1
         AND deleted_at IS NULL
         AND due_date < DATE_SUB(CURDATE(), INTERVAL WEEKDAY(CURDATE()) DAY)`,
        [user.id]
      );

      // 3. target>1 日频次重置
      await pool.execute(
        `UPDATE items
         SET recurring_count = 0,
             due_date = CURDATE()
         WHERE user_id = ? AND recurring = 'daily' AND recurring_target > 1
         AND deleted_at IS NULL
         AND due_date < CURDATE()`,
        [user.id]
      );
    }
    if (users.length > 0) {
      console.log(`定期清理完成：已处理 ${users.length} 个用户`);
    }
  } catch (err) {
    console.error('定期清理重复任务失败:', err);
  }
}

// 启动时立即清理一次
cleanupAllUsers();
// 每小时清理一次（3600000ms）
setInterval(cleanupAllUsers, 3600000);

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
