const evolutionService = require('../services/evolutionService');
const conversationFlow = require('../chatbot/conversationFlow');
const { Driver } = require('../models');
const { asyncHandler, logger } = require('../utils');

// Recebe TODO evento da Evolution API (mensagens de clientes e de
// motoboys chegam pelo mesmo webhook). Distingue os dois casos verificando
// se o número que enviou a mensagem é um motoboy cadastrado.
const receiveWebhook = asyncHandler(async (req, res) => {
  // Responde 200 imediatamente — processamos de forma assíncrona para não
  // deixar a Evolution API esperando e reenviando o mesmo evento por timeout.
  res.status(200).json({ received: true });

  const parsed = evolutionService.parseIncomingMessage(req.body);
  if (!parsed) return;

  const { whatsapp, text, location } = parsed;

  try {
    const driver = await Driver.findOne({ where: { whatsapp } });

    if (driver && location) {
      await driver.update({ last_lat: location.lat, last_lng: location.lng, last_location_at: new Date() });
      return;
    }

    if (driver && text && (text.startsWith('accept_ride:') || text.startsWith('reject_ride:'))) {
      await conversationFlow.handleDriverResponse({ whatsapp, buttonId: text }, driver.id);
      return;
    }

    if (text) {
      await conversationFlow.handleIncomingMessage({ whatsapp, text });
    }
  } catch (err) {
    logger.error('Erro processando webhook da Evolution API', err);
  }
});

module.exports = { receiveWebhook };
