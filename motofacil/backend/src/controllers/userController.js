const { User, Ride } = require('../models');
const { asyncHandler } = require('../utils');
const { AppError } = require('../middleware/errorHandler');

const listUsers = asyncHandler(async (req, res) => {
  const users = await User.findAll({ order: [['created_at', 'DESC']] });
  res.json(users);
});

const getUserRideHistory = asyncHandler(async (req, res) => {
  const user = await User.findByPk(req.params.id);
  if (!user) throw new AppError('Usuário não encontrado', 404);

  const rides = await Ride.findAll({
    where: { client_id: req.params.id },
    order: [['created_at', 'DESC']],
  });

  res.json({ user, rides });
});

const toggleBlockUser = asyncHandler(async (req, res) => {
  const user = await User.findByPk(req.params.id);
  if (!user) throw new AppError('Usuário não encontrado', 404);

  await user.update({ is_blocked: !user.is_blocked });
  res.json(user);
});

module.exports = { listUsers, getUserRideHistory, toggleBlockUser };
