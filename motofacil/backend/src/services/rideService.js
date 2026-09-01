const { Ride, Driver, sequelize } = require('../models');
const { Op } = require('sequelize');
const geoService = require('./geoService');
const pricingService = require('./pricingService');
const evolutionService = require('./evolutionService');
const walletService = require('./walletService');
const { generateTrackingCode, logger } = require('../utils');
const { AppError } = require('../middleware/errorHandler');

// Quantos motoboys mais próximos recebem a oferta simultaneamente.
// Mandar para vários ao mesmo tempo (e não um por um) reduz o tempo de
// espera do cliente — mas exige a trava atômica em acceptRide() abaixo.
const MAX_DRIVERS_NOTIFIED = 5;
const SEARCH_RADIUS_KM = 8;

async function createRide({ clientId, type, originAddress, destinationAddress, paymentMethod }) {
  const origin = await geoService.geocodeAddress(originAddress);
  const destination = await geoService.geocodeAddress(destinationAddress);

  if (!origin || !destination) {
    throw new AppError('Não conseguimos localizar um dos endereços informados. Pode enviar de outra forma?', 422);
  }

  const distanceKm = await geoService.calculateRouteDistanceKm(
    origin.lat, origin.lng, destination.lat, destination.lng
  );
  const price = pricingService.calculatePrice(distanceKm);
  const { platformFee, driverCommission } = pricingService.calculateCommissionSplit(price);

  const ride = await Ride.create({
    tracking_code: generateTrackingCode(),
    type,
    client_id: clientId,
    status: 'pending_payment',
    origin_address: originAddress,
    origin_lat: origin.lat,
    origin_lng: origin.lng,
    destination_address: destinationAddress,
    destination_lat: destination.lat,
    destination_lng: destination.lng,
    distance_km: distanceKm,
    price,
    platform_fee: platformFee,
    driver_commission: driverCommission,
    payment_method: paymentMethod,
  });

  return ride;
}

// Algoritmo de proximidade: busca motoboys disponíveis, com documentos
// aprovados, e — se o pagamento for em dinheiro — com saldo suficiente
// para cobrir a comissão. Ordena pela distância até o ponto de origem.
async function findNearbyAvailableDrivers(ride) {
  const drivers = await Driver.findAll({
    where: {
      status: 'available',
      documents_approved: true,
      last_lat: { [Op.ne]: null },
      last_lng: { [Op.ne]: null },
    },
  });

  const withDistance = drivers
    .map((driver) => ({
      driver,
      distanceKm: geoService.haversineDistanceKm(
        parseFloat(ride.origin_lat), parseFloat(ride.origin_lng),
        parseFloat(driver.last_lat), parseFloat(driver.last_lng)
      ),
    }))
    .filter((d) => d.distanceKm <= SEARCH_RADIUS_KM)
    .sort((a, b) => a.distanceKm - b.distanceKm);

  const eligible = [];
  for (const item of withDistance) {
    if (ride.payment_method === 'cash') {
      const ok = await walletService.hasSufficientBalanceForCommission(item.driver.id, ride.platform_fee);
      if (!ok) continue;
    }
    eligible.push(item.driver);
    if (eligible.length >= MAX_DRIVERS_NOTIFIED) break;
  }

  return eligible;
}

// Dispara a oferta com botões [Aceitar]/[Recusar] para os motoboys elegíveis.
async function dispatchRideToDrivers(ride) {
  const drivers = await findNearbyAvailableDrivers(ride);

  if (drivers.length === 0) {
    logger.warn(`Nenhum motoboy disponível para a corrida ${ride.tracking_code}`);
    return { notified: 0 };
  }

  await ride.update({ status: 'searching_driver' });

  await Promise.all(
    drivers.map((driver) =>
      evolutionService.sendButtons(
        driver.whatsapp,
        'Nova corrida disponível',
        `${ride.type === 'delivery' ? 'Entrega' : 'Corrida'} de ${ride.distance_km} km\n` +
        `De: ${ride.origin_address}\nPara: ${ride.destination_address}\n` +
        `Você recebe: R$ ${ride.driver_commission}`,
        [
          { id: `accept_ride:${ride.id}`, label: 'Aceitar' },
          { id: `reject_ride:${ride.id}`, label: 'Recusar' },
        ]
      )
    )
  );

  return { notified: drivers.length };
}

// PONTO CRÍTICO: evita que dois motoboys aceitem a mesma corrida ao mesmo
// tempo. O UPDATE só afeta a linha se o status ainda for 'searching_driver'
// — quem chegar primeiro "trava" a corrida; o segundo motoboy recebe 0
// linhas afetadas e sabe que perdeu a corrida, sem precisar de lock manual
// nem de mensageria adicional.
async function acceptRide(rideId, driverId) {
  return sequelize.transaction(async (t) => {
    const [affectedRows] = await Ride.update(
      { driver_id: driverId, status: 'accepted' },
      {
        where: { id: rideId, status: 'searching_driver' },
        transaction: t,
      }
    );

    if (affectedRows === 0) {
      throw new AppError('Essa corrida já foi aceita por outro motoboy.', 409);
    }

    await Driver.update(
      { status: 'busy' },
      { where: { id: driverId }, transaction: t }
    );

    return Ride.findByPk(rideId, { transaction: t });
  });
}

async function completeRide(rideId) {
  const ride = await Ride.findByPk(rideId);
  if (!ride) throw new AppError('Corrida não encontrada', 404);

  await ride.update({ status: 'completed' });
  await Driver.update({ status: 'available' }, { where: { id: ride.driver_id } });

  return ride;
}

module.exports = {
  createRide,
  findNearbyAvailableDrivers,
  dispatchRideToDrivers,
  acceptRide,
  completeRide,
};
