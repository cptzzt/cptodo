const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const {
  getProjectLabels, createProjectLabel, updateProjectLabel, deleteProjectLabel
} = require('../controllers/projectLabelController');

// 项目专属标签管理
// 注意：PUT 和 DELETE 路由必须在 /:projectId 之前，否则会被 /:projectId 匹配
router.put('/labels/:id', authenticateToken, updateProjectLabel);
router.delete('/labels/:id', authenticateToken, deleteProjectLabel);
router.get('/:projectId/labels', authenticateToken, getProjectLabels);
router.post('/:projectId/labels', authenticateToken, createProjectLabel);

module.exports = router;
