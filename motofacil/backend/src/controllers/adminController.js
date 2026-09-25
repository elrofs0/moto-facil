const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const env = require('../config/env');
const { asyncHandler } = require('../utils');
const { AppError } = require('../middleware/errorHandler');
const adminActions = require('../services/adminActionsService');
const settingsService = require('../services/settingsService');

// Login simplificado do painel administrativo. Em produção, trocar a
// verificação de senha fixa por uma tabela 'admins' com hash bcrypt por
// usuário — deixado simples aqui para o MVP ter um único administrador.
const login = asyncHandler(async (req, res) => {
  const { password } = req.body;

  const passwordMatches = !!password && await bcrypt.compare(password, env.adminPasswordHash);
  if (!passwordMatches) {
    throw new AppError('Credenciais inválidas', 401);
  }

  const token = jwt.sign({ email: 'admin@motofacil.com' }, env.jwtSecret, { expiresIn: '12h' });

  return res.json({ token });
});



// Faturamento agregado da plataforma — usado na aba de histórico/faturamento do painel.
const getBillingSummary = asyncHandler(async (req, res) => {
  const { from, to } = req.query;
  const summary = await adminActions.getBillingSummary({ from, to });
  res.json(summary);
});

// Modo chuva — liga/desliga o multiplicador de tarifa dinâmica por chuva
// (ver pricingService.js). Persistido no banco (platform_settings), não
// em memória, pra não resetar a cada deploy/restart do servidor.
const getSettings = asyncHandler(async (req, res) => {
  const rainMode = await settingsService.isRainModeOn();
  res.json({ rainMode });
});

const updateRainMode = asyncHandler(async (req, res) => {
  const { rainMode } = req.body;
  await settingsService.setRainMode(!!rainMode);
  res.json({ rainMode: !!rainMode });
});

module.exports = { login, getBillingSummary, getSettings, updateRainMode };
