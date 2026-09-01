const express = require('express');
const router = express.Router();

router.use('/webhooks', require('./webhookRoutes'));
router.use('/rides', require('./rideRoutes'));
router.use('/drivers', require('./driverRoutes'));
router.use('/users', require('./userRoutes'));
router.use('/admin', require('./adminRoutes'));

router.get('/health', (req, res) => res.json({ status: 'ok' }));

module.exports = router;
