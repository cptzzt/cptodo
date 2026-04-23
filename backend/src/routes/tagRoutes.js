const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const { getTags, createTag, updateTag, deleteTag } = require('../controllers/tagController');

router.get('/', authenticateToken, getTags);
router.post('/', authenticateToken, createTag);
router.put('/:id', authenticateToken, updateTag);
router.delete('/:id', authenticateToken, deleteTag);

module.exports = router;
