const axios = require('axios');
const { logger } = require('../utils');
const env = require('../config/env');

// Cadeia de fallback pensada pra nunca deixar o sistema fora do ar por
// causa de UMA dependência externa: Google Maps (pago, mais preciso,
// usado em produção) → OSRM público (grátis, sem chave) → linha reta
// (Haversine, sempre funciona, só menos precisa). Cada camada é isolada
// para o resto do sistema nunca precisar saber qual delas respondeu.

const OSRM_BASE_URL = process.env.OSRM_BASE_URL || 'https://router.project-osrm.org';

// Retorna { distanceKm, durationMin } — usado tanto para exibir a rota
// quanto para a fórmula de preço dinâmico (pricingService.js), que
// precisa de tempo estimado além da distância.
async function calculateRoute(originLat, originLng, destLat, destLng) {
  if (env.googleMaps.apiKey) {
    const viaGoogle = await calculateRouteGoogle(originLat, originLng, destLat, destLng);
    if (viaGoogle) return viaGoogle;
  }

  const viaOsrm = await calculateRouteOsrm(originLat, originLng, destLat, destLng);
  if (viaOsrm) return viaOsrm;

  logger.warn('Google Maps e OSRM indisponíveis — usando linha reta (Haversine) como último fallback.');
  return {
    distanceKm: haversineDistanceKm(originLat, originLng, destLat, destLng),
    durationMin: estimateDurationFromHaversine(originLat, originLng, destLat, destLng),
    source: 'haversine',
  };
}

// Google Distance Matrix API — um único request já devolve distância e
// tempo estimado considerando trânsito, que é o que a Directions API
// também traria só que com mais dado (polyline) que não usamos aqui.
async function calculateRouteGoogle(originLat, originLng, destLat, destLng) {
  try {
    const { data } = await axios.get('https://maps.googleapis.com/maps/api/distancematrix/json', {
      params: {
        origins: `${originLat},${originLng}`,
        destinations: `${destLat},${destLng}`,
        mode: 'driving',
        units: 'metric',
        key: env.googleMaps.apiKey,
      },
      timeout: 8000,
    });

    const element = data?.rows?.[0]?.elements?.[0];
    if (data.status !== 'OK' || !element || element.status !== 'OK') {
      logger.warn('Google Distance Matrix não retornou rota válida', data.status, element?.status);
      return null;
    }

    return {
      distanceKm: element.distance.value / 1000,
      durationMin: element.duration.value / 60,
      source: 'google',
    };
  } catch (err) {
    logger.warn('Falha ao chamar Google Distance Matrix, caindo para OSRM', err.response?.data || err.message);
    return null;
  }
}

async function calculateRouteOsrm(originLat, originLng, destLat, destLng) {
  try {
    const url = `${OSRM_BASE_URL}/route/v1/driving/${originLng},${originLat};${destLng},${destLat}`;
    const { data } = await axios.get(url, { params: { overview: 'false' }, timeout: 8000 });
    const route = data?.routes?.[0];
    if (!route) return null;
    return {
      distanceKm: route.distance / 1000,
      durationMin: route.duration / 60,
      source: 'osrm',
    };
  } catch (err) {
    logger.warn('Falha ao calcular rota via OSRM', err.message);
    return null;
  }
}

// Mantido exportado à parte — o algoritmo de proximidade (rideService)
// usa Haversine direto pra comparar dezenas de motoboys sem estourar
// limite de requisições de API paga por causa de uma simples ordenação.
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

// Estimativa grosseira de tempo quando nem Google nem OSRM responderam —
// assume velocidade média urbana de moto (25 km/h). É só o último degrau
// do fallback, então não precisa ser precisa, precisa é sempre existir.
function estimateDurationFromHaversine(lat1, lon1, lat2, lon2) {
  const AVERAGE_SPEED_KMH = 25;
  const km = haversineDistanceKm(lat1, lon1, lat2, lon2);
  return (km / AVERAGE_SPEED_KMH) * 60;
}

// Geocodificação: Google Geocoding API quando há chave configurada (mais
// preciso e consistente com o Distance Matrix), Nominatim como fallback
// gratuito sem chave.
// Cliente compartilhou localização (pino ou tempo real) em vez de digitar
// endereço — vem como link do Maps (ver conversationFlow.handleClientLocation).
// Extrai a coordenada direto, sem geocodificar nada: impossível de "não
// encontrar" porque não depende de nenhum serviço externo.
const SHARED_LOCATION_PATTERN = /^https:\/\/maps\.google\.com\/\?q=(-?\d+\.?\d*),(-?\d+\.?\d*)$/;

async function geocodeAddress(addressText) {
  const sharedLocation = addressText.match(SHARED_LOCATION_PATTERN);
  if (sharedLocation) {
    return { lat: parseFloat(sharedLocation[1]), lng: parseFloat(sharedLocation[2]) };
  }

  if (env.googleMaps.apiKey) {
    const viaGoogle = await geocodeGoogle(addressText);
    if (viaGoogle) return viaGoogle;
  }
  return geocodeNominatim(addressText);
}

async function geocodeGoogle(addressText) {
  try {
    const { data } = await axios.get('https://maps.googleapis.com/maps/api/geocode/json', {
      params: {
        address: `${addressText}, Santa Maria, RS, Brasil`,
        key: env.googleMaps.apiKey,
      },
      timeout: 8000,
    });
    const location = data?.results?.[0]?.geometry?.location;
    if (data.status !== 'OK' || !location) return null;
    return { lat: location.lat, lng: location.lng };
  } catch (err) {
    logger.warn('Falha na geocodificação via Google, caindo para Nominatim', err.response?.data || err.message);
    return null;
  }
}

async function geocodeNominatim(addressText) {
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
    if (!data || data.length === 0) {
      logger.warn(`Nominatim não encontrou resultado para o endereço: "${addressText}"`);
      return null;
    }
    return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
  } catch (err) {
    logger.error('Falha na geocodificação do endereço (Nominatim)', err.message);
    return null;
  }
}

// Soma a distância/duração de cada trecho em ordem (origem → parada 1 →
// parada 2 → ... → destino), reaproveitando calculateRoute() pra cada
// trecho — mantém a mesma cadeia de fallback (Google → OSRM → linha reta)
// em cada perna da viagem, sem precisar de uma API de rota multi-parada
// (Distance Matrix não suporta; só a Directions API do Google suportaria,
// e não vale trocar tudo só por causa disso). `points` é uma lista
// ordenada de { lat, lng } com pelo menos 2 itens.
async function calculateMultiStopRoute(points) {
  let distanceKm = 0;
  let durationMin = 0;

  for (let i = 0; i < points.length - 1; i++) {
    const leg = await calculateRoute(points[i].lat, points[i].lng, points[i + 1].lat, points[i + 1].lng);
    distanceKm += leg.distanceKm;
    durationMin += leg.durationMin;
  }

  return { distanceKm, durationMin };
}

// Mantida por compatibilidade com quem já chamava só a distância
// (rideService usa calculateRoute agora, que também traz duração).
async function calculateRouteDistanceKm(originLat, originLng, destLat, destLng) {
  const route = await calculateRoute(originLat, originLng, destLat, destLng);
  return route.distanceKm;
}

// Distância/tempo de VÁRIOS motoboys ao mesmo tempo, num único request —
// usa a Table Service do OSRM (gratuita, sem chave), que calcula rota de
// rua de verdade (curvas, mão única, etc.), não linha reta. Isso é o que
// o rideService usa pra decidir qual motoboy está "mais perto" de
// verdade, não só em distância de pássaro.
//
// destinations: [{ id, lat, lng }, ...] — o `id` é livre (ex: driver.id),
// só pra você conseguir casar cada resultado com o motoboy certo depois.
// Retorna um Map: id -> { distanceKm, durationMin } | null (null se essa
// rota específica não pôde ser calculada, ex: ilha sem ponte no mapa).
async function calculateDistanceMatrix(origin, destinations) {
  if (destinations.length === 0) return new Map();

  try {
    const coords = [`${origin.lng},${origin.lat}`, ...destinations.map((d) => `${d.lng},${d.lat}`)].join(';');
    const destIndexes = destinations.map((_, i) => i + 1).join(';');

    const { data } = await axios.get(`${OSRM_BASE_URL}/table/v1/driving/${coords}`, {
      params: { sources: '0', destinations: destIndexes, annotations: 'distance,duration' },
      timeout: 8000,
    });

    if (data.code !== 'Ok') throw new Error(`OSRM table retornou: ${data.code}`);

    const result = new Map();
    destinations.forEach((dest, i) => {
      const distanceM = data.distances?.[0]?.[i];
      const durationS = data.durations?.[0]?.[i];
      result.set(
        dest.id,
        distanceM != null && durationS != null
          ? { distanceKm: distanceM / 1000, durationMin: durationS / 60 }
          : null
      );
    });
    return result;
  } catch (err) {
    logger.warn('Falha na matriz de distância via OSRM, caindo para linha reta por motoboy', err.message);
    const result = new Map();
    destinations.forEach((dest) => {
      result.set(dest.id, {
        distanceKm: haversineDistanceKm(origin.lat, origin.lng, dest.lat, dest.lng),
        durationMin: estimateDurationFromHaversine(origin.lat, origin.lng, dest.lat, dest.lng),
      });
    });
    return result;
  }
}

module.exports = {
  calculateRoute,
  calculateMultiStopRoute,
  calculateDistanceMatrix,
  calculateRouteDistanceKm,
  haversineDistanceKm,
  geocodeAddress,
};
