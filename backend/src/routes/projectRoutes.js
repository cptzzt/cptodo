const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const {
  getProjects, createProject, updateProject, deleteProject,
  getTrashProjects, restoreProject, permanentDeleteProject
} = require('../controllers/projectController');

router.get('/', authenticateToken, getProjects);
router.post('/', authenticateToken, createProject);
router.put('/:id', authenticateToken, updateProject);
router.delete('/:id', authenticateToken, deleteProject);

// 回收站
router.get('/trash', authenticateToken, getTrashProjects);
router.post('/trash/restore/:id', authenticateToken, restoreProject);
router.delete('/trash/permanent/:id', authenticateToken, permanentDeleteProject);

module.exports = router;
