const pool = require('../utils/db');

// ===== 清理过期的重复任务 =====
// 每次加载列表时调用，实现"24:00 自动清理"效果
async function cleanupExpiredRecurring(userId) {
  // 1. 删除已过期的已完成重复任务（保留到当天，过期后删除）
  await pool.execute(
    `DELETE FROM items
     WHERE user_id = ? AND recurring IS NOT NULL AND type = 'task'
     AND due_date < CURDATE() AND completed = 1`,
    [userId]
  );

  // 2. 找出已过期的未完成重复任务
  const [expired] = await pool.execute(
    `SELECT id, user_id, project_id, title, content, notes, priority, recurring
     FROM items
     WHERE user_id = ? AND recurring IS NOT NULL AND type = 'task'
     AND due_date < CURDATE() AND (completed = 0 OR completed IS NULL)`,
    [userId]
  );

  for (const task of expired) {
    // 计算下一次日期
    let dateExpr;
    if (task.recurring === 'daily') dateExpr = 'CURDATE()';
    else if (task.recurring === 'weekly') dateExpr = 'DATE_ADD(CURDATE(), INTERVAL 7 DAY)';
    else if (task.recurring === 'monthly') dateExpr = 'DATE_ADD(CURDATE(), INTERVAL 1 MONTH)';

    // 创建下一次任务
    const [nextResult] = await pool.execute(
      `INSERT INTO items (user_id, project_id, type, title, content, notes, due_date, completed, priority, recurring)
       VALUES (?, ?, 'task', ?, ?, ?, ${dateExpr}, 0, ?, ?)`,
      [task.user_id, task.project_id, task.title, task.content, task.notes, task.priority, task.recurring]
    );

    // 继承标签
    const [tagRows] = await pool.execute(
      'SELECT tag_id FROM item_tags WHERE item_id = ?',
      [task.id]
    );
    if (tagRows.length > 0) {
      const tagValues = tagRows.map(r => `(${nextResult.insertId}, ${r.tag_id})`).join(',');
      await pool.execute(`INSERT INTO item_tags (item_id, tag_id) VALUES ${tagValues}`);
    }

    // 删除旧任务
    await pool.execute('DELETE FROM items WHERE id = ?', [task.id]);
  }
}

// 获取列表（支持多种筛选）
async function getItems(req, res) {
  try {
    const userId = req.user.userId;
    const { project_id, tag_id, type, due_start, due_end, completed, recurring_upcoming } = req.query;

    // 先清理过期的重复任务
    await cleanupExpiredRecurring(userId);

    let sql = `
      SELECT i.id, i.user_id, i.project_id, i.parent_id, i.type, i.title,
        i.content, i.notes, i.due_date, i.completed, i.priority, i.recurring,
        i.sort_order, i.created_at
      FROM items i`;

    const conditions = ['i.user_id = ?'];
    const params = [userId];

    if (project_id !== undefined) {
      if (project_id === '' || project_id === 'null') {
        conditions.push('i.project_id IS NULL');
      } else {
        conditions.push('i.project_id = ?');
        params.push(project_id);
      }
    }

    if (tag_id) {
      sql += ' JOIN item_tags it ON it.item_id = i.id';
      conditions.push('it.tag_id = ?');
      params.push(tag_id);
    }

    if (type) {
      conditions.push('i.type = ?');
      params.push(type);
    }

    if (due_start) {
      conditions.push('i.due_date >= ?');
      params.push(due_start);
    }

    if (due_end) {
      conditions.push('i.due_date <= ?');
      params.push(due_end);
    }

    if (completed !== undefined) {
      if (completed === '1' || completed === 'true') {
        conditions.push('i.completed = 1');
      } else {
        conditions.push('(i.completed = 0 OR i.completed IS NULL)');
      }
    }

    if (recurring_upcoming === 'true') {
      conditions.push('(i.recurring IS NOT NULL AND i.completed = 0)');
    }

    sql += ' WHERE ' + conditions.join(' AND ');
    sql += ' ORDER BY i.sort_order ASC, i.created_at DESC';

    const [items] = await pool.execute(sql, params);

    // 附加标签
    if (items.length > 0) {
      const itemIds = items.map(i => i.id);
      const placeholders = itemIds.map(() => '?').join(',');
      const [tagRows] = await pool.execute(
        `SELECT it.item_id, t.id AS tag_id, t.name, t.color
         FROM item_tags it
         JOIN tags t ON t.id = it.tag_id
         WHERE it.item_id IN (${placeholders})`,
        itemIds
      );

      const tagMap = {};
      tagRows.forEach(row => {
        if (!tagMap[row.item_id]) tagMap[row.item_id] = [];
        tagMap[row.item_id].push({ id: row.tag_id, name: row.name, color: row.color });
      });

      items.forEach(item => {
        item.tags = tagMap[item.id] || [];
      });
    }

    res.json({ success: true, data: items });
  } catch (error) {
    console.error('获取列表错误:', error);
    res.status(500).json({ success: false, message: '服务器内部错误' });
  }
}

// 创建项
async function createItem(req, res) {
  try {
    const userId = req.user.userId;
    const { project_id, parent_id, type, title, content, notes, due_date, priority, recurring, tag_ids } = req.body;

    if (!type || !['note', 'folder', 'task'].includes(type)) {
      return res.status(400).json({ success: false, message: '类型必须为 note、folder 或 task' });
    }

    if (!title || title.trim() === '') {
      return res.status(400).json({ success: false, message: '标题不能为空' });
    }
    if (title.length > 255) {
      return res.status(400).json({ success: false, message: '标题不能超过 255 个字符' });
    }

    if (parent_id) {
      const [parents] = await pool.execute(
        'SELECT id, type FROM items WHERE id = ? AND user_id = ?',
        [parent_id, userId]
      );
      if (parents.length === 0) {
        return res.status(404).json({ success: false, message: '父级不存在' });
      }
      if (parents[0].type !== 'folder') {
        return res.status(400).json({ success: false, message: '任务下方无法添加新层级' });
      }
    }

    if (type === 'task') {
      if (content && content.length > 500) {
        return res.status(400).json({ success: false, message: '内容不能超过 500 个字符' });
      }
    }

    if (due_date && !/^\d{4}-\d{2}-\d{2}$/.test(due_date)) {
      return res.status(400).json({ success: false, message: '日期格式错误' });
    }

    if (recurring && !['daily', 'weekly', 'monthly'].includes(recurring)) {
      return res.status(400).json({ success: false, message: '重复周期无效' });
    }

    const itemPriority = priority || 'normal';

    const [result] = await pool.execute(
      `INSERT INTO items (user_id, project_id, parent_id, type, title, content, notes, due_date, completed, priority, recurring)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        userId,
        project_id || null,
        parent_id || null,
        type,
        title.trim(),
        type === 'task' ? (content ? content.trim() : null) : null,
        notes ? notes.trim() : null,
        type === 'task' ? (due_date || null) : null,
        0,
        itemPriority,
        type === 'task' ? (recurring || null) : null
      ]
    );

    const insertId = result.insertId;

    if (tag_ids && Array.isArray(tag_ids) && tag_ids.length > 0) {
      const tagValues = tag_ids.map(tid => `(${insertId}, ${parseInt(tid)})`).join(',');
      await pool.execute(`INSERT INTO item_tags (item_id, tag_id) VALUES ${tagValues}`);
    }

    const [newItems] = await pool.execute(
      `SELECT id, user_id, project_id, parent_id, type, title, content, notes, due_date, completed, priority, recurring, sort_order, created_at
       FROM items WHERE id = ?`,
      [insertId]
    );

    const newItem = newItems[0];
    newItem.tags = [];

    res.status(201).json({ success: true, message: '创建成功', data: newItem });
  } catch (error) {
    console.error('创建失败:', error);
    res.status(500).json({ success: false, message: '服务器内部错误' });
  }
}

// 更新项
async function updateItem(req, res) {
  try {
    const userId = req.user.userId;
    const itemId = req.params.id;
    const { title, content, notes, due_date, completed, parent_id, project_id, priority, recurring, sort_order, type } = req.body;

    // 查询当前项
    const [items] = await pool.execute(
      'SELECT id, type, parent_id, recurring, project_id, title, content, notes, priority FROM items WHERE id = ? AND user_id = ?',
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

    // type 变更：只允许 note → task
    if (type !== undefined && type === 'task' && item.type === 'note') {
      updates.push('type = ?');
      values.push('task');
      item.type = 'task'; // 让后续 task 字段校验通过
      if (completed === undefined) {
        updates.push('completed = 0');
      }
    }

    if (content !== undefined && item.type === 'task') {
      if (content && content.length > 500) {
        return res.status(400).json({ success: false, message: '内容不能超过 500 个字符' });
      }
      updates.push('content = ?');
      values.push(content ? content.trim() : null);
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

    // 完成状态处理
    let createNextRecurring = false;
    if (completed !== undefined && item.type === 'task') {
      if (completed && item.recurring) {
        // 重复任务：标记已完成（保留记录），后续创建下一次
        updates.push('completed = 1');
        createNextRecurring = true;
      } else {
        updates.push('completed = ?');
        values.push(completed ? 1 : 0);
      }
    }

    if (project_id !== undefined) {
      updates.push('project_id = ?');
      values.push(project_id || null);
    }

    if (priority !== undefined && item.type === 'task') {
      updates.push('priority = ?');
      values.push(priority || 'normal');
    }

    if (recurring !== undefined && item.type === 'task') {
      updates.push('recurring = ?');
      values.push(recurring || null);
    }

    if (parent_id !== undefined && item.type === 'folder') {
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

    // 如果是完成重复任务，创建下一次轮回
    if (createNextRecurring) {
      let dateExpr;
      if (item.recurring === 'daily') dateExpr = 'DATE_ADD(CURDATE(), INTERVAL 1 DAY)';
      else if (item.recurring === 'weekly') dateExpr = 'DATE_ADD(CURDATE(), INTERVAL 7 DAY)';
      else if (item.recurring === 'monthly') dateExpr = 'DATE_ADD(CURDATE(), INTERVAL 1 MONTH)';

      const [nextResult] = await pool.execute(
        `INSERT INTO items (user_id, project_id, type, title, content, notes, due_date, completed, priority, recurring)
         VALUES (?, ?, 'task', ?, ?, ?, ${dateExpr}, 0, ?, ?)`,
        [userId, item.project_id, item.title, item.content, item.notes, item.priority, item.recurring]
      );

      // 继承标签
      const [tagRows] = await pool.execute(
        'SELECT tag_id FROM item_tags WHERE item_id = ?',
        [itemId]
      );
      if (tagRows.length > 0) {
        const tagValues = tagRows.map(r => `(${nextResult.insertId}, ${r.tag_id})`).join(',');
        await pool.execute(`INSERT INTO item_tags (item_id, tag_id) VALUES ${tagValues}`);
      }
    }

    const [updated] = await pool.execute(
      `SELECT id, user_id, project_id, parent_id, type, title, content, notes, due_date, completed, priority, recurring, sort_order, created_at
       FROM items WHERE id = ?`,
      [itemId]
    );

    res.json({ success: true, message: '更新成功', data: updated[0] });
  } catch (error) {
    console.error('更新失败:', error);
    res.status(500).json({ success: false, message: '服务器内部错误' });
  }
}

// 删除项
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

    await pool.execute('DELETE FROM items WHERE id = ? AND user_id = ?', [itemId, userId]);

    res.json({ success: true, message: '删除成功' });
  } catch (error) {
    console.error('删除失败:', error);
    res.status(500).json({ success: false, message: '服务器内部错误' });
  }
}

// 给任务添加标签
async function addItemTag(req, res) {
  try {
    const userId = req.user.userId;
    const itemId = req.params.id;
    const { tag_id } = req.body;

    if (!tag_id) {
      return res.status(400).json({ success: false, message: '标签 ID 不能为空' });
    }

    const [items] = await pool.execute(
      'SELECT id FROM items WHERE id = ? AND user_id = ?',
      [itemId, userId]
    );
    if (items.length === 0) {
      return res.status(404).json({ success: false, message: '项目不存在' });
    }

    await pool.execute(
      'INSERT IGNORE INTO item_tags (item_id, tag_id) VALUES (?, ?)',
      [itemId, tag_id]
    );

    res.json({ success: true, message: '标签添加成功' });
  } catch (error) {
    console.error('添加标签错误:', error);
    res.status(500).json({ success: false, message: '服务器内部错误' });
  }
}

// 移除任务标签
async function removeItemTag(req, res) {
  try {
    const userId = req.user.userId;
    const itemId = req.params.id;
    const tagId = req.params.tag_id;

    await pool.execute(
      'DELETE FROM item_tags WHERE item_id = ? AND tag_id = ?',
      [itemId, tagId]
    );

    res.json({ success: true, message: '标签移除成功' });
  } catch (error) {
    console.error('移除标签错误:', error);
    res.status(500).json({ success: false, message: '服务器内部错误' });
  }
}

module.exports = { getItems, createItem, updateItem, deleteItem, addItemTag, removeItemTag };
