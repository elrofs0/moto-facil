const { Driver, Vehicle, WalletTransaction } = require('../models');
const { asyncHandler } = require('../utils');
const { AppError } = require('../middleware/errorHandler');
const walletService = require('../services/walletService');

const listDrivers = asyncHandler(async (req, res) => {
  const { status } = req.query;
  const where = status ? { status } : {};
  const drivers = await Driver.findAll({
    where,
    include: [{ model: Vehicle, as: 'vehicles' }],
    order: [['created_at', 'DESC']],
  });
  res.json(drivers);
});

// Aprovação de cadastro — muda de 'pending_approval' para 'offline'
// (o motoboy precisa se colocar manualmente como disponível depois).
const approveDriver = asyncHandler(async (req, res) => {
  const driver = await Driver.findByPk(req.params.id);
  if (!driver) throw new AppError('Motoboy não encontrado', 404);

  await driver.update({ status: 'offline', documents_approved: true });
  res.json(driver);
});

const updateDriverStatus = asyncHandler(async (req, res) => {
  const { status } = req.body;
  const validStatuses = ['available', 'busy', 'offline', 'blocked'];
  if (!validStatuses.includes(status)) {
    throw new AppError(`Status inválido. Use um de: ${validStatuses.join(', ')}`, 422);
  }

  const driver = await Driver.findByPk(req.params.id);
  if (!driver) throw new AppError('Motoboy não encontrado', 404);

  await driver.update({ status });
  res.json(driver);
});

// Ajuste manual de saldo pelo admin (ex: motoboy fez recarga via Pix fora
// do fluxo automático) — sempre passa pelo walletService para manter o
// histórico auditável.
const adjustDriverWallet = asyncHandler(async (req, res) => {
  const { amount, reason } = req.body;
  if (!amount || !reason) throw new AppError('Informe amount e reason', 422);

  const newBalance = amount > 0
    ? await walletService.creditDriver(req.params.id, amount, reason)
    : await walletService.debitDriver(req.params.id, Math.abs(amount), reason);

  res.json({ balance: newBalance });
});

const getDriverWalletHistory = asyncHandler(async (req, res) => {
  const transactions = await WalletTransaction.findAll({
    where: { driver_id: req.params.id },
    order: [['created_at', 'DESC']],
    limit: 100,
  });
  res.json(transactions);
});

module.exports = {
  listDrivers,
  approveDriver,
  updateDriverStatus,
  adjustDriverWallet,
  getDriverWalletHistory,
};
