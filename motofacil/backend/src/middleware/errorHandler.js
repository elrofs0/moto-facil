const { logger } = require('../utils');

// Middleware final de tratamento de erros — captura tanto erros lançados
// explicitamente (AppError) quanto exceções inesperadas, sem nunca vazar
// stack trace para o cliente em produção.
class AppError extends Error {
  constructor(message, statusCode = 400) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;
  }
}

function errorHandler(err, req, res, next) {
  const statusCode = err.statusCode || 500;
  const isOperational = err.isOperational || false;

  if (!isOperational) {
    logger.error('Erro não tratado:', err);
  }

  res.status(statusCode).json({
    error: isOperational ? err.message : 'Erro interno do servidor',
  });
}

module.exports = { errorHandler, AppError };
