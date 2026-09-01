const conversationState = require('../services/conversationStateService');
const rideService = require('../services/rideService');
const paymentService = require('../services/paymentService');
const evolutionService = require('../services/evolutionService');
const { User } = require('../models');
const { logger } = require('../utils');

// Máquina de estados simples e explícita — cada etapa só sabe processar
// a mensagem esperada naquela etapa. Preferido a um NLP livre porque o
// público do MotoFácil inclui pessoas menos familiarizadas com tecnologia;
// menus/etapas previsíveis erram menos que interpretação de texto livre.

const STEPS = {
  ASKING_ORIGIN: 'ASKING_ORIGIN',
  ASKING_DESTINATION: 'ASKING_DESTINATION',
  ASKING_PAYMENT_METHOD: 'ASKING_PAYMENT_METHOD',
  CONFIRMING: 'CONFIRMING',
};

const PAYMENT_OPTIONS = {
  '1': 'pix',
  '2': 'credit_card',
  '3': 'debit_card',
  '4': 'boleto',
  '5': 'cash',
};

async function handleIncomingMessage({ whatsapp, text }) {
  const normalized = (text || '').trim().toLowerCase();
  const state = await conversationState.getState(whatsapp);

  // Início de uma nova solicitação
  if (!state && (normalized.includes('preciso de uma moto') || normalized.includes('quero uma entrega'))) {
    await conversationState.setState(whatsapp, { step: STEPS.ASKING_ORIGIN });
    return evolutionService.sendText(
      whatsapp,
      'Show! Vamos organizar sua corrida. Qual é o endereço de partida (coleta)?'
    );
  }

  if (!state) {
    return evolutionService.sendText(
      whatsapp,
      'Oi! Para pedir uma corrida ou entrega, digite: "Preciso de uma moto".'
    );
  }

  switch (state.step) {
    case STEPS.ASKING_ORIGIN:
      await conversationState.setState(whatsapp, { ...state, origin: text, step: STEPS.ASKING_DESTINATION });
      return evolutionService.sendText(whatsapp, 'Perfeito. E qual é o endereço de destino?');

    case STEPS.ASKING_DESTINATION:
      await conversationState.setState(whatsapp, { ...state, destination: text, step: STEPS.ASKING_PAYMENT_METHOD });
      return evolutionService.sendText(
        whatsapp,
        'Como você quer pagar?\n1 - Pix\n2 - Cartão de crédito\n3 - Cartão de débito\n4 - Boleto\n5 - Dinheiro (direto com o motoboy)'
      );

    case STEPS.ASKING_PAYMENT_METHOD: {
      const paymentMethod = PAYMENT_OPTIONS[normalized];
      if (!paymentMethod) {
        return evolutionService.sendText(whatsapp, 'Não entendi. Responda com um número de 1 a 5.');
      }
      return startRideCreation(whatsapp, { ...state, paymentMethod });
    }

    default:
      await conversationState.clearState(whatsapp);
      return evolutionService.sendText(whatsapp, 'Vamos recomeçar. Digite "Preciso de uma moto" para pedir uma corrida.');
  }
}

async function startRideCreation(whatsapp, { origin, destination, paymentMethod }) {
  const [user] = await User.findOrCreate({
    where: { whatsapp },
    defaults: { name: whatsapp, whatsapp },
  });

  const ride = await rideService.createRide({
    clientId: user.id,
    type: 'delivery',
    originAddress: origin,
    destinationAddress: destination,
    paymentMethod,
  });

  await conversationState.clearState(whatsapp);

  if (paymentMethod === 'cash') {
    await evolutionService.sendText(
      whatsapp,
      `Corrida ${ride.tracking_code} criada! Valor: R$ ${ride.price} (pagamento em dinheiro direto ao motoboy). Buscando um motoboy disponível...`
    );
    await rideService.dispatchRideToDrivers(ride);
    return;
  }

  const { checkoutUrl } = await paymentService.createChargeForRide(ride, `${whatsapp}@motofacil.temp`);
  await evolutionService.sendText(
    whatsapp,
    `Corrida ${ride.tracking_code} — valor R$ ${ride.price}.\nFinalize o pagamento aqui: ${checkoutUrl}\n` +
    `Assim que confirmarmos o pagamento, já saímos buscando um motoboy pra você.`
  );
}

// Chamado quando o motoboy clica em [Aceitar] ou [Recusar] na oferta de corrida.
async function handleDriverResponse({ whatsapp, buttonId }, driverId) {
  const [action, rideId] = buttonId.split(':');

  if (action === 'accept_ride') {
    try {
      const ride = await rideService.acceptRide(rideId, driverId);
      await evolutionService.sendText(whatsapp, `Corrida ${ride.tracking_code} confirmada! Siga para: ${ride.origin_address}`);
    } catch (err) {
      logger.info(`Motoboy ${driverId} tentou aceitar corrida ${rideId} já aceita por outro.`);
      await evolutionService.sendText(whatsapp, 'Essa corrida já foi aceita por outro motoboy. Fique de olho na próxima!');
    }
  }
}

module.exports = { handleIncomingMessage, handleDriverResponse, STEPS };
