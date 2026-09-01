const express = require('express');
const router = express.Router();
const evolutionWebhookController = require('../controllers/evolutionWebhookController');
const paymentWebhookController = require('../controllers/paymentWebhookController');

router.post('/evolution', evolutionWebhookController.receiveWebhook);
router.post('/pagamento', paymentWebhookController.receiveWebhook);

module.exports = router;
