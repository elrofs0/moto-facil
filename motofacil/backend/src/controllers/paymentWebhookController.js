const paymentService = require('../services/paymentService');
const { asyncHandler, logger } = require('../utils');
const rideService = require('../services/rideService');

// Webhook do Mercado Pago. Segue a mesma lógica: responde rápido, processa
// depois, e NUNCA confia no corpo da notificação sem revalidar o pagamento
// diretamente na API (feito dentro de paymentService.confirmPaymentFromWebhook).
const receiveWebhook = asyncHandler(async (req, res) => {
  res.status(200).send('ok');

  const paymentId = req.query.id || req.body?.data?.id;
  if (!paymentId) return;

  try {
    const ride = await paymentService.confirmPaymentFromWebhook(paymentId);
    if (ride && ride.payment_status === 'approved' && ride.status === 'searching_driver') {
      await rideService.dispatchRideToDrivers(ride);
    }
  } catch (err) {
    logger.error('Erro processando webhook de pagamento', err);
  }
});

module.exports = { receiveWebhook };
