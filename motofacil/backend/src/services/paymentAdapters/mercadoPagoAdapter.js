const axios = require('axios');
const { randomUUID } = require('crypto');
const env = require('../../config/env');
const { logger } = require('../../utils');

// Adapter do Mercado Pago — usa a Orders API (a atual, recomendada pelo
// próprio Mercado Pago; a antiga /v1/payments continua existindo mas está
// sendo substituída aos poucos). Implementado com axios direto (não via
// SDK oficial) porque a versão do SDK já instalada no projeto não expõe
// o recurso de Orders — bater direto na API REST evita depender de uma
// versão específica do pacote.
//
// Único uso hoje: gerar o Pix da recarga de carteira do motoboy. O valor
// da corrida em si nunca passa pelo Mercado Pago (cliente paga o motoboy
// direto) — ver rideService.js e paymentService.js.
const client = axios.create({
  baseURL: 'https://api.mercadopago.com',
  headers: {
    Authorization: `Bearer ${env.mercadoPago.accessToken}`,
    'Content-Type': 'application/json',
  },
  timeout: 15000,
});

async function createPixCharge({ externalReference, customerName, customerWhatsapp, value, description }) {
  try {
    const { data: order } = await client.post(
      '/v1/orders',
      {
        type: 'online',
        processing_mode: 'automatic',
        external_reference: externalReference,
        total_amount: parseFloat(value).toFixed(2),
        description,
        payer: {
          email: `${customerWhatsapp || externalReference}@motofacil.tech`,
          first_name: customerName,
        },
        transactions: {
          payments: [
            {
              amount: parseFloat(value).toFixed(2),
              payment_method: { id: 'pix', type: 'bank_transfer' },
            },
          ],
        },
      },
      { headers: { 'X-Idempotency-Key': randomUUID() } }
    );

    // O QR fica dentro do pagamento Pix específico, não solto na order —
    // confirmado direto numa order real: vem em
    // transactions.payments[0].payment_method.qr_code(_base64), não em
    // point_of_interaction.transaction_data (isso não existe na resposta
    // de verdade da Orders API; mantido como fallback só por segurança
    // caso o formato mude entre contas/versões).
    const payment = order.transactions?.payments?.[0];
    const pixQrCodeBase64 = payment?.payment_method?.qr_code_base64
      || payment?.point_of_interaction?.transaction_data?.qr_code_base64
      || order.point_of_interaction?.transaction_data?.qr_code_base64
      || null;
    const pixCopyPaste = payment?.payment_method?.qr_code
      || payment?.point_of_interaction?.transaction_data?.qr_code
      || order.point_of_interaction?.transaction_data?.qr_code
      || null;

    return {
      providerId: order.id,
      pixQrCodeBase64,
      pixCopyPaste,
    };
  } catch (err) {
    logger.error('Falha ao criar Pix (Orders API) no Mercado Pago', err.response?.data || err.message);
    throw err;
  }
}

// Reconsulta o pedido direto na API — nunca confia só no corpo do
// webhook. O status oficial da order já vem "traduzido" pelo Mercado
// Pago, mas checamos o pagamento individual dentro de transactions pra
// ter certeza absoluta do que aconteceu com o Pix específico.
async function verifyPayment(orderId) {
  try {
    const { data: order } = await client.get(`/v1/orders/${orderId}`);
    const payment = order.transactions?.payments?.[0];

    return {
      status: mapStatus(payment?.status || order.status),
      externalReference: order.external_reference,
      amount: parseFloat(order.total_amount),
      paymentMethod: 'pix',
    };
  } catch (err) {
    logger.error('Falha ao verificar pedido (Orders API) no Mercado Pago', err.response?.data || err.message);
    throw err;
  }
}

function mapStatus(mpStatus) {
  const approved = ['approved', 'processed', 'accredited'];
  const rejected = ['rejected', 'cancelled', 'canceled', 'expired', 'refunded'];
  if (approved.includes(mpStatus)) return 'approved';
  if (rejected.includes(mpStatus)) return 'rejected';
  return 'pending';
}

module.exports = { createPixCharge, verifyPayment };
