const { v4: uuidv4 } = require('uuid');

// Logger simples e centralizado — em produção, trocar por Winston/Pino
// mantendo a mesma interface (info/warn/error) para não precisar mexer
// no resto do código.
const logger = {
  info: (...args) => console.log(new Date().toISOString(), '[INFO]', ...args),
  warn: (...args) => console.warn(new Date().toISOString(), '[WARN]', ...args),
  error: (...args) => console.error(new Date().toISOString(), '[ERROR]', ...args),
};

// Evita repetir try/catch em todo controller assíncrono.
function asyncHandler(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}

// Código curto e amigável para o cliente rastrear a corrida
// (ex: MF-7K2H9X), diferente do UUID interno.
function generateTrackingCode() {
  const random = uuidv4().split('-')[0].toUpperCase();
  return `MF-${random}`;
}

module.exports = { logger, asyncHandler, generateTrackingCode };
