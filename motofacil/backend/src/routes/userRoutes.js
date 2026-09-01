const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const authMiddleware = require('../middleware/authMiddleware');

router.use(authMiddleware);
router.get('/', userController.listUsers);
router.get('/:id/corridas', userController.getUserRideHistory);
router.patch('/:id/bloquear', userController.toggleBlockUser);

module.exports = router;
