const express = require('express');
const router = express.Router();
const rideController = require('../controllers/rideController');
const authMiddleware = require('../middleware/authMiddleware');

router.use(authMiddleware);
router.get('/active', rideController.listActiveRides);
router.get('/agendadas', rideController.listScheduledRides);
router.get('/', rideController.listAllRides);
router.get('/:trackingCode/rastreio', rideController.getRideByTrackingCode);
router.post('/:id/concluir', rideController.completeRide);
router.post('/:id/cancelar', rideController.cancelRide);

module.exports = router;
