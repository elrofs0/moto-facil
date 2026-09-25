const express = require('express');
const router = express.Router();
const driverController = require('../controllers/driverController');
const authMiddleware = require('../middleware/authMiddleware');

router.use(authMiddleware);
router.get('/', driverController.listDrivers);
router.get('/:id/documentos', driverController.getDriverDocuments);
router.post('/', driverController.createDriver);
router.patch('/:id', driverController.updateDriver);
router.post('/:id/aprovar', driverController.approveDriver);
router.post('/:id/alvara/aprovar', driverController.approveDriverAlvara);
router.post('/:id/alvara/rejeitar', driverController.rejectDriverAlvara);
router.patch('/:id/status', driverController.updateDriverStatus);
router.post('/:id/carteira/ajustar', driverController.adjustDriverWallet);
router.get('/:id/carteira/historico', driverController.getDriverWalletHistory);

module.exports = router;
