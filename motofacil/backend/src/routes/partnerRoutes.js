const express = require('express');
const router = express.Router();
const partnerController = require('../controllers/partnerController');
const partnerAuthMiddleware = require('../middleware/partnerAuthMiddleware');

router.use(partnerAuthMiddleware);
router.post('/dispatch', partnerController.dispatchDelivery);

module.exports = router;
