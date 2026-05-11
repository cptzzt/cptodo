const pool = require('../utils/db');

// ===== 清理过期的重复任务 =====
// 每天：due_date < 今天 → 创建下一个（今天），删除旧的
// 每周：due_date < 本周一 → 创建下一个（下一个目标星期几），删除旧的
// 跳过回收站内的任务（deleted_at IS NOT NULL）
async function cleanupExpiredRecurring(userId) {
  // 找出已过期的活跃重复任务（不含回收站内的）
  const [expired] = await pool.execute(
    `SELECT id, user_id, title, content, notes, priority, recurring, due_date
     FROM items
     WHERE user_id = ? AND recurring IS NOT NULL AND type = 'task'
     AND recurring_target = 1
     AND deleted_at IS NULL
     AND (
       (recurring = 'daily' AND due_date < CURDATE())
       OR
       (recurring = 'weekly' AND due_date < DATE_SUB(CURDATE(), INTERVAL WEEKDAY(CURDATE()) DAY))
     )`,
    [userId]
  );

  for (const task of expired) {
    // 计算下一个日期
    let nextDateStr;
    if (task.recurring === 'daily') {
      const d = new Date();
      nextDateStr = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    } else if (task.recurring === 'weekly') {
      const orig = new Date(task.due_date);
      const targetDay = orig.getDay(); // 0=Sun, 1=Mon, ..., 6=Sat
      const now = new Date();
      now.setHours(0, 0, 0, 0);
      const currentDay = now.getDay();
      let diff = targetDay - currentDay;
      if (diff <= 0) diff += 7;
      now.setDate(now.getDate() + diff);
      nextDateStr = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
    }

    if (!nextDateStr) continue;

    // 创建下一次任务
    const [nextResult] = await pool.execute(
      `INSERT INTO items (user_id, type, title, content, notes, due_date, completed, priority, recurring)
       VALUES (?, 'task', ?, ?, ?, ?, 0, ?, ?)`,
      [task.user_id, task.title, task.content, task.notes, nextDateStr, task.priority, task.recurring]
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

    // 彻底删除旧任务
    await pool.execute('DELETE FROM items WHERE id = ?', [task.id]);
  }

  // 重置 target>1 频次目标任务的计数（周边界）
  // due_date 存的是上周一，说明需要重置
  await pool.execute(
    `UPDATE items
     SET recurring_count = 0,
         due_date = DATE_SUB(CURDATE(), INTERVAL WEEKDAY(CURDATE()) DAY)
     WHERE user_id = ? AND recurring = 'weekly' AND recurring_target > 1
     AND deleted_at IS NULL
     AND due_date < DATE_SUB(CURDATE(), INTERVAL WEEKDAY(CURDATE()) DAY)`,
    [userId]
  );
}

// 获取列表（支持多种筛选）
async function getItems(req, res) {
  try {
    const userId = req.user.userId;
    const { project_id, tag_id, type, due_start, due_end, completed, recurring_upcoming } = req.query;

    // 先清理过期的重复任务
    await cleanupExpiredRecurring(userId);

    let sql = `
      SELECT i.id, i.user_id, i.project_id, i.project_label_id, i.parent_id, i.type, i.title,
        i.content, i.notes, i.due_date, i.completed, i.priority, i.recurring, i.recurring_target, i.recurring_count, i.is_private, i.shelved, i.show_early,
        i.sort_order, i.created_at, i.updated_at
      FROM items i`;

    const conditions = ['i.user_id = ?', 'i.deleted_at IS NULL'];
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

    // 附加项目专属标签
    if (items.length > 0) {
      const labelIds = [...new Set(items.map(i => i.project_label_id).filter(Boolean))];
      if (labelIds.length > 0) {
        const placeholders = labelIds.map(() => '?').join(',');
        const [labelRows] = await pool.execute(
          `SELECT pl.id, pl.name, pl.color, pl.project_id
           FROM project_labels pl
           WHERE pl.id IN (${placeholders})`,
          labelIds
        );

        const labelMap = {};
        labelRows.forEach(row => {
          labelMap[row.id] = { id: row.id, name: row.name, color: row.color, project_id: row.project_id };
        });

        items.forEach(item => {
          item.project_label = item.project_label_id ? labelMap[item.project_label_id] || null : null;
        });
      } else {
        items.forEach(item => {
          item.project_label = null;
        });
      }
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
    const { project_id, project_label_id, parent_id, type, title, content, notes, due_date, priority, recurring, recurring_target, tag_ids, is_private, show_early } = req.body;

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

    if (recurring && !['daily', 'weekly'].includes(recurring)) {
      return res.status(400).json({ success: false, message: '重复周期无效' });
    }

    if (recurring && recurring_target !== undefined) {
      if (!Number.isInteger(recurring_target) || recurring_target < 1) {
        return res.status(400).json({ success: false, message: '频次目标必须为正整数' });
      }
      if (recurring_target > 1 && recurring === 'daily') {
        return res.status(400).json({ success: false, message: '每天重复不支持频次目标大于 1' });
      }
    }

    // 重复任务不能绑定项目
    if (recurring && project_id) {
      return res.status(400).json({ success: false, message: '重复任务不能绑定项目' });
    }

    const itemPriority = priority || 'normal';
    const targetValue = recurring ? (recurring_target || 1) : 1;

    const insertSql = `INSERT INTO items (user_id, project_id, project_label_id, parent_id, type, title, content, notes, due_date, completed, priority, recurring, recurring_target, recurring_count, is_private, show_early)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)`;
    const insertParams = [
      userId,
      project_id || null,
      project_label_id || null,
      parent_id || null,
      type,
      title.trim(),
      type === 'task' ? (content ? content.trim() : null) : null,
      notes ? notes.trim() : null,
      recurring === 'weekly' && targetValue > 1
        ? null
        : (type === 'task' ? (due_date || null) : null),
      0,
      itemPriority,
      type === 'task' ? (recurring || null) : null,
      targetValue,
      0,
      is_private ? 1 : 0,
      show_early ? 1 : 0
    ];
    // 使用 pool.escape 处理参数，避免 mysql2 参数绑定问题
    const e = (v) => v === null || v === undefined ? 'NULL' : pool.escape(v);
    const directSql = `INSERT INTO items (user_id, project_id, project_label_id, parent_id, type, title, content, notes, due_date, completed, priority, recurring, recurring_target, recurring_count, is_private, show_early) VALUES (${userId}, ${e(project_id || null)}, ${e(project_label_id || null)}, ${e(parent_id || null)}, ${e(type)}, ${e(title.trim())}, ${e(type === 'task' ? (content ? content.trim() : null) : null)}, ${e(notes ? notes.trim() : null)}, ${e(recurring === 'weekly' && targetValue > 1 ? null : (type === 'task' ? (due_date || null) : null))}, 0, ${e(itemPriority)}, ${e(type === 'task' ? (recurring || null) : null)}, ${e(targetValue)}, 0, ${e(is_private ? 1 : 0)}, ${e(show_early ? 1 : 0)})`;
    const [result] = await pool.query(directSql);

    // target>1 时用 SQL 计算本周一作为 due_date
    if (recurring === 'weekly' && targetValue > 1) {
      await pool.execute(
        `UPDATE items SET due_date = DATE_SUB(CURDATE(), INTERVAL WEEKDAY(CURDATE()) DAY) WHERE id = ?`,
        [result.insertId]
      );
    }

    const insertId = result.insertId;

    if (tag_ids && Array.isArray(tag_ids) && tag_ids.length > 0) {
      const tagValues = tag_ids.map(tid => `(${insertId}, ${parseInt(tid)})`).join(',');
      await pool.execute(`INSERT INTO item_tags (item_id, tag_id) VALUES ${tagValues}`);
    }

    const [newItems] = await pool.execute(
      `SELECT id, user_id, project_id, project_label_id, parent_id, type, title, content, notes, due_date, completed, priority, recurring, recurring_target, recurring_count, is_private, shelved, show_early, sort_order, created_at, updated_at
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
    const { title, content, notes, due_date, completed, parent_id, project_id, project_label_id, priority, recurring, recurring_target, recurring_count, sort_order, type, is_private, shelved, show_early } = req.body;

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
    if (completed !== undefined && item.type === 'task') {
      updates.push('completed = ?');
      values.push(completed ? 1 : 0);
    }

    if (project_id !== undefined) {
      updates.push('project_id = ?');
      values.push(project_id || null);
    }

    if (project_label_id !== undefined) {
      updates.push('project_label_id = ?');
      values.push(project_label_id || null);
    }

    if (priority !== undefined) {
      updates.push('priority = ?');
      values.push(priority || 'normal');
    }

    if (recurring !== undefined && item.type === 'task') {
      // 设置重复时不能绑定项目
      if (recurring && project_id !== undefined && project_id) {
        return res.status(400).json({ success: false, message: '重复任务不能绑定项目' });
      }
      updates.push('recurring = ?');
      values.push(recurring || null);
    }

    if (recurring_target !== undefined && item.type === 'task') {
      updates.push('recurring_target = ?');
      values.push(Math.max(1, parseInt(recurring_target) || 1));
    }

    if (recurring_count !== undefined && item.type === 'task') {
      updates.push('recurring_count = ?');
      values.push(Math.max(0, parseInt(recurring_count) || 0));
    }

    if (parent_id !== undefined && item.type === 'folder') {
      updates.push('parent_id = ?');
      values.push(parent_id || null);
    }

    if (sort_order !== undefined) {
      updates.push('sort_order = ?');
      values.push(sort_order);
    }

    if (is_private !== undefined) {
      updates.push('is_private = ?');
      values.push(is_private ? 1 : 0);
    }

    if (shelved !== undefined) {
      updates.push('shelved = ?');
      values.push(shelved ? 1 : 0);
    }

    if (show_early !== undefined) {
      updates.push('show_early = ?');
      values.push(show_early ? 1 : 0);
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
      `SELECT id, user_id, project_id, project_label_id, parent_id, type, title, content, notes, due_date, completed, priority, recurring, recurring_target, recurring_count, is_private, shelved, show_early, sort_order, created_at, updated_at
       FROM items WHERE id = ?`,
      [itemId]
    );

    res.json({ success: true, message: '更新成功', data: updated[0] });
  } catch (error) {
    console.error('更新失败:', error);
    res.status(500).json({ success: false, message: '服务器内部错误' });
  }
}

// 删除项（软删除）
async function deleteItem(req, res) {
  try {
    const userId = req.user.userId;
    const itemId = req.params.id;

    const [items] = await pool.execute(
      'SELECT id, type FROM items WHERE id = ? AND user_id = ? AND deleted_at IS NULL',
      [itemId, userId]
    );
    if (items.length === 0) {
      return res.status(404).json({ success: false, message: '项目不存在或无权删除' });
    }

    await pool.execute(
      'UPDATE items SET deleted_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?',
      [itemId, userId]
    );

    res.json({ success: true, message: '已移至回收站' });
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

// ===== 回收站接口 =====

// 获取回收站列表
async function getTrashItems(req, res) {
  try {
    const userId = req.user.userId;
    const { type } = req.query;

    let sql = `
      SELECT i.id, i.user_id, i.project_id, i.type, i.title,
        i.content, i.notes, i.due_date, i.completed, i.priority,
        i.deleted_at, i.created_at, i.updated_at,
        p.name AS project_name
      FROM items i
      LEFT JOIN projects p ON p.id = i.project_id
      WHERE i.user_id = ? AND i.deleted_at IS NOT NULL`;
    const params = [userId];

    if (type) {
      sql += ' AND i.type = ?';
      params.push(type);
    }

    sql += ' ORDER BY i.deleted_at DESC';

    const [items] = await pool.execute(sql, params);
    res.json({ success: true, data: items });
  } catch (error) {
    console.error('获取回收站错误:', error);
    res.status(500).json({ success: false, message: '服务器内部错误' });
  }
}

// 恢复项
async function restoreItem(req, res) {
  try {
    const userId = req.user.userId;
    const itemId = req.params.id;

    const [items] = await pool.execute(
      'SELECT id, type, project_id FROM items WHERE id = ? AND user_id = ? AND deleted_at IS NOT NULL',
      [itemId, userId]
    );
    if (items.length === 0) {
      return res.status(404).json({ success: false, message: '项目不存在' });
    }

    const item = items[0];
    const restoredProjects = [];

    // 如果是任务/随笔，检查父项目是否也在回收站
    if (item.project_id) {
      const [projects] = await pool.execute(
        'SELECT id, name, deleted_at FROM projects WHERE id = ? AND user_id = ?',
        [item.project_id, userId]
      );
      if (projects.length > 0 && projects[0].deleted_at) {
        // 一并恢复项目
        await pool.execute(
          'UPDATE projects SET deleted_at = NULL WHERE id = ? AND user_id = ?',
          [item.project_id, userId]
        );
        restoredProjects.push(projects[0].name);
      }
    }

    await pool.execute(
      'UPDATE items SET deleted_at = NULL WHERE id = ? AND user_id = ?',
      [itemId, userId]
    );

    const message = restoredProjects.length > 0
      ? `已恢复，所属项目「${restoredProjects[0]}」将一并恢复`
      : '已恢复';

    res.json({ success: true, message, restoredProjects });
  } catch (error) {
    console.error('恢复失败:', error);
    res.status(500).json({ success: false, message: '服务器内部错误' });
  }
}

// 彻底删除项
async function permanentDeleteItem(req, res) {
  try {
    const userId = req.user.userId;
    const itemId = req.params.id;

    const [items] = await pool.execute(
      'SELECT id, type FROM items WHERE id = ? AND user_id = ? AND deleted_at IS NOT NULL',
      [itemId, userId]
    );
    if (items.length === 0) {
      return res.status(404).json({ success: false, message: '项目不存在' });
    }

    await pool.execute('DELETE FROM items WHERE id = ? AND user_id = ?', [itemId, userId]);

    res.json({ success: true, message: '已彻底删除' });
  } catch (error) {
    console.error('彻底删除失败:', error);
    res.status(500).json({ success: false, message: '服务器内部错误' });
  }
}

// 批量恢复
async function batchRestoreItems(req, res) {
  try {
    const userId = req.user.userId;
    const { ids } = req.body;

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ success: false, message: '请选择要恢复的项' });
    }

    const placeholders = ids.map(() => '?').join(',');
    const [items] = await pool.execute(
      `SELECT id, project_id FROM items WHERE id IN (${placeholders}) AND user_id = ? AND deleted_at IS NOT NULL`,
      [...ids, userId]
    );

    if (items.length === 0) {
      return res.status(404).json({ success: false, message: '未找到可恢复的项' });
    }

    // 找出需要一并恢复的项目
    const projectIds = [...new Set(items.map(i => i.project_id).filter(Boolean))];
    const restoredProjects = [];

    for (const projectId of projectIds) {
      const [projects] = await pool.execute(
        'SELECT id, name, deleted_at FROM projects WHERE id = ? AND user_id = ?',
        [projectId, userId]
      );
      if (projects.length > 0 && projects[0].deleted_at) {
        await pool.execute(
          'UPDATE projects SET deleted_at = NULL WHERE id = ? AND user_id = ?',
          [projectId, userId]
        );
        restoredProjects.push(projects[0].name);
      }
    }

    // 恢复选中的项
    const itemIds = items.map(i => i.id);
    const itemPlaceholders = itemIds.map(() => '?').join(',');
    await pool.execute(
      `UPDATE items SET deleted_at = NULL WHERE id IN (${itemPlaceholders}) AND user_id = ?`,
      [...itemIds, userId]
    );

    const message = restoredProjects.length > 0
      ? `已恢复 ${items.length} 项，所属项目「${restoredProjects.join('、')}」将一并恢复`
      : `已恢复 ${items.length} 项`;

    res.json({ success: true, message, restoredProjects });
  } catch (error) {
    console.error('批量恢复失败:', error);
    res.status(500).json({ success: false, message: '服务器内部错误' });
  }
}

// 批量彻底删除
async function batchPermanentDeleteItems(req, res) {
  try {
    const userId = req.user.userId;
    const { ids } = req.body;

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ success: false, message: '请选择要删除的项' });
    }

    const placeholders = ids.map(() => '?').join(',');
    await pool.execute(
      `DELETE FROM items WHERE id IN (${placeholders}) AND user_id = ? AND deleted_at IS NOT NULL`,
      [...ids, userId]
    );

    res.json({ success: true, message: '已彻底删除' });
  } catch (error) {
    console.error('批量彻底删除失败:', error);
    res.status(500).json({ success: false, message: '服务器内部错误' });
  }
}

// 搜索项（包含回收站内的，排除彻底删除的）
async function searchItems(req, res) {
  try {
    const userId = req.user.userId;
    const { q } = req.query;

    if (!q || q.trim().length === 0) {
      return res.json({ success: true, data: [] });
    }

    const keyword = `%${q.trim()}%`;
    const sql = `
      SELECT i.id, i.user_id, i.project_id, i.type, i.title,
        i.completed, i.priority, i.recurring, i.recurring_target, i.recurring_count,
        i.is_private, i.shelved, i.deleted_at, i.due_date,
        p.name AS project_name
      FROM items i
      LEFT JOIN projects p ON p.id = i.project_id
      WHERE i.user_id = ?
        AND (i.title LIKE ? OR i.content LIKE ? OR i.notes LIKE ?)
      ORDER BY i.deleted_at ASC, i.created_at DESC
      LIMIT 50`;
    const params = [userId, keyword, keyword, keyword];

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
      items.forEach(item => { item.tags = tagMap[item.id] || []; });
    }

    res.json({ success: true, data: items });
  } catch (error) {
    console.error('搜索错误:', error);
    res.status(500).json({ success: false, message: '服务器内部错误' });
  }
}

module.exports = {
  getItems, createItem, updateItem, deleteItem, addItemTag, removeItemTag,
  getTrashItems, restoreItem, permanentDeleteItem, searchItems,
  batchRestoreItems, batchPermanentDeleteItems
};
