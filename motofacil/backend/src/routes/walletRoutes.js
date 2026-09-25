const express = require('express');
const router = express.Router();
const walletController = require('../controllers/walletController');

// Rota de recarga de carteira via Pix
router.post('/recharge', walletController.createRecharge);
router.get('/recharge/:id', walletController.getRechargeStatus);

module.exports = router;
