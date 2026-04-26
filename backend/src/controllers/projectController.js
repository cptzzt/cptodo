const pool = require('../utils/db');

// 获取用户所有项目（附带任务统计）
async function getProjects(req, res) {
  try {
    const userId = req.user.userId;

    const [projects] = await pool.execute(
      `SELECT p.id, p.name, p.sort_order, p.created_at,
        COUNT(CASE WHEN i.deleted_at IS NULL AND (i.completed = 0 OR i.completed IS NULL) THEN 1 END) AS item_count
       FROM projects p
       LEFT JOIN items i ON i.project_id = p.id
       WHERE p.user_id = ? AND p.deleted_at IS NULL
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

// 删除项目（软删除）
async function deleteProject(req, res) {
  try {
    const userId = req.user.userId;
    const projectId = req.params.id;

    const [projects] = await pool.execute(
      'SELECT id FROM projects WHERE id = ? AND user_id = ? AND deleted_at IS NULL',
      [projectId, userId]
    );
    if (projects.length === 0) {
      return res.status(404).json({ success: false, message: '项目不存在' });
    }

    // 软删除项目
    await pool.execute(
      'UPDATE projects SET deleted_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?',
      [projectId, userId]
    );

    res.json({ success: true, message: '已移至回收站' });
  } catch (error) {
    console.error('删除项目错误:', error);
    res.status(500).json({ success: false, message: '服务器内部错误' });
  }
}

// 获取回收站中的项目
async function getTrashProjects(req, res) {
  try {
    const userId = req.user.userId;

    const [projects] = await pool.execute(
      `SELECT id, name, deleted_at, created_at
       FROM projects
       WHERE user_id = ? AND deleted_at IS NOT NULL
       ORDER BY deleted_at DESC`,
      [userId]
    );

    res.json({ success: true, data: projects });
  } catch (error) {
    console.error('获取回收站项目错误:', error);
    res.status(500).json({ success: false, message: '服务器内部错误' });
  }
}

// 恢复项目
async function restoreProject(req, res) {
  try {
    const userId = req.user.userId;
    const projectId = req.params.id;

    const [projects] = await pool.execute(
      'SELECT id, name FROM projects WHERE id = ? AND user_id = ? AND deleted_at IS NOT NULL',
      [projectId, userId]
    );
    if (projects.length === 0) {
      return res.status(404).json({ success: false, message: '项目不存在' });
    }

    await pool.execute(
      'UPDATE projects SET deleted_at = NULL WHERE id = ? AND user_id = ?',
      [projectId, userId]
    );

    res.json({ success: true, message: '项目已恢复' });
  } catch (error) {
    console.error('恢复项目错误:', error);
    res.status(500).json({ success: false, message: '服务器内部错误' });
  }
}

// 彻底删除项目（级联删除所有子项）
async function permanentDeleteProject(req, res) {
  try {
    const userId = req.user.userId;
    const projectId = req.params.id;

    const [projects] = await pool.execute(
      'SELECT id, name FROM projects WHERE id = ? AND user_id = ? AND deleted_at IS NOT NULL',
      [projectId, userId]
    );
    if (projects.length === 0) {
      return res.status(404).json({ success: false, message: '项目不存在' });
    }

    // 级联删除所有子项（含已软删除的）
    await pool.execute(
      'DELETE FROM items WHERE project_id = ? AND user_id = ?',
      [projectId, userId]
    );

    // 删除项目本身
    await pool.execute(
      'DELETE FROM projects WHERE id = ? AND user_id = ?',
      [projectId, userId]
    );

    res.json({ success: true, message: '项目及所有子项已彻底删除' });
  } catch (error) {
    console.error('彻底删除项目错误:', error);
    res.status(500).json({ success: false, message: '服务器内部错误' });
  }
}

module.exports = {
  getProjects, createProject, updateProject, deleteProject,
  getTrashProjects, restoreProject, permanentDeleteProject
};
