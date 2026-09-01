const redis = require('../config/redis');

// Guarda em que etapa da conversa cada número de WhatsApp está
// (endereço → destino → confirmação → pagamento). Sem isso, mensagens de
// clientes diferentes conversando ao mesmo tempo se misturariam, já que o
// bot não tem "sessões" como um app teria.
//
// Expira automaticamente em 15 minutos de inatividade — evita que uma
// conversa abandonada fique presa num estado antigo para sempre.

const TTL_SECONDS = 15 * 60;
const KEY_PREFIX = 'conversation:';

async function getState(whatsapp) {
  const raw = await redis.get(KEY_PREFIX + whatsapp);
  return raw ? JSON.parse(raw) : null;
}

async function setState(whatsapp, state) {
  await redis.set(KEY_PREFIX + whatsapp, JSON.stringify(state), 'EX', TTL_SECONDS);
}

async function clearState(whatsapp) {
  await redis.del(KEY_PREFIX + whatsapp);
}

module.exports = { getState, setState, clearState };
