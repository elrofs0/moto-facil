const { Ride, Driver, User, sequelize } = require('../models');
const { Op } = require('sequelize');
const geoService = require('./geoService');
const pricingService = require('./pricingService');
const evolutionService = require('./evolutionService');
const walletService = require('./walletService');
const referralService = require('./referralService');
const conversationState = require('./conversationStateService');
const partnerWebhookService = require('./partnerWebhookService');
const env = require('../config/env');
const { generateTrackingCode, logger } = require('../utils');
const { AppError } = require('../middleware/errorHandler');

// MODELO DE MONETIZAÇÃO: o cliente paga o motoboy DIRETO (dinheiro ou Pix
// pessoal dele) — esse dinheiro nunca passa pela MotoFácil. A plataforma
// cobra do motoboy um valor FIXO por lead (corrida aceita), debitado do
// saldo pré-pago dele (recarregado via Pix, ver paymentService.js). Saldo
// insuficiente = ele simplesmente não aparece na lista de quem recebe
// ofertas, e se tentar aceitar mesmo assim, o débito falha e a corrida
// não é dele.
//
// `price` na tabela Ride é só o valor de REFERÊNCIA que o cliente vê e
// paga ao motoboy — não é dinheiro que circula pela plataforma.

const MAX_DRIVERS_NOTIFIED = 5;
const SEARCH_RADIUS_KM = 8;

// Geocodifica + calcula rota + calcula preço SEM gravar nada no banco —
// usado pelo chatbot pra mostrar o valor ao cliente (estilo 99/Uber) antes
// de pedir confirmação e forma de pagamento. O resultado fica guardado no
// estado da conversa e é repassado pra createRide depois, pra nunca
// geocodificar/calcular rota duas vezes pela mesma corrida (evitaria pagar
// a chamada do Google Maps em dobro, se a chave estiver configurada).
// stopAddresses: endereços das paradas intermediárias, em ordem (sem
// contar origem/destino) — lista vazia/omitida = corrida direta, igual
// antes.
// AppError com `addressField` ('origin'|'stop'|'destination') e, se for
// parada, `stopIndex` — pra quem chamar saber EXATAMENTE qual endereço
// não foi encontrado e re-pedir só ele, sem derrubar os outros que já
// tinham geocodificado certo.
function addressNotFoundError(addressField, stopIndex) {
  const err = new AppError('Não conseguimos localizar um dos endereços informados. Pode enviar de outra forma?', 422);
  err.addressField = addressField;
  if (stopIndex !== undefined) err.stopIndex = stopIndex;
  return err;
}

async function quoteRide({ originAddress, destinationAddress, stopAddresses = [] }) {
  const origin = await geoService.geocodeAddress(originAddress);
  if (!origin) {
    throw addressNotFoundError('origin');
  }

  const stops = [];
  for (let i = 0; i < stopAddresses.length; i++) {
    const geocoded = await geoService.geocodeAddress(stopAddresses[i]);
    if (!geocoded) {
      throw addressNotFoundError('stop', i);
    }
    stops.push({ address: stopAddresses[i], lat: geocoded.lat, lng: geocoded.lng });
  }

  const destination = await geoService.geocodeAddress(destinationAddress);
  if (!destination) {
    throw addressNotFoundError('destination');
  }

  const route = await geoService.calculateMultiStopRoute([origin, ...stops, destination]);
  const { price } = await pricingService.calculatePrice(route.distanceKm, route.durationMin);

  return { origin, stops, destination, route, price };
}

async function createRide({ clientId, type, originAddress, destinationAddress, paymentMethod, quote, driverGenderPreference, preferredDriverId, scheduledFor }) {
  const { origin, stops, destination, route, price } = quote;

  const ride = await Ride.create({
    tracking_code: generateTrackingCode(),
    type,
    client_id: clientId,
    // Corrida agendada nasce como 'scheduled' e só vira 'searching_driver'
    // quando a varredura periódica decidir que chegou a hora de despachar
    // (ver sweepScheduledRides) — o preço já foi travado agora, na cotação,
    // não é recalculado lá na frente. Sem agendamento, vai direto pra busca
    // de motoboy — não existe cobrança de gateway pra corrida nenhuma, o
    // cliente paga o motoboy direto.
    status: scheduledFor ? 'scheduled' : 'searching_driver',
    scheduled_for: scheduledFor || null,
    dispatch_started_at: scheduledFor ? null : new Date(),
    origin_address: originAddress,
    origin_lat: origin.lat,
    origin_lng: origin.lng,
    destination_address: destinationAddress,
    destination_lat: destination.lat,
    destination_lng: destination.lng,
    stops: stops.length > 0 ? stops : null,
    // Só relevante pra passageiro — em entrega isso sempre chega null.
    driver_gender_preference: driverGenderPreference || null,
    // Motoboy escolhido pelo @ — a oferta exclusiva a ele é feita depois,
    // por quem chamar createRide (ver offerRideToPreferredDriver).
    preferred_driver_id: preferredDriverId || null,
    distance_km: route.distanceKm,
    price,
    payment_method: paymentMethod,
  });

  return ride;
}

// Entrega pedida por um sistema parceiro (hoje só o PedidoFácil, via
// POST /api/partners/dispatch), não por um cliente MotoFácil — sem
// geocodificação nem cálculo de preço aqui, o parceiro já manda tudo
// pronto (ele mesmo cobra o estabelecimento, o MotoFácil só cobra o
// motoboy pelo lead, igual a qualquer outra corrida).
// Idempotente por (source, external_reference): reenvio do parceiro por
// timeout de rede não cria uma entrega duplicada.
async function createPartnerDelivery({ source, externalReference, establishmentName, routeDescription, price, originLat, originLng }) {
  const existing = await Ride.findOne({ where: { source, external_reference: externalReference } });
  if (existing) return existing;

  const ride = await Ride.create({
    tracking_code: generateTrackingCode(),
    type: 'delivery',
    client_id: null,
    source,
    external_reference: externalReference,
    partner_establishment_name: establishmentName,
    status: 'searching_driver',
    dispatch_started_at: new Date(),
    origin_address: routeDescription,
    origin_lat: originLat || null,
    origin_lng: originLng || null,
    destination_address: routeDescription,
    price,
  });

  // Não espera o despacho terminar (pode mandar WhatsApp pra vários
  // motoboys) — o parceiro só precisa do id na hora; o resultado real
  // chega depois pelo webhook (ver partnerWebhookService).
  dispatchRideToDrivers(ride).catch((err) =>
    logger.error(`Falha ao despachar entrega de parceiro ${ride.tracking_code}`, err.message)
  );

  return ride;
}

// "De: X → Parada: Y → Para: Z" — o motoboy precisa ver o trajeto
// completo antes de aceitar, não só origem/destino direto.
function buildRouteLine(ride) {
  // Entrega de parceiro (ver createPartnerDelivery) não tem origem/destino
  // separados — o parceiro manda a rota já descrita em texto livre, sem
  // geocodificar nada aqui.
  if (ride.source === 'partner') return ride.origin_address;

  const parts = [`De: ${ride.origin_address}`];
  if (ride.stops && ride.stops.length > 0) {
    ride.stops.forEach((stop) => parts.push(`Parada: ${stop.address}`));
  }
  parts.push(`Para: ${ride.destination_address}`);
  return parts.join(' → ');
}

// Texto da oferta — igual pro motoboy preferido (oferta exclusiva) e pra
// busca automática (broadcast), pra nunca divergir entre os dois casos.
function buildOfferMessage(ride) {
  const netAmount = (parseFloat(ride.price) - env.leadFee.amount).toFixed(2);
  const partnerLine = ride.partner_establishment_name
    ? `📦 Entrega via PedidoFácil — ${ride.partner_establishment_name}\n`
    : '';
  const distanceLine = ride.distance_km ? ` de ${ride.distance_km} km` : '';
  const paymentLine = ride.payment_method
    ? `Cliente paga: R$ ${ride.price} (${paymentMethodLabel(ride.payment_method)})\n`
    : `Valor da entrega: R$ ${ride.price}\n`;
  return `${partnerLine}${ride.type === 'passenger' ? 'Corrida de passageiro (mototáxi)' : 'Entrega'}${distanceLine}\n` +
    `${buildRouteLine(ride)}\n` +
    `${paymentLine}` +
    `Custo do lead se você aceitar: R$ ${env.leadFee.amount.toFixed(2)}\n` +
    `💰 Você recebe: R$ ${netAmount} líquido\n\n1 - Aceitar\n2 - Recusar`;
}

// Motoboy responde "1"/"2" em texto puro — NÃO botão nativo do WhatsApp.
// Botão interativo (sendButtons) chegou a funcionar no nível de protocolo
// (confirmado DELIVERY_ACK pela própria Evolution API), mas o Baileys
// embrulha esse tipo de mensagem em viewOnceMessage, o que é conhecido por
// impedir o botão de renderizar em vários clientes do WhatsApp (só
// contas oficiais da Business API têm garantia disso funcionar). Texto
// puro é o padrão usado em todo o resto do bot — guarda o estado de
// "aguardando resposta" pra saber a qual corrida a resposta se refere, já
// que texto puro não carrega o ID da corrida do jeito que o buttonId carregava.
async function sendRideOfferMessage(driver, ride, message) {
  await evolutionService.sendText(driver.whatsapp, `*Nova corrida disponível*\n\n${message}`);
  await conversationState.setState(driver.whatsapp, {
    step: 'DRIVER_RIDE_OFFER_RESPONSE',
    rideId: ride.id,
    driverId: driver.id,
  });
}

function isDriverEligibleForRideType(driver, rideType) {
  if (rideType === 'passenger') {
    return driver.atende_passageiro === true && driver.autorizadoPrefeitura === true;
  }
  return driver.atende_entregas === true;
}

// Algoritmo de proximidade em duas etapas:
// 1. Filtro rápido por linha reta (Haversine) — barato, sem chamada de
//    rede, só pra reduzir a lista de "todo mundo disponível" a um punhado
//    de candidatos plausíveis dentro do raio de busca.
// 2. Distância de RUA de verdade (OSRM Table Service, curvas e tudo) só
//    pros candidatos que sobraram do filtro — decide a ordem final de
//    quem é chamado primeiro. Uma chamada só, pra todos de uma vez.
//
// Só entram na lista motoboys com saldo pra cobrir o lead fee — sem isso,
// eles receberiam a oferta e descobririam "sem saldo" só na hora de aceitar.
async function findNearbyAvailableDrivers(ride) {
  const alreadyNotified = ride.notified_driver_ids || [];

  const drivers = await Driver.findAll({
    where: {
      status: 'available',
      documents_approved: true,
      last_lat: { [Op.ne]: null },
      last_lng: { [Op.ne]: null },
      // Nunca manda a mesma oferta duas vezes pro mesmo motoboy — importante
      // pra quando a corrida recua (recusa ou timeout) e tenta de novo.
      ...(alreadyNotified.length > 0 ? { id: { [Op.notIn]: alreadyNotified } } : {}),
    },
  });

  const eligible = drivers
    .filter((driver) => isDriverEligibleForRideType(driver, ride.type))
    // Filtro de uma via só: cliente mulher pode pedir só motogirl: motoboy
    // homem nunca filtra por gênero da cliente (não existe o inverso).
    .filter((driver) => !ride.driver_gender_preference || driver.gender === ride.driver_gender_preference)
    .filter((driver) => parseFloat(driver.wallet_balance) >= env.leadFee.amount);

  // Entrega de parceiro sem coordenada de origem (ver createPartnerDelivery
  // — o parceiro não geocodifica nada do lado dele) — sem como calcular
  // proximidade, oferece pros elegíveis que esperam há mais tempo, até o
  // limite de notificados por vez.
  if (!ride.origin_lat || !ride.origin_lng) {
    return eligible
      .sort((a, b) => new Date(a.updated_at) - new Date(b.updated_at))
      .slice(0, MAX_DRIVERS_NOTIFIED);
  }

  const origin = { lat: parseFloat(ride.origin_lat), lng: parseFloat(ride.origin_lng) };

  const candidates = eligible
    .map((driver) => ({
      driver,
      straightLineKm: geoService.haversineDistanceKm(
        origin.lat, origin.lng,
        parseFloat(driver.last_lat), parseFloat(driver.last_lng)
      ),
    }))
    // raio um pouco mais largo que o final, porque rota de rua real quase
    // sempre é maior que a linha reta (curvas, mão única, rios, etc.)
    .filter((c) => c.straightLineKm <= SEARCH_RADIUS_KM * 1.4)
    .sort((a, b) => a.straightLineKm - b.straightLineKm)
    .slice(0, 15); // no máximo 15 vão pro cálculo de rota real, por custo

  if (candidates.length === 0) return [];

  const matrix = await geoService.calculateDistanceMatrix(
    origin,
    candidates.map((c) => ({ id: c.driver.id, lat: parseFloat(c.driver.last_lat), lng: parseFloat(c.driver.last_lng) }))
  );

  return candidates
    .map((c) => ({ driver: c.driver, route: matrix.get(c.driver.id) }))
    .filter((c) => c.route && c.route.distanceKm <= SEARCH_RADIUS_KM)
    .sort((a, b) => a.route.distanceKm - b.route.distanceKm)
    .slice(0, MAX_DRIVERS_NOTIFIED)
    .map((c) => c.driver);
}

// Dispara a oferta com botões [Aceitar]/[Recusar] para os motoboys elegíveis.
async function dispatchRideToDrivers(ride) {
  const drivers = await findNearbyAvailableDrivers(ride);

  if (drivers.length === 0) {
    logger.warn(`Nenhum motoboy disponível/habilitado/com saldo para a corrida ${ride.tracking_code} (tipo: ${ride.type})`);
    return { notified: 0 };
  }

  const message = buildOfferMessage(ride);

  await Promise.all(drivers.map((driver) => sendRideOfferMessage(driver, ride, message)));

  await ride.update({
    notified_driver_ids: [...(ride.notified_driver_ids || []), ...drivers.map((d) => d.id)],
  });

  return { notified: drivers.length };
}

// Motoboy escolhido pelo @ — checa os MESMOS critérios do broadcast, só
// que a preferência de "só motogirl" NUNCA se aplica aqui de propósito:
// escolha explícita por @ sobrepõe essa preferência (decisão combinada).
function isDriverEligibleForPreferredOffer(driver, ride) {
  if (!driver) return false;
  if (driver.status !== 'available') return false;
  if (!driver.documents_approved) return false;
  if (!isDriverEligibleForRideType(driver, ride.type)) return false;
  if (parseFloat(driver.wallet_balance) < env.leadFee.amount) return false;
  return true;
}

// Distância de verdade (não só linha reta) entre o motoboy escolhido e a
// origem da corrida — mesmo raio usado no broadcast (SEARCH_RADIUS_KM).
async function isDriverWithinRange(driver, ride) {
  if (driver.last_lat == null || driver.last_lng == null) return false;

  const origin = { lat: parseFloat(ride.origin_lat), lng: parseFloat(ride.origin_lng) };
  const straightLineKm = geoService.haversineDistanceKm(
    origin.lat, origin.lng, parseFloat(driver.last_lat), parseFloat(driver.last_lng)
  );
  if (straightLineKm > SEARCH_RADIUS_KM * 1.4) return false;

  const route = await geoService.calculateRoute(origin.lat, origin.lng, parseFloat(driver.last_lat), parseFloat(driver.last_lng));
  return route.distanceKm <= SEARCH_RADIUS_KM;
}

async function findDriverByUsername(username) {
  return Driver.findOne({ where: { username: username.toLowerCase() } });
}

// Manda a oferta SÓ pro motoboy preferido (exclusiva, sem broadcast pros
// outros ainda). preferred_driver_offered_at marca o início da janela de
// espera que a varredura periódica (sweepExpiredPreferredOffers) usa.
//
// De propósito NÃO mexe em notified_driver_ids aqui: se ele só deixar o
// prazo estourar (sem recusar), ele continua elegível pro broadcast
// automático depois — só uma recusa EXPLÍCITA (rejectRide) o exclui de
// vez. notified_driver_ids serve só pra evitar reenviar a MESMA oferta de
// broadcast duas vezes pro mesmo motoboy.
async function offerRideToPreferredDriver(ride, driver) {
  await sendRideOfferMessage(driver, ride, buildOfferMessage(ride));

  await ride.update({
    preferred_driver_id: driver.id,
    preferred_driver_offered_at: new Date(),
  });
}

// Encerra a janela de exclusividade do motoboy preferido (recusa, timeout
// ou inelegibilidade) e despacha pra busca automática entre os outros —
// notified_driver_ids garante que ele (e qualquer um que já tenha
// recusado antes) não recebe a mesma oferta de novo.
async function fallbackToBroadcast(rideId) {
  const ride = await Ride.findByPk(rideId);
  if (!ride || ride.status !== 'searching_driver') return { notified: 0 };

  if (ride.preferred_driver_offered_at) {
    await ride.update({ preferred_driver_offered_at: null });
    await ride.reload();
  }

  return dispatchRideToDrivers(ride);
}

// Motoboy clicou em [Recusar] — vale tanto pro preferido (fecha a janela
// de exclusividade na hora, sem esperar os 2 min) quanto pra qualquer um
// no broadcast normal (exclui ele e tenta achar mais alguém disponível).
async function rejectRide(rideId, driverId) {
  const ride = await Ride.findByPk(rideId);
  if (!ride || ride.status !== 'searching_driver') return { fellBackToBroadcast: false };

  const alreadyNotified = ride.notified_driver_ids || [];
  if (!alreadyNotified.includes(driverId)) {
    await ride.update({ notified_driver_ids: [...alreadyNotified, driverId] });
  }

  const result = await fallbackToBroadcast(rideId);
  return { fellBackToBroadcast: true, notified: result.notified };
}

// Varredura periódica (chamada a cada 30s a partir de server.js) — busca
// corridas cujo motoboy preferido não respondeu dentro do prazo e derruba
// a exclusividade, caindo pra busca automática. Roda contra o banco (não
// um timer solto na memória), então sobrevive a reinício do backend.
const PREFERRED_DRIVER_TIMEOUT_MIN = 2;

async function sweepExpiredPreferredOffers() {
  const cutoff = new Date(Date.now() - PREFERRED_DRIVER_TIMEOUT_MIN * 60 * 1000);

  const expiredRides = await Ride.findAll({
    where: {
      status: 'searching_driver',
      preferred_driver_offered_at: { [Op.ne]: null, [Op.lte]: cutoff },
    },
  });

  for (const ride of expiredRides) {
    logger.info(`Corrida ${ride.tracking_code}: motoboy preferido não respondeu em ${PREFERRED_DRIVER_TIMEOUT_MIN} min — caindo pra busca automática.`);
    await fallbackToBroadcast(ride.id);
  }
}

// Corrida em "searching_driver" sem motoboy preferido pendente (isso já é
// coberto por sweepExpiredPreferredOffers) e sem ninguém disponível: sem
// isso, ficava presa pra sempre, sem NENHUM aviso ao cliente na maioria dos
// fluxos. A cada varredura, tenta redespachar de novo (pode ter aparecido
// motoboy disponível nesse meio-tempo — dispatchRideToDrivers já ignora
// quem já foi notificado, então isso nunca reenvia oferta duplicada) até um
// prazo máximo, quando então cancela sozinha e avisa o cliente.
const MAX_SEARCH_MINUTES = 30;

async function sweepStaleSearchingRides() {
  const cutoff = new Date(Date.now() - MAX_SEARCH_MINUTES * 60 * 1000);

  const staleRides = await Ride.findAll({
    where: {
      status: 'searching_driver',
      preferred_driver_offered_at: null,
    },
    include: [{ model: User, as: 'client' }],
  });

  for (const ride of staleRides) {
    // dispatch_started_at deveria estar sempre preenchido pra uma corrida em
    // searching_driver (createRide já seta, sweepScheduledRides também) —
    // esse fallback é só defensivo, pra nunca tratar null como "infinitamente
    // velha" (null <= cutoff é true em JS) e cancelar na hora por engano.
    const referenceTime = ride.dispatch_started_at || ride.created_at;
    if (referenceTime <= cutoff) {
      await ride.update({
        status: 'cancelled',
        cancelled_reason: `Nenhum motoboy disponível — cancelada automaticamente após ${MAX_SEARCH_MINUTES} min.`,
      });
      logger.info(`Corrida ${ride.tracking_code}: cancelada automaticamente após ${MAX_SEARCH_MINUTES} min sem motoboy disponível.`);
      if (ride.client) {
        const tipo = ride.type === 'delivery' ? 'entrega' : 'corrida';
        await evolutionService.sendText(
          ride.client.whatsapp,
          `Não encontramos nenhum motoboy disponível pra sua ${tipo} (${ride.tracking_code}) e cancelamos automaticamente. Pode tentar de novo quando quiser.`
        );
      }
      partnerWebhookService.notifyPartner(ride, 'cancelled');
    } else {
      await dispatchRideToDrivers(ride);
    }
  }
}

// Inicia a busca de motoboy pra uma corrida — motoboy preferido primeiro
// (se escolhido), com fallback pra busca automática. Extraído do fluxo de
// criação imediata (era só chamado de dentro do chatbot) pra também poder
// ser chamado pela varredura de corridas agendadas (sweepScheduledRides),
// que roda em background, sem nenhuma conversa em andamento.
async function dispatchOrOfferRide(ride) {
  const client = await User.findByPk(ride.client_id);

  if (ride.preferred_driver_id) {
    const preferredDriver = await Driver.findByPk(ride.preferred_driver_id);
    const eligible = preferredDriver
      && isDriverEligibleForPreferredOffer(preferredDriver, ride)
      && await isDriverWithinRange(preferredDriver, ride);

    if (eligible) {
      await offerRideToPreferredDriver(ride, preferredDriver);
      return;
    }

    if (client) {
      await evolutionService.sendText(
        client.whatsapp,
        'O motoboy que você escolheu não está disponível agora. Vou buscar automaticamente entre os motoboys disponíveis...'
      );
    }
  }

  const dispatchResult = await dispatchRideToDrivers(ride);

  // Pediu só motogirl e não achou nenhuma disponível agora — pergunta se
  // aceita motoboy em vez de simplesmente deixar a corrida no vazio. O
  // literal 'ASKING_ACCEPT_ANY_DRIVER' precisa bater com
  // STEPS.ASKING_ACCEPT_ANY_DRIVER em chatbot/conversationFlow.js — não dá
  // pra importar STEPS aqui sem criar dependência circular (conversationFlow
  // já importa rideService).
  if (dispatchResult.notified === 0 && ride.driver_gender_preference === 'motogirl' && client) {
    await conversationState.setState(client.whatsapp, { step: 'ASKING_ACCEPT_ANY_DRIVER', rideId: ride.id });
    await evolutionService.sendText(
      client.whatsapp,
      'Não tem motogirl disponível agora. Aceita motoboy?\n1 - Sim\n2 - Prefiro esperar'
    );
  }
}

// Corrida agendada: 15 min antes do horário marcado, começa a busca de
// motoboy de verdade (mesma lógica de despacho de uma corrida imediata,
// incluindo motoboy preferido) — cedo o suficiente pra alguém aceitar e
// chegar na hora, tarde o suficiente pra não ocupar a atenção de ninguém
// horas antes de precisar.
const SCHEDULE_DISPATCH_LEAD_MINUTES = 30;

async function sweepScheduledRides() {
  const dispatchThreshold = new Date(Date.now() + SCHEDULE_DISPATCH_LEAD_MINUTES * 60 * 1000);

  const dueRides = await Ride.findAll({
    where: {
      status: 'scheduled',
      scheduled_for: { [Op.lte]: dispatchThreshold },
    },
    include: [{ model: User, as: 'client' }],
  });

  for (const ride of dueRides) {
    await ride.update({ status: 'searching_driver', dispatch_started_at: new Date() });
    logger.info(`Corrida agendada ${ride.tracking_code}: chegou a hora (${SCHEDULE_DISPATCH_LEAD_MINUTES} min de antecedência) — iniciando despacho.`);

    if (ride.client) {
      const tipo = ride.type === 'delivery' ? 'sua entrega' : 'sua corrida';
      await evolutionService.sendText(
        ride.client.whatsapp,
        `Chegou a hora de buscar motoboy pra ${tipo} agendada (${ride.tracking_code})! Já estou procurando alguém disponível.`
      ).catch((err) => logger.error('Falha ao avisar cliente sobre início do despacho agendado', err.message));
    }

    await dispatchOrOfferRide(ride);
  }
}

let sweepIntervalHandle = null;
const SWEEP_INTERVAL_MS = 30 * 1000;

function startPreferredDriverSweep() {
  if (sweepIntervalHandle) return;
  sweepIntervalHandle = setInterval(() => {
    sweepExpiredPreferredOffers().catch((err) => logger.error('Falha na varredura de corridas com motoboy preferido', err.message));
    sweepStaleSearchingRides().catch((err) => logger.error('Falha na varredura de corridas sem motoboy disponível', err.message));
    sweepScheduledRides().catch((err) => logger.error('Falha na varredura de corridas agendadas', err.message));
  }, SWEEP_INTERVAL_MS);
}

function paymentMethodLabel(method) {
  const labels = { pix: 'Pix pra você', credit_card: 'cartão', debit_card: 'cartão', boleto: 'boleto', cash: 'dinheiro' };
  return labels[method] || method;
}

// PONTO CRÍTICO — tudo isso roda como UMA transação atômica:
// 1. Revalida autorização de passageiro no servidor (nunca confiar só na
//    filtragem do dispatch — o admin pode ter revogado nesse meio tempo).
// 2. Trava a corrida (só afeta a linha se ainda estiver 'searching_driver'
//    — quem chegar primeiro fica com ela, sem lock manual).
// 3. Debita o lead fee do saldo do motoboy — se não tiver saldo suficiente
//    (mudou entre o dispatch e agora), a transação inteira desfaz: a
//    corrida volta a ficar disponível pra outro motoboy, e o lead nunca é
//    cobrado de quem não conseguiu pagar por ele.
async function acceptRide(rideId, driverId) {
  const ride = await Ride.findByPk(rideId);
  if (!ride) throw new AppError('Corrida não encontrada.', 404);

  if (ride.type === 'passenger') {
    const driver = await Driver.findByPk(driverId);
    if (!driver || !driver.atende_passageiro || !driver.autorizadoPrefeitura) {
      throw new AppError(
        'NOT_AUTHORIZED_PASSENGER:Você ainda não está autorizado a levar passageiros. ' +
        'Envie o alvará da prefeitura pelo WhatsApp para análise do administrador.',
        403
      );
    }
  }

  return sequelize.transaction(async (t) => {
    const [affectedRows] = await Ride.update(
      { driver_id: driverId, status: 'accepted' },
      { where: { id: rideId, status: 'searching_driver' }, transaction: t }
    );

    if (affectedRows === 0) {
      throw new AppError('Essa corrida já foi aceita por outro motoboy.', 409);
    }

    let driverBalance;
    try {
      driverBalance = await walletService.debitDriver(driverId, env.leadFee.amount, `Lead — corrida ${ride.tracking_code}`, ride.id, t);
    } catch (err) {
      if (typeof err.message === 'string' && err.message.startsWith('SALDO_INSUFICIENTE:')) {
        throw new AppError(
          'SALDO_INSUFICIENTE:' + err.message.replace('SALDO_INSUFICIENTE:', ''),
          422
        );
      }
      throw err;
    }

    await Driver.update({ status: 'busy' }, { where: { id: driverId }, transaction: t });

    return { ride: await Ride.findByPk(rideId, { transaction: t }), driverBalance };
  }).then(async (result) => {
    const driver = await Driver.findByPk(driverId);
    partnerWebhookService.notifyPartner(result.ride, 'accepted', driver);
    return result;
  });
}

// Tira a exigência de motogirl de uma corrida já criada — usado quando a
// cliente, avisada que não tem motogirl disponível, aceita motoboy. Não
// mexe em User.gender (o gênero DELA continua salvo); é só a preferência
// dessa corrida específica que muda.
async function removeDriverGenderPreference(rideId) {
  const ride = await Ride.findByPk(rideId);
  if (!ride) throw new AppError('Corrida não encontrada.', 404);
  await ride.update({ driver_gender_preference: null });
  return ride;
}

// Cancelamento manual — chamado tanto pelo comando "cancelar" do cliente no
// WhatsApp quanto pelo botão do painel admin (e também internamente, pelo
// fluxo de "prefiro esperar por motogirl"). Só permite cancelar enquanto a
// corrida ainda está em busca ou já foi aceita (nunca depois de concluída).
// Se já tinha motoboy aceito, o lead fee é estornado automaticamente pro
// saldo dele (ele não tem culpa do cancelamento) e ele é avisado — senão,
// avisa quem já tinha sido notificado (broadcast ou oferta exclusiva) pra
// ninguém tentar aceitar uma oferta que não existe mais.
const CANCELLABLE_STATUSES = ['scheduled', 'searching_driver', 'accepted'];

async function cancelRide(rideId, reason) {
  const ride = await Ride.findByPk(rideId);
  if (!ride) throw new AppError('Corrida não encontrada.', 404);
  if (!CANCELLABLE_STATUSES.includes(ride.status)) {
    throw new AppError('Essa corrida não pode mais ser cancelada.', 409);
  }

  const wasAccepted = ride.status === 'accepted';
  const previousDriverId = ride.driver_id;
  const notifiedIds = new Set(ride.notified_driver_ids || []);
  if (ride.preferred_driver_id) notifiedIds.add(ride.preferred_driver_id);

  await sequelize.transaction(async (t) => {
    await ride.update({ status: 'cancelled', cancelled_reason: reason }, { transaction: t });
    if (wasAccepted && previousDriverId) {
      await Driver.update({ status: 'available' }, { where: { id: previousDriverId }, transaction: t });
      await walletService.creditDriver(
        previousDriverId,
        env.leadFee.amount,
        `Estorno — corrida ${ride.tracking_code} cancelada`,
        ride.id,
        t
      );
    }
  });

  // Notificações via WhatsApp ficam fora da transação — são efeito
  // colateral, e uma falha no envio nunca deve desfazer o cancelamento/estorno.
  if (wasAccepted && previousDriverId) {
    const driver = await Driver.findByPk(previousDriverId);
    if (driver) {
      evolutionService.sendText(
        driver.whatsapp,
        `A corrida ${ride.tracking_code} foi cancelada. O valor do lead foi estornado pro seu saldo, e você já está disponível pra outras corridas.`
      ).catch((err) => logger.error('Falha ao notificar motoboy sobre cancelamento', err.message));
    }
  } else if (notifiedIds.size > 0) {
    const drivers = await Driver.findAll({ where: { id: [...notifiedIds] } });
    await Promise.all(drivers.map((d) =>
      evolutionService.sendText(d.whatsapp, `A corrida ${ride.tracking_code} não está mais disponível (cancelada).`)
        .catch((err) => logger.error('Falha ao notificar motoboy sobre corrida cancelada', err.message))
    ));
  }

  partnerWebhookService.notifyPartner(ride, 'cancelled');

  return ride;
}

async function completeRide(rideId) {
  const ride = await Ride.findByPk(rideId);
  if (!ride) throw new AppError('Corrida não encontrada', 404);

  await ride.update({ status: 'completed' });
  await Driver.update({ status: 'available' }, { where: { id: ride.driver_id } });

  // Sistema de indicação: se o motoboy que completou foi indicado por
  // alguém, credita a comissão fixa pro indicador. Nunca trava a conclusão
  // da corrida em si — é um bônus à parte.
  referralService.recordCommissionForCompletedRide(ride)
    .catch((err) => logger.error('Falha ao registrar comissão de indicação', err.message));

  partnerWebhookService.notifyPartner(ride, 'completed');

  return ride;
}

module.exports = {
  quoteRide,
  createRide,
  createPartnerDelivery,
  isDriverEligibleForRideType,
  isDriverEligibleForPreferredOffer,
  isDriverWithinRange,
  findDriverByUsername,
  findNearbyAvailableDrivers,
  dispatchRideToDrivers,
  offerRideToPreferredDriver,
  fallbackToBroadcast,
  rejectRide,
  sweepExpiredPreferredOffers,
  sweepStaleSearchingRides,
  sweepScheduledRides,
  dispatchOrOfferRide,
  startPreferredDriverSweep,
  acceptRide,
  completeRide,
  removeDriverGenderPreference,
  cancelRide,
};
