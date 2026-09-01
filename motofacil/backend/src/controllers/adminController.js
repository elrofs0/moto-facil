const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const env = require('../config/env');
const { Ride } = require('../models');
const { Op } = require('sequelize');
const { asyncHandler } = require('../utils');
const { AppError } = require('../middleware/errorHandler');

// Login simplificado do painel administrativo. Em produção, trocar a
// verificação de senha fixa por uma tabela 'admins' com hash bcrypt por
// usuário — deixado simples aqui para o MVP ter um único administrador.
const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  const adminEmail = process.env.ADMIN_EMAIL || 'admin@motofacil.com';
  const adminPasswordHash = process.env.ADMIN_PASSWORD_HASH; // gerar com bcrypt na configuração inicial

  if (email !== adminEmail || !adminPasswordHash) {
    throw new AppError('Credenciais inválidas', 401);
  }

  const valid = await bcrypt.compare(password, adminPasswordHash);
  if (!valid) throw new AppError('Credenciais inválidas', 401);

  const token = jwt.sign({ email }, env.jwtSecret, { expiresIn: '12h' });
  res.json({ token });
});

// Faturamento agregado da plataforma — usado na aba de histórico/faturamento do painel.
const getBillingSummary = asyncHandler(async (req, res) => {
  const { from, to } = req.query;
  const where = { status: 'completed', payment_status: 'approved' };
  if (from && to) {
    where.created_at = { [Op.between]: [new Date(from), new Date(to)] };
  }

  const rides = await Ride.findAll({ where });

  const totalRevenue = rides.reduce((sum, r) => sum + parseFloat(r.price), 0);
  const totalPlatformFee = rides.reduce((sum, r) => sum + parseFloat(r.platform_fee || 0), 0);
  const totalDriverPayout = rides.reduce((sum, r) => sum + parseFloat(r.driver_commission || 0), 0);

  res.json({
    totalRides: rides.length,
    totalRevenue: totalRevenue.toFixed(2),
    totalPlatformFee: totalPlatformFee.toFixed(2),
    totalDriverPayout: totalDriverPayout.toFixed(2),
  });
});

module.exports = { login, getBillingSummary };
