const evolutionService = require('../services/evolutionService');
const conversationFlow = require('../chatbot/conversationFlow');
const adminCommandFlow = require('../chatbot/adminCommandFlow');
const env = require('../config/env');
const redis = require('../config/redis');
const { Driver } = require('../models');
const { asyncHandler, logger } = require('../utils');
const { normalizeWhatsapp } = require('../utils/phoneUtils');

// Só processamos o evento de mensagem recebida de fato. A Evolution API
// manda vários outros eventos no mesmo webhook (conexão, presença,
// atualização de contato, etc.) — ignorá-los aqui evita trabalho à toa e,
// mais importante, evita o bot tentar "responder" a um evento que não é
// uma mensagem de verdade.
const HANDLED_EVENTS = new Set(['messages.upsert', 'MESSAGES_UPSERT']);

// TTL da trava de idempotência: só precisa cobrir o período em que a
// Evolution API poderia reenviar o mesmo evento por timeout/retry —
// 10 minutos é folgado pra isso sem acumular lixo no Redis.
const DEDUPE_TTL_SECONDS = 10 * 60;

// Evita processar a mesma mensagem duas vezes se a Evolution API reenviar
// o webhook (retry por timeout, reconexão, etc.). SET ... NX é atômico:
// só um processo consegue "reservar" aquele messageId; quem chega depois
// recebe null e sabe que é duplicata, sem condição de corrida.
async function tryLockMessage(messageId) {
  if (!messageId) return true; // sem id não dá pra deduplicar — segue normalmente
  const key = `wa_msg_lock:${messageId}`;
  const result = await redis.set(key, '1', 'EX', DEDUPE_TTL_SECONDS, 'NX');
  return result === 'OK';
}

// Recebe TODO evento da Evolution API (mensagens de clientes, motoboys e
// do admin chegam pelo mesmo webhook). A ordem de checagem importa: o
// número do admin é verificado primeiro, antes de qualquer lógica de
// cliente/motoboy, e nunca cai no fluxo de reserva de corrida.
const receiveWebhook = asyncHandler(async (req, res) => {
  // Responde 200 imediatamente — processamos de forma assíncrona para não
  // deixar a Evolution API esperando e reenviando o mesmo evento por timeout.
  res.status(200).json({ received: true });

  const event = req.body?.event;
  if (event && !HANDLED_EVENTS.has(event)) return;

  const parsed = evolutionService.parseIncomingMessage(req.body);
  if (!parsed) return;

  const { whatsapp, text, location, hasMedia, messageId, raw } = parsed;

  const acquiredLock = await tryLockMessage(messageId);
  if (!acquiredLock) {
    logger.info(`Mensagem duplicada ignorada (messageId=${messageId})`);
    return;
  }

  try {
    if (env.adminCommands.adminWhatsapp && whatsapp === normalizeWhatsapp(env.adminCommands.adminWhatsapp)) {
      if (text) await adminCommandFlow.handleAdminMessage({ whatsapp, text });
      return;
    }

    const driver = await Driver.findOne({ where: { whatsapp } });

    if (driver && location) {
      await conversationFlow.handleDriverLocation({ whatsapp, location }, driver);
      return;
    }

    if (!driver && location) {
      await conversationFlow.handleClientLocation({ whatsapp, location });
      return;
    }

    if (driver && text && (text.startsWith('accept_ride:') || text.startsWith('reject_ride:'))) {
      await conversationFlow.handleDriverResponse({ whatsapp, buttonId: text }, driver.id);
      return;
    }

    if (hasMedia) {
      let document;
      try {
        document = await evolutionService.fetchMediaBase64(raw);
      } catch (err) {
        logger.error('Falha ao baixar mídia da Evolution API', err.response?.data || err.message);
        await evolutionService.sendText(whatsapp, 'Não consegui processar esse arquivo agora. Pode mandar de novo?');
        return;
      }
      await conversationFlow.handleIncomingDocument({ whatsapp, document });
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
