const rideService = require('../services/rideService');
const { asyncHandler } = require('../utils');
const { AppError } = require('../middleware/errorHandler');

// Chamado pelo PedidoFácil quando um estabelecimento (plano Completo) não
// tem motoboy próprio disponível — despacha pro pool de motoboys MotoFácil.
// Responde rápido, sem esperar o despacho terminar: o resultado real
// (aceito/cancelado/concluído) chega depois pelo webhook configurado em
// PEDIDOFACIL_WEBHOOK_URL (ver services/partnerWebhookService.js).
const dispatchDelivery = asyncHandler(async (req, res) => {
  const { externalReference, establishmentName, routeDescription, price, originLat, originLng } = req.body;

  if (!externalReference || !establishmentName || !routeDescription || price === undefined) {
    throw new AppError('externalReference, establishmentName, routeDescription e price são obrigatórios', 422);
  }

  const ride = await rideService.createPartnerDelivery({
    source: 'partner',
    externalReference: String(externalReference),
    establishmentName,
    routeDescription,
    price,
    originLat,
    originLng,
  });

  res.status(202).json({ motofacilRideId: ride.id, trackingCode: ride.tracking_code, status: ride.status });
});

module.exports = { dispatchDelivery };
