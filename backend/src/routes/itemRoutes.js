const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const { getItems, createItem, updateItem, deleteItem, addItemTag, removeItemTag } = require('../controllers/itemController');

// 所有接口都需要登录
router.use(authenticateToken);

router.get('/', getItems);
router.post('/', createItem);
router.put('/:id', updateItem);
router.delete('/:id', deleteItem);

// 标签管理
router.post('/:id/tags', addItemTag);
router.delete('/:id/tags/:tag_id', removeItemTag);

module.exports = router;
