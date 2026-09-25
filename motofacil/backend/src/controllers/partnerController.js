const rideService = require('../services/rideService');
const geoService = require('../services/geoService');
const pricingService = require('../services/pricingService');
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

function parsePoint(point) {
  if (!point) return null;
  const lat = Number(point.lat);
  const lng = Number(point.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  return { lat, lng };
}

// Chamado pelo PedidoFácil pra cobrar do cliente o mesmo frete de uma corrida
// MotoFácil (mesma rota, pico e chuva). Cada ponto vem como { lat, lng } ou
// como endereço em texto (geocodificado aqui, com a mesma cadeia do chatbot).
const quoteDelivery = asyncHandler(async (req, res) => {
  const { origin, originAddress, destination, destinationAddress } = req.body;

  const from = parsePoint(origin) || (originAddress ? await geoService.geocodeAddress(String(originAddress)) : null);
  const to = parsePoint(destination) || (destinationAddress ? await geoService.geocodeAddress(String(destinationAddress)) : null);
  if (!from || !to) {
    throw new AppError('Não foi possível localizar a origem ou o destino', 422);
  }

  const route = await geoService.calculateRoute(from.lat, from.lng, to.lat, to.lng);
  const { price, breakdown } = await pricingService.calculatePrice(route.distanceKm, route.durationMin);

  res.json({
    price,
    distanceKm: Math.round(route.distanceKm * 10) / 10,
    durationMin: Math.round(route.durationMin),
    breakdown,
    origin: from,
    destination: to,
  });
});

module.exports = { dispatchDelivery, quoteDelivery };
