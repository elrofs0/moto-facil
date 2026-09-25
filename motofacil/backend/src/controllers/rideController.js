const { Ride, Driver, User } = require('../models');
const rideService = require('../services/rideService');
const { asyncHandler } = require('../utils');
const { AppError } = require('../middleware/errorHandler');

// Usado pelo painel administrativo — monitoramento de corridas ativas.
const listActiveRides = asyncHandler(async (req, res) => {
  const rides = await Ride.findAll({
    where: { status: ['searching_driver', 'accepted', 'in_transit'] },
    include: [
      { model: User, as: 'client', attributes: ['id', 'name', 'whatsapp'] },
      { model: Driver, as: 'driver', attributes: ['id', 'name', 'whatsapp'] },
    ],
    order: [['created_at', 'DESC']],
  });
  res.json(rides);
});

// Usado pelo painel administrativo — aba "Agendamentos": corridas/entregas
// marcadas pra horário futuro, ainda não despachadas (ver
// rideService.sweepScheduledRides). Ordenado pela data agendada, não pela
// criação — o que importa aqui é "o que vem primeiro", não "o que foi
// pedido primeiro".
const listScheduledRides = asyncHandler(async (req, res) => {
  const rides = await Ride.findAll({
    where: { status: 'scheduled' },
    include: [
      { model: User, as: 'client', attributes: ['id', 'name', 'whatsapp'] },
      { model: Driver, as: 'preferredDriver', attributes: ['id', 'name', 'username'] },
    ],
    order: [['scheduled_for', 'ASC']],
  });
  res.json(rides);
});

const listAllRides = asyncHandler(async (req, res) => {
  const { page = 1, limit = 25, status } = req.query;
  const where = status ? { status } : {};

  const { rows, count } = await Ride.findAndCountAll({
    where,
    include: [
      { model: User, as: 'client', attributes: ['id', 'name', 'whatsapp'] },
      { model: Driver, as: 'driver', attributes: ['id', 'name', 'whatsapp'] },
    ],
    order: [['created_at', 'DESC']],
    limit: parseInt(limit, 10),
    offset: (parseInt(page, 10) - 1) * parseInt(limit, 10),
  });

  res.json({ rides: rows, total: count, page: parseInt(page, 10) });
});

const getRideByTrackingCode = asyncHandler(async (req, res) => {
  const ride = await Ride.findOne({
    where: { tracking_code: req.params.trackingCode },
    include: [
      { model: User, as: 'client', attributes: ['id', 'name', 'whatsapp'] },
      { model: Driver, as: 'driver', attributes: ['id', 'name', 'whatsapp'] },
    ],
  });
  if (!ride) throw new AppError('Corrida não encontrada', 404);
  res.json(ride);
});

// O lead já foi cobrado do motoboy no ACEITE da corrida (rideService.
// acceptRide) — concluir pelo painel só fecha o status, sem cobrar nada.
const completeRide = asyncHandler(async (req, res) => {
  const ride = await rideService.completeRide(req.params.id);
  res.json(ride);
});

// Cancelamento manual pelo admin — mesma lógica de estorno/aviso usada pelo
// comando "cancelar" do cliente no WhatsApp (ver rideService.cancelRide).
const cancelRide = asyncHandler(async (req, res) => {
  const ride = await rideService.cancelRide(req.params.id, 'Cancelada pelo administrador.');
  res.json(ride);
});

module.exports = { listActiveRides, listScheduledRides, listAllRides, getRideByTrackingCode, completeRide, cancelRide };
