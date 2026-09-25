const env = require('../config/env');
const settingsService = require('./settingsService');

// Precificação dinâmica: Tarifa Base + (KM × valor/KM) + (Minutos × valor/min),
// multiplicada pelo fator de horário de pico e, se o admin ligou o modo
// chuva no painel, também pelo fator de chuva. Os dois multiplicadores
// SE ACUMULAM (ex: pico + chuva = 1.3 × 1.15) porque na prática são
// exatamente as horas em que a demanda mais aperta ao mesmo tempo.
const PEAK_WINDOWS = [
  { startMin: 11 * 60 + 30, endMin: 13 * 60 + 30 }, // 11:30–13:30
  { startMin: 17 * 60 + 30, endMin: 19 * 60 + 30 }, // 17:30–19:30
];

// O servidor roda em UTC; os horários de pico são de Brasília. getHours()
// sozinho aplicava o pico 3h adiantado (08:30–10:30 e 14:30–16:30).
const BRAZIL_TIME = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/Sao_Paulo', hour: 'numeric', minute: 'numeric', hourCycle: 'h23',
});

function minutesOfDayInBrazil(date) {
  const parts = BRAZIL_TIME.formatToParts(date);
  const get = (type) => parseInt(parts.find((p) => p.type === type).value, 10);
  return get('hour') * 60 + get('minute');
}

function isPeakHour(date = new Date()) {
  const minutesOfDay = minutesOfDayInBrazil(date);
  return PEAK_WINDOWS.some((w) => minutesOfDay >= w.startMin && minutesOfDay <= w.endMin);
}

// distanceKm e durationMin vêm do geoService (rota real, não linha reta).
// `at` permite simular preço em outro horário (ex: painel admin mostrando
// prévia); por padrão usa o momento atual.
async function calculatePrice(distanceKm, durationMin, { at = new Date() } = {}) {
  const raw = env.pricing.base + env.pricing.perKm * distanceKm + env.pricing.perMin * durationMin;

  let multiplier = 1;
  const peak = isPeakHour(at);
  if (peak) multiplier *= env.pricing.peakMultiplier;

  const raining = await settingsService.isRainModeOn();
  if (raining) multiplier *= env.pricing.rainMultiplier;

  const price = Math.max(Math.round(raw * multiplier * 100) / 100, env.pricing.minimum);

  return {
    price,
    breakdown: {
      base: env.pricing.base,
      distanceCost: Math.round(env.pricing.perKm * distanceKm * 100) / 100,
      timeCost: Math.round(env.pricing.perMin * durationMin * 100) / 100,
      peakApplied: peak,
      rainApplied: raining,
      multiplier: Math.round(multiplier * 100) / 100,
    },
  };
}

module.exports = { calculatePrice, isPeakHour };
