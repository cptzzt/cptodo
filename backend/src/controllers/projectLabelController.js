const pool = require('../utils/db');

// 获取项目的所有专属标签
async function getProjectLabels(req, res) {
  try {
    const userId = req.user.userId;
    const projectId = req.params.projectId;

    const [labels] = await pool.execute(
      `SELECT pl.id, pl.name, pl.color, pl.created_at,
        COUNT(i.id) AS item_count
       FROM project_labels pl
       LEFT JOIN items i ON i.project_label_id = pl.id AND i.deleted_at IS NULL
       WHERE pl.project_id = ? AND pl.user_id = ?
       GROUP BY pl.id
       ORDER BY pl.created_at ASC`,
      [projectId, userId]
    );

    res.json({ success: true, data: labels });
  } catch (error) {
    console.error('获取项目标签错误:', error);
    res.status(500).json({ success: false, message: '服务器内部错误' });
  }
}

// 创建项目专属标签
async function createProjectLabel(req, res) {
  try {
    const userId = req.user.userId;
    const projectId = req.params.projectId;
    const { name, color } = req.body;

    if (!name || name.trim() === '') {
      return res.status(400).json({ success: false, message: '标签名称不能为空' });
    }
    if (name.length > 20) {
      return res.status(400).json({ success: false, message: '标签名称不能超过 20 个字符' });
    }

    // 验证项目属于该用户
    const [projects] = await pool.execute(
      'SELECT id FROM projects WHERE id = ? AND user_id = ? AND deleted_at IS NULL',
      [projectId, userId]
    );
    if (projects.length === 0) {
      return res.status(404).json({ success: false, message: '项目不存在' });
    }

    const labelColor = color || '#4f46e5';

    const [result] = await pool.execute(
      'INSERT INTO project_labels (project_id, user_id, name, color) VALUES (?, ?, ?, ?)',
      [projectId, userId, name.trim(), labelColor]
    );

    res.status(201).json({
      success: true,
      message: '标签创建成功',
      data: { id: result.insertId, name: name.trim(), color: labelColor }
    });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ success: false, message: '该项目下已存在同名标签' });
    }
    console.error('创建项目标签错误:', error);
    res.status(500).json({ success: false, message: '服务器内部错误' });
  }
}

// 更新项目专属标签
async function updateProjectLabel(req, res) {
  try {
    const userId = req.user.userId;
    const labelId = req.params.id;
    const { name, color } = req.body;

    if (!name || name.trim() === '') {
      return res.status(400).json({ success: false, message: '标签名称不能为空' });
    }
    if (name.length > 20) {
      return res.status(400).json({ success: false, message: '标签名称不能超过 20 个字符' });
    }

    const updates = [];
    const values = [];

    updates.push('name = ?');
    values.push(name.trim());

    if (color) {
      updates.push('color = ?');
      values.push(color);
    }

    values.push(labelId, userId);
    const [result] = await pool.execute(
      `UPDATE project_labels SET ${updates.join(', ')} WHERE id = ? AND user_id = ?`,
      values
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: '标签不存在' });
    }

    res.json({ success: true, message: '更新成功' });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ success: false, message: '该项目下已存在同名标签' });
    }
    console.error('更新项目标签错误:', error);
    res.status(500).json({ success: false, message: '服务器内部错误' });
  }
}

// 删除项目专属标签
async function deleteProjectLabel(req, res) {
  try {
    const userId = req.user.userId;
    const labelId = req.params.id;

    // 删除前先将关联任务的 project_label_id 置空
    await pool.execute(
      `UPDATE items SET project_label_id = NULL WHERE project_label_id = ? AND user_id = ?`,
      [labelId, userId]
    );

    const [result] = await pool.execute(
      'DELETE FROM project_labels WHERE id = ? AND user_id = ?',
      [labelId, userId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: '标签不存在' });
    }

    res.json({ success: true, message: '删除成功' });
  } catch (error) {
    console.error('删除项目标签错误:', error);
    res.status(500).json({ success: false, message: '服务器内部错误' });
  }
}

module.exports = { getProjectLabels, createProjectLabel, updateProjectLabel, deleteProjectLabel };
