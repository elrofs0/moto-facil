const axios = require('axios');
const { logger } = require('../utils');
const env = require('../config/env');

// Usa OSRM (Open Source Routing Machine) público para calcular distância
// por rota real (não linha reta), sem custo por chamada — diferente do
// Google Distance Matrix, que cobra por requisição e pesa em volume alto.
// Se quiser trocar por uma instância própria do OSRM depois (recomendado
// em produção, para não depender do servidor demo público), basta trocar
// OSRM_BASE_URL.
const OSRM_BASE_URL = process.env.OSRM_BASE_URL || 'https://router.project-osrm.org';

async function calculateRouteDistanceKm(originLat, originLng, destLat, destLng) {
  try {
    const url = `${OSRM_BASE_URL}/route/v1/driving/${originLng},${originLat};${destLng},${destLat}`;
    const { data } = await axios.get(url, { params: { overview: 'false' }, timeout: 8000 });
    const meters = data?.routes?.[0]?.distance;
    if (!meters) throw new Error('Rota não encontrada pelo OSRM');
    return meters / 1000;
  } catch (err) {
    logger.warn('Falha ao calcular rota via OSRM, usando distância em linha reta como fallback', err.message);
    return haversineDistanceKm(originLat, originLng, destLat, destLng);
  }
}

// Fallback simples caso o serviço de rota esteja indisponível — garante
// que o sistema nunca trava por dependência externa fora do ar.
function haversineDistanceKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Geocodificação de endereço em texto para coordenadas, via Nominatim
// (OpenStreetMap) — gratuito, com limite de uso justo (1 req/s). Em maior
// escala, considerar um provedor pago só para geocodificação (mais barato
// que Google Maps para esse uso específico).
async function geocodeAddress(addressText) {
  try {
    const { data } = await axios.get('https://nominatim.openstreetmap.org/search', {
      params: {
        q: `${addressText}, Santa Maria, RS, Brasil`,
        format: 'json',
        limit: 1,
      },
      headers: { 'User-Agent': 'MotoFacil/1.0' },
      timeout: 8000,
    });
    if (!data || data.length === 0) return null;
    return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
  } catch (err) {
    logger.error('Falha na geocodificação do endereço', err.message);
    return null;
  }
}

module.exports = { calculateRouteDistanceKm, haversineDistanceKm, geocodeAddress };
