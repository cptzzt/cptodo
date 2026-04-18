const pool = require('../utils/db');

// 获取当前用户的所有任务
async function getTasks(req, res) {
  try {
    const userId = req.user.userId;

    const [tasks] = await pool.execute(
      'SELECT id, content, completed, created_at FROM tasks WHERE user_id = ? ORDER BY created_at DESC',
      [userId]
    );

    res.json({
      success: true,
      data: tasks
    });
  } catch (error) {
    console.error('获取任务错误:', error);
    res.status(500).json({ success: false, message: '服务器内部错误' });
  }
}

// 新增任务
async function createTask(req, res) {
  try {
    const userId = req.user.userId;
    const { content } = req.body;

    if (!content || content.trim() === '') {
      return res.status(400).json({ success: false, message: '任务内容不能为空' });
    }
    if (content.length > 500) {
      return res.status(400).json({ success: false, message: '任务内容不能超过 500 个字符' });
    }

    const [result] = await pool.execute(
      'INSERT INTO tasks (user_id, content) VALUES (?, ?)',
      [userId, content.trim()]
    );

    const [newTask] = await pool.execute(
      'SELECT id, content, completed, created_at FROM tasks WHERE id = ?',
      [result.insertId]
    );

    res.status(201).json({
      success: true,
      message: '任务创建成功',
      data: newTask[0]
    });
  } catch (error) {
    console.error('创建任务错误:', error);
    res.status(500).json({ success: false, message: '服务器内部错误' });
  }
}

// 修改任务
async function updateTask(req, res) {
  try {
    const userId = req.user.userId;
    const taskId = req.params.id;
    const { content, completed } = req.body;

    // 检查任务是否属于当前用户
    const [tasks] = await pool.execute(
      'SELECT id FROM tasks WHERE id = ? AND user_id = ?',
      [taskId, userId]
    );
    if (tasks.length === 0) {
      return res.status(404).json({ success: false, message: '任务不存在或无权修改' });
    }

    // 构建更新字段
    const updates = [];
    const values = [];

    if (content !== undefined) {
      if (content.trim() === '') {
        return res.status(400).json({ success: false, message: '任务内容不能为空' });
      }
      updates.push('content = ?');
      values.push(content.trim());
    }
    if (completed !== undefined) {
      updates.push('completed = ?');
      values.push(completed ? 1 : 0);
    }

    if (updates.length === 0) {
      return res.status(400).json({ success: false, message: '没有需要更新的字段' });
    }

    values.push(taskId, userId);
    await pool.execute(
      `UPDATE tasks SET ${updates.join(', ')} WHERE id = ? AND user_id = ?`,
      values
    );

    const [updatedTask] = await pool.execute(
      'SELECT id, content, completed, created_at FROM tasks WHERE id = ?',
      [taskId]
    );

    res.json({
      success: true,
      message: '任务更新成功',
      data: updatedTask[0]
    });
  } catch (error) {
    console.error('更新任务错误:', error);
    res.status(500).json({ success: false, message: '服务器内部错误' });
  }
}

// 删除任务
async function deleteTask(req, res) {
  try {
    const userId = req.user.userId;
    const taskId = req.params.id;

    // 检查任务是否属于当前用户
    const [tasks] = await pool.execute(
      'SELECT id FROM tasks WHERE id = ? AND user_id = ?',
      [taskId, userId]
    );
    if (tasks.length === 0) {
      return res.status(404).json({ success: false, message: '任务不存在或无权删除' });
    }

    await pool.execute(
      'DELETE FROM tasks WHERE id = ? AND user_id = ?',
      [taskId, userId]
    );

    res.json({ success: true, message: '任务删除成功' });
  } catch (error) {
    console.error('删除任务错误:', error);
    res.status(500).json({ success: false, message: '服务器内部错误' });
  }
}

module.exports = { getTasks, createTask, updateTask, deleteTask };
