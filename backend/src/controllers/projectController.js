const pool = require('../utils/db');

// 获取用户所有项目（附带任务统计）
async function getProjects(req, res) {
  try {
    const userId = req.user.userId;

    const [projects] = await pool.execute(
      `SELECT p.id, p.name, p.sort_order, p.created_at,
        COUNT(CASE WHEN i.type = 'task' AND i.priority = 'important' AND (i.completed = 0 OR i.completed IS NULL) THEN 1 END) AS important_count,
        COUNT(CASE WHEN i.type = 'task' AND i.priority = 'normal' AND (i.completed = 0 OR i.completed IS NULL) THEN 1 END) AS normal_count
       FROM projects p
       LEFT JOIN items i ON i.project_id = p.id AND i.type = 'task'
       WHERE p.user_id = ?
       GROUP BY p.id
       ORDER BY p.sort_order ASC, p.created_at ASC`,
      [userId]
    );

    res.json({ success: true, data: projects });
  } catch (error) {
    console.error('获取项目列表错误:', error);
    res.status(500).json({ success: false, message: '服务器内部错误' });
  }
}

// 创建项目
async function createProject(req, res) {
  try {
    const userId = req.user.userId;
    const { name } = req.body;

    if (!name || name.trim() === '') {
      return res.status(400).json({ success: false, message: '项目名称不能为空' });
    }
    if (name.length > 100) {
      return res.status(400).json({ success: false, message: '项目名称不能超过 100 个字符' });
    }

    const [result] = await pool.execute(
      'INSERT INTO projects (user_id, name) VALUES (?, ?)',
      [userId, name.trim()]
    );

    res.status(201).json({
      success: true,
      message: '项目创建成功',
      data: { id: result.insertId, name: name.trim() }
    });
  } catch (error) {
    console.error('创建项目错误:', error);
    res.status(500).json({ success: false, message: '服务器内部错误' });
  }
}

// 更新项目
async function updateProject(req, res) {
  try {
    const userId = req.user.userId;
    const projectId = req.params.id;
    const { name } = req.body;

    if (!name || name.trim() === '') {
      return res.status(400).json({ success: false, message: '项目名称不能为空' });
    }

    const [result] = await pool.execute(
      'UPDATE projects SET name = ? WHERE id = ? AND user_id = ?',
      [name.trim(), projectId, userId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: '项目不存在' });
    }

    res.json({ success: true, message: '更新成功' });
  } catch (error) {
    console.error('更新项目错误:', error);
    res.status(500).json({ success: false, message: '服务器内部错误' });
  }
}

// 删除项目
async function deleteProject(req, res) {
  try {
    const userId = req.user.userId;
    const projectId = req.params.id;

    const [result] = await pool.execute(
      'DELETE FROM projects WHERE id = ? AND user_id = ?',
      [projectId, userId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: '项目不存在' });
    }

    res.json({ success: true, message: '删除成功' });
  } catch (error) {
    console.error('删除项目错误:', error);
    res.status(500).json({ success: false, message: '服务器内部错误' });
  }
}

module.exports = { getProjects, createProject, updateProject, deleteProject };
