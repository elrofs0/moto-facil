const express = require('express');
const router = express.Router();
const driverController = require('../controllers/driverController');
const authMiddleware = require('../middleware/authMiddleware');

router.use(authMiddleware);
router.get('/', driverController.listDrivers);
router.post('/:id/aprovar', driverController.approveDriver);
router.patch('/:id/status', driverController.updateDriverStatus);
router.post('/:id/carteira/ajustar', driverController.adjustDriverWallet);
router.get('/:id/carteira/historico', driverController.getDriverWalletHistory);

module.exports = router;
