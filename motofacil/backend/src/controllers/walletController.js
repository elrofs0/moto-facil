const paymentService = require('../services/paymentService');
const { WalletRecharge, Driver } = require('../models');
const { asyncHandler } = require('../utils');
const { AppError } = require('../middleware/errorHandler');

/**
 * Inicia uma recarga de carteira gerando cobrança Pix (Mercado Pago ou Asaas)
 * POST /api/wallet/recharge
 * Body: { driverId, amount }
 */
const createRecharge = asyncHandler(async (req, res) => {
  const { driverId, amount } = req.body;

  if (!driverId || !amount) {
    throw new AppError('Os campos driverId e amount são obrigatórios.', 400);
  }

  const numAmount = parseFloat(amount);
  if (isNaN(numAmount) || numAmount <= 0) {
    throw new AppError('O valor amount deve ser um número positivo maior que zero.', 400);
  }

  const driver = await Driver.findByPk(driverId);
  if (!driver) {
    throw new AppError('Motoboy não encontrado.', 404);
  }

  const recharge = await paymentService.createDriverWalletRecharge(driverId, numAmount);

  res.status(201).json({
    id: recharge.id,
    driverId: recharge.driver_id,
    amount: parseFloat(recharge.amount),
    status: recharge.status,
    provider: recharge.provider,
    pixCopyPaste: recharge.pix_copy_paste,
    pixQrCodeBase64: recharge.pix_qr_code_base64,
    created_at: recharge.created_at,
  });
});

/**
 * Consulta o status de uma recarga específica
 * GET /api/wallet/recharge/:id
 */
const getRechargeStatus = asyncHandler(async (req, res) => {
  const recharge = await WalletRecharge.findByPk(req.params.id);
  if (!recharge) {
    throw new AppError('Recarga não encontrada.', 404);
  }
  res.json(recharge);
});

module.exports = {
  createRecharge,
  getRechargeStatus,
};
