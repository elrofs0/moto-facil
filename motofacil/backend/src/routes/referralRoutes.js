const express = require('express');
const router = express.Router();
const referralController = require('../controllers/referralController');
const authMiddleware = require('../middleware/authMiddleware');

router.use(authMiddleware);
router.get('/', referralController.getSummary);
router.post('/:driverId/pagar', referralController.markAsPaid);

module.exports = router;
