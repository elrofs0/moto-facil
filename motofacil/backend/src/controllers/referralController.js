const referralService = require('../services/referralService');
const { asyncHandler } = require('../utils');

// Usado pelo painel administrativo — resumo por indicador (motoboy): total
// pendente, total já pago, e histórico de indicados/corridas que geraram
// comissão.
const getSummary = asyncHandler(async (req, res) => {
  const summary = await referralService.getReferralSummary();
  res.json(summary);
});

// Acerto manual semanal (ex: Pix, fora do sistema) — marca todas as
// comissões pendentes daquele indicador como pagas de uma vez.
const markAsPaid = asyncHandler(async (req, res) => {
  const result = await referralService.markCommissionsAsPaid(req.params.driverId);
  res.json(result);
});

module.exports = { getSummary, markAsPaid };
