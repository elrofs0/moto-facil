const env = require('../config/env');

// Precificação simples e transparente: valor base + valor por KM.
// Mantido isolado para facilitar ajuste de tarifa dinâmica (horário de
// pico, chuva, etc.) no futuro sem tocar no resto do fluxo de corrida.
function calculatePrice(distanceKm) {
  const price = env.pricing.base + env.pricing.perKm * distanceKm;
  return Math.round(price * 100) / 100;
}

function calculateCommissionSplit(price) {
  const platformFee = Math.round(price * (env.pricing.platformCommissionPercent / 100) * 100) / 100;
  const driverCommission = Math.round((price - platformFee) * 100) / 100;
  return { platformFee, driverCommission };
}

module.exports = { calculatePrice, calculateCommissionSplit };
