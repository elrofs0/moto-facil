const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const authMiddleware = require('../middleware/authMiddleware');

router.post('/login', adminController.login);
router.get('/faturamento', authMiddleware, adminController.getBillingSummary);

module.exports = router;
