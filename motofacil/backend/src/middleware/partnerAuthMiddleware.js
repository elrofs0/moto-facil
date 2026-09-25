const env = require('../config/env');
const { AppError } = require('./errorHandler');

// Protege as rotas chamadas por sistemas parceiros (hoje só o
// PedidoFácil) — chave fixa compartilhada, sem login/JWT, igual ao padrão
// já usado pros webhooks de pagamento (ver paymentWebhookController.js).
function partnerAuthMiddleware(req, res, next) {
  if (!env.partner.apiKey) {
    return next(new AppError('Integração com parceiros não configurada', 503));
  }
  const key = req.headers['x-partner-key'];
  if (key !== env.partner.apiKey) {
    return next(new AppError('Não autenticado', 401));
  }
  next();
}

module.exports = partnerAuthMiddleware;
