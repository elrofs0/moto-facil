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

const completeRide = asyncHandler(async (req, res) => {
  const ride = await rideService.completeRide(req.params.id);
  res.json(ride);
});

module.exports = { listActiveRides, listAllRides, getRideByTrackingCode, completeRide };
