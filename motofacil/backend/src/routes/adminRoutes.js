const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const authMiddleware = require('../middleware/authMiddleware');

router.post('/login', adminController.login);
router.get('/faturamento', authMiddleware, adminController.getBillingSummary);
router.get('/configuracoes', authMiddleware, adminController.getSettings);
router.patch('/configuracoes/chuva', authMiddleware, adminController.updateRainMode);

module.exports = router;
