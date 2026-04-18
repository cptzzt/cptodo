const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const { getTasks, createTask, updateTask, deleteTask } = require('../controllers/taskController');

// 所有任务接口都需要登录验证
router.use(authenticateToken);

// 获取任务列表
router.get('/', getTasks);

// 创建任务
router.post('/', createTask);

// 更新任务
router.put('/:id', updateTask);

// 删除任务
router.delete('/:id', deleteTask);

module.exports = router;
