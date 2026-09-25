const redis = require('../config/redis');

// Guarda a ação sensível proposta pela IA enquanto espera o admin
// confirmar ("sim"/"não") pelo WhatsApp, e também o estado de
// desambiguação quando o nome informado bate com mais de um motoboy/
// usuário. Prefixo e TTL próprios — não compartilha espaço com o estado
// de conversa dos clientes (conversationStateService).

const TTL_SECONDS = 5 * 60;
const KEY_PREFIX = 'admin_pending:';

async function getPending(whatsapp) {
  const raw = await redis.get(KEY_PREFIX + whatsapp);
  return raw ? JSON.parse(raw) : null;
}

async function setPending(whatsapp, pending) {
  await redis.set(KEY_PREFIX + whatsapp, JSON.stringify(pending), 'EX', TTL_SECONDS);
}

async function clearPending(whatsapp) {
  await redis.del(KEY_PREFIX + whatsapp);
}

module.exports = { getPending, setPending, clearPending };
