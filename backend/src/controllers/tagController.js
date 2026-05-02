const pool = require('../utils/db');

// 获取用户所有标签
async function getTags(req, res) {
  try {
    const userId = req.user.userId;

    const [tags] = await pool.execute(
      `SELECT t.id, t.name, t.color, t.is_private, t.created_at,
        COUNT(i.id) AS item_count
       FROM tags t
       LEFT JOIN item_tags it ON it.tag_id = t.id
       LEFT JOIN items i ON i.id = it.item_id AND i.deleted_at IS NULL
       WHERE t.user_id = ?
       GROUP BY t.id
       ORDER BY t.created_at ASC`,
      [userId]
    );

    res.json({ success: true, data: tags });
  } catch (error) {
    console.error('获取标签列表错误:', error);
    res.status(500).json({ success: false, message: '服务器内部错误' });
  }
}

// 创建标签
async function createTag(req, res) {
  try {
    const userId = req.user.userId;
    const { name, color, is_private } = req.body;

    if (!name || name.trim() === '') {
      return res.status(400).json({ success: false, message: '标签名称不能为空' });
    }
    if (name.length > 20) {
      return res.status(400).json({ success: false, message: '标签名称不能超过 20 个字符' });
    }

    const tagColor = color || '#4f46e5';

    const [result] = await pool.execute(
      'INSERT INTO tags (user_id, name, color, is_private) VALUES (?, ?, ?, ?)',
      [userId, name.trim(), tagColor, is_private ? 1 : 0]
    );

    res.status(201).json({
      success: true,
      message: '标签创建成功',
      data: { id: result.insertId, name: name.trim(), color: tagColor, is_private: is_private ? 1 : 0 }
    });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ success: false, message: '标签已存在' });
    }
    console.error('创建标签错误:', error);
    res.status(500).json({ success: false, message: '服务器内部错误' });
  }
}

// 更新标签
async function updateTag(req, res) {
  try {
    const userId = req.user.userId;
    const tagId = req.params.id;
    const { name, color, is_private } = req.body;

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

    if (is_private !== undefined) {
      updates.push('is_private = ?');
      values.push(is_private ? 1 : 0);
    }

    values.push(tagId, userId);
    const [result] = await pool.execute(
      `UPDATE tags SET ${updates.join(', ')} WHERE id = ? AND user_id = ?`,
      values
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: '标签不存在' });
    }

    res.json({ success: true, message: '更新成功' });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ success: false, message: '标签已存在' });
    }
    console.error('更新标签错误:', error);
    res.status(500).json({ success: false, message: '服务器内部错误' });
  }
}

// 删除标签
async function deleteTag(req, res) {
  try {
    const userId = req.user.userId;
    const tagId = req.params.id;

    const [result] = await pool.execute(
      'DELETE FROM tags WHERE id = ? AND user_id = ?',
      [tagId, userId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: '标签不存在' });
    }

    res.json({ success: true, message: '删除成功' });
  } catch (error) {
    console.error('删除标签错误:', error);
    res.status(500).json({ success: false, message: '服务器内部错误' });
  }
}

module.exports = { getTags, createTag, updateTag, deleteTag };
