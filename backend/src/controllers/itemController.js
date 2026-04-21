const pool = require('../utils/db');

// 获取当前用户的所有项（返回扁平列表，前端拼装树）
async function getItems(req, res) {
  try {
    const userId = req.user.userId;

    const [items] = await pool.execute(
      `SELECT id, parent_id, type, title, content, notes, due_date, completed, sort_order, created_at
       FROM items
       WHERE user_id = ?
       ORDER BY sort_order ASC, created_at DESC`,
      [userId]
    );

    res.json({ success: true, data: items });
  } catch (error) {
    console.error('获取列表错误:', error);
    res.status(500).json({ success: false, message: '服务器内部错误' });
  }
}

// 创建目录或任务
async function createItem(req, res) {
  try {
    const userId = req.user.userId;
    const { parent_id, type, title, content, notes, due_date, completed } = req.body;

    // type 校验
    if (!type || !['folder', 'task'].includes(type)) {
      return res.status(400).json({ success: false, message: '类型必须为 folder 或 task' });
    }

    // title 校验
    if (!title || title.trim() === '') {
      return res.status(400).json({ success: false, message: '标题不能为空' });
    }
    if (title.length > 255) {
      return res.status(400).json({ success: false, message: '标题不能超过 255 个字符' });
    }

    // parent_id 校验：如果指定了 parent，必须是 folder 类型，且属于当前用户
    if (parent_id) {
      const [parents] = await pool.execute(
        'SELECT id, type FROM items WHERE id = ? AND user_id = ?',
        [parent_id, userId]
      );
      if (parents.length === 0) {
        return res.status(404).json({ success: false, message: '父级目录不存在' });
      }
      if (parents[0].type !== 'folder') {
        return res.status(400).json({ success: false, message: '任务下方无法添加新层级' });
      }
    }

    // content 校验：task 必须有 content
    if (type === 'task') {
      if (!content || content.trim() === '') {
        return res.status(400).json({ success: false, message: '任务内容不能为空' });
      }
      if (content.length > 500) {
        return res.status(400).json({ success: false, message: '任务内容不能超过 500 个字符' });
      }
    }

    // due_date 校验：仅 task 有效
    if (due_date && type !== 'task') {
      return res.status(400).json({ success: false, message: '目录不支持截止日期' });
    }
    if (due_date && !/^\d{4}-\d{2}-\d{2}$/.test(due_date)) {
      return res.status(400).json({ success: false, message: '日期格式错误，请使用 YYYY-MM-DD' });
    }

    const [result] = await pool.execute(
      `INSERT INTO items (user_id, parent_id, type, title, content, notes, due_date, completed)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        userId,
        parent_id || null,
        type,
        title.trim(),
        type === 'task' ? content.trim() : null,
        notes ? notes.trim() : null,
        type === 'task' ? (due_date || null) : null,
        type === 'task' ? (completed ? 1 : 0) : 0
      ]
    );

    const [newItem] = await pool.execute(
      `SELECT id, parent_id, type, title, content, notes, due_date, completed, sort_order, created_at
       FROM items WHERE id = ?`,
      [result.insertId]
    );

    res.status(201).json({ success: true, message: '创建成功', data: newItem[0] });
  } catch (error) {
    console.error('创建失败:', error);
    res.status(500).json({ success: false, message: '服务器内部错误' });
  }
}

// 更新目录或任务
async function updateItem(req, res) {
  try {
    const userId = req.user.userId;
    const itemId = req.params.id;
    const { title, content, notes, due_date, completed, parent_id, sort_order } = req.body;

    // 查询当前项
    const [items] = await pool.execute(
      'SELECT id, type, parent_id FROM items WHERE id = ? AND user_id = ?',
      [itemId, userId]
    );
    if (items.length === 0) {
      return res.status(404).json({ success: false, message: '项目不存在或无权修改' });
    }
    const item = items[0];

    const updates = [];
    const values = [];

    if (title !== undefined) {
      if (!title || title.trim() === '') {
        return res.status(400).json({ success: false, message: '标题不能为空' });
      }
      updates.push('title = ?');
      values.push(title.trim());
    }

    if (content !== undefined && item.type === 'task') {
      if (!content || content.trim() === '') {
        return res.status(400).json({ success: false, message: '任务内容不能为空' });
      }
      updates.push('content = ?');
      values.push(content.trim());
    }

    if (notes !== undefined) {
      updates.push('notes = ?');
      values.push(notes ? notes.trim() : null);
    }

    if (due_date !== undefined && item.type === 'task') {
      if (due_date && !/^\d{4}-\d{2}-\d{2}$/.test(due_date)) {
        return res.status(400).json({ success: false, message: '日期格式错误' });
      }
      updates.push('due_date = ?');
      values.push(due_date || null);
    }

    if (completed !== undefined && item.type === 'task') {
      updates.push('completed = ?');
      values.push(completed ? 1 : 0);
    }

    // 移动目录：切换 parent_id（只能是 folder 才能被移动为子项）
    if (parent_id !== undefined && item.type === 'folder') {
      if (parent_id !== null) {
        // 不能把自己或自己的后代设为父级（防止循环引用）
        if (parseInt(parent_id) === parseInt(itemId)) {
          return res.status(400).json({ success: false, message: '不能将目录设为自己' });
        }
        const isDescendant = await checkIsDescendant(itemId, parent_id);
        if (isDescendant) {
          return res.status(400).json({ success: false, message: '不能将目录设为自己子级' });
        }
        const [parents] = await pool.execute(
          'SELECT id, type FROM items WHERE id = ? AND user_id = ?',
          [parent_id, userId]
        );
        if (parents.length === 0 || parents[0].type !== 'folder') {
          return res.status(400).json({ success: false, message: '只能移动到目录下方' });
        }
      }
      updates.push('parent_id = ?');
      values.push(parent_id || null);
    }

    if (sort_order !== undefined) {
      updates.push('sort_order = ?');
      values.push(sort_order);
    }

    if (updates.length === 0) {
      return res.status(400).json({ success: false, message: '没有需要更新的字段' });
    }

    values.push(itemId, userId);
    await pool.execute(
      `UPDATE items SET ${updates.join(', ')} WHERE id = ? AND user_id = ?`,
      values
    );

    const [updated] = await pool.execute(
      `SELECT id, parent_id, type, title, content, notes, due_date, completed, sort_order, created_at
       FROM items WHERE id = ?`,
      [itemId]
    );

    res.json({ success: true, message: '更新成功', data: updated[0] });
  } catch (error) {
    console.error('更新失败:', error);
    res.status(500).json({ success: false, message: '服务器内部错误' });
  }
}

// 删除目录或任务
async function deleteItem(req, res) {
  try {
    const userId = req.user.userId;
    const itemId = req.params.id;

    const [items] = await pool.execute(
      'SELECT id, type FROM items WHERE id = ? AND user_id = ?',
      [itemId, userId]
    );
    if (items.length === 0) {
      return res.status(404).json({ success: false, message: '项目不存在或无权删除' });
    }

    // 由于设置了 ON DELETE CASCADE，删除 folder 会自动删除所有子项
    await pool.execute('DELETE FROM items WHERE id = ? AND user_id = ?', [itemId, userId]);

    res.json({ success: true, message: '删除成功' });
  } catch (error) {
    console.error('删除失败:', error);
    res.status(500).json({ success: false, message: '服务器内部错误' });
  }
}

// 检查 targetId 是否是 sourceId 的后代（防止循环引用）
async function checkIsDescendant(sourceId, targetId) {
  let currentId = targetId;
  const visited = new Set();
  while (currentId !== null) {
    if (visited.has(currentId)) break; // 防死循环
    visited.add(currentId);
    const [rows] = await pool.execute('SELECT parent_id FROM items WHERE id = ?', [currentId]);
    if (rows.length === 0) break;
    if (parseInt(rows[0].parent_id) === parseInt(sourceId)) return true;
    currentId = rows[0].parent_id;
  }
  return false;
}

module.exports = { getItems, createItem, updateItem, deleteItem };
