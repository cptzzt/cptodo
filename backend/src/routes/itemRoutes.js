const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const { getItems, createItem, updateItem, deleteItem } = require('../controllers/itemController');

// 所有接口都需要登录
router.use(authenticateToken);

router.get('/', getItems);
router.post('/', createItem);
router.put('/:id', updateItem);
router.delete('/:id', deleteItem);

module.exports = router;
