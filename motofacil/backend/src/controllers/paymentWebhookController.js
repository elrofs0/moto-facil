const crypto = require('crypto');
const paymentService = require('../services/paymentService');
const { asyncHandler, logger } = require('../utils');
const env = require('../config/env');

// Webhook do gateway de pagamento ativo (Asaas ou Mercado Pago — ver
// PAYMENT_PROVIDER). Único evento tratado hoje: confirmação de recarga de
// carteira do motoboy (é o único dinheiro que passa pela plataforma — o
// valor da corrida em si é sempre cliente → motoboy direto). Responde
// rápido, processa depois, e NUNCA confia no corpo da notificação sem
// revalidar o pagamento diretamente na API (feito dentro de
// paymentService.confirmPaymentFromWebhook).
const receiveWebhook = asyncHandler(async (req, res) => {
  res.status(200).send('ok');

  if (env.paymentProvider === 'asaas' && env.asaas.webhookToken) {
    const token = req.headers['asaas-access-token'];
    if (token !== env.asaas.webhookToken) {
      logger.warn('Webhook do Asaas recebido com token inválido — ignorado.');
      return;
    }
  }

  if (env.paymentProvider === 'mercadopago' && env.mercadoPago.webhookSecret) {
    if (!isValidMercadoPagoSignature(req)) {
      logger.warn('Webhook do Mercado Pago recebido com assinatura inválida — ignorado.');
      return;
    }
  }

  const paymentId = extractPaymentId(req);
  if (!paymentId) return;

  try {
    await paymentService.confirmPaymentFromWebhook(paymentId);
  } catch (err) {
    logger.error('Erro processando webhook de pagamento', err);
  }
});

// Verifica a assinatura HMAC do Mercado Pago (header x-signature), pro
// mesmo padrão de segurança que já existe pro Asaas — sem isso, qualquer
// um que descobrisse a URL do webhook podia mandar notificação falsa.
//
// Algoritmo documentado pelo próprio Mercado Pago ("Webhooks — como
// validar a origem da notificação"):
//   1. x-signature vem no formato "ts=<timestamp>,v1=<hash>"
//   2. o manifesto assinado é a string "id:<data.id>;request-id:<x-request-id>;ts:<ts>;"
//      — o <data.id> é o valor do query string ?data.id=... da própria URL
//      do webhook (não o id de dentro do corpo da notificação), em minúsculo
//   3. HMAC-SHA256 desse manifesto com o webhook secret precisa bater
//      exatamente com o <hash> recebido em v1
function isValidMercadoPagoSignature(req) {
  const signatureHeader = req.headers['x-signature'];
  const requestId = req.headers['x-request-id'];
  if (!signatureHeader || !requestId) return false;

  const parts = {};
  signatureHeader.split(',').forEach((fragment) => {
    const [key, value] = fragment.split('=');
    if (key && value) parts[key.trim()] = value.trim();
  });

  const { ts, v1 } = parts;
  if (!ts || !v1) return false;

  const dataId = String(req.query['data.id'] || req.query.id || '').toLowerCase();
  if (!dataId) return false;

  const manifest = `id:${dataId};request-id:${requestId};ts:${ts};`;
  const expectedSignature = crypto
    .createHmac('sha256', env.mercadoPago.webhookSecret)
    .update(manifest)
    .digest('hex');

  const expectedBuffer = Buffer.from(expectedSignature, 'hex');
  const receivedBuffer = Buffer.from(v1, 'hex');
  if (expectedBuffer.length !== receivedBuffer.length) return false;

  return crypto.timingSafeEqual(expectedBuffer, receivedBuffer);
}

// Cada gateway manda o id do recurso num lugar diferente do payload.
// Mercado Pago usa a mesma forma ({ type, data: { id } }) tanto pro
// webhook legado de "payments" quanto pro novo de "orders".
function extractPaymentId(req) {
  if (env.paymentProvider === 'asaas') {
    return req.body?.payment?.id || null;
  }
  return req.query.id || req.body?.data?.id || null;
}

module.exports = { receiveWebhook };
