const { MercadoPagoConfig, Payment, Preference } = require('mercadopago');
const env = require('../../config/env');
const { logger } = require('../../utils');

// Adapter isolado do Mercado Pago — todo o resto do sistema conversa com
// paymentService.js, nunca diretamente com este arquivo. Isso permite
// trocar ou adicionar outro gateway (ex: Asaas) no futuro sem alterar o
// fluxo de corrida, só implementando um adapter novo com a mesma
// interface (createCharge / handleWebhook).
const client = new MercadoPagoConfig({ accessToken: env.mercadoPago.accessToken });
const paymentClient = new Payment(client);
const preferenceClient = new Preference(client);

// Cria uma cobrança aceitando TODOS os métodos disponíveis no Mercado Pago
// (Pix, cartão de crédito, cartão de débito e boleto) — não restringe
// métodos, deixando o Checkout Pro do Mercado Pago apresentar todas as
// opções ao cliente.
async function createCharge({ ride, clientEmail }) {
  const preference = await preferenceClient.create({
    body: {
      items: [
        {
          title: `Corrida MotoFácil ${ride.tracking_code}`,
          quantity: 1,
          unit_price: parseFloat(ride.price),
          currency_id: 'BRL',
        },
      ],
      payer: { email: clientEmail },
      external_reference: ride.id,
      // Split de pagamento: o valor já sai dividido entre a plataforma e a
      // subconta do motoboy no momento do pagamento — sem repasse manual
      // depois. Requer que o motoboy tenha uma conta Mercado Pago vinculada
      // (collector_id da subconta) cadastrada no momento da aprovação dele.
      marketplace_fee: parseFloat(ride.platform_fee),
      notification_url: `${process.env.PUBLIC_API_URL || ''}/api/webhooks/pagamento`,
      back_urls: {
        success: `${process.env.PUBLIC_APP_URL || ''}/pagamento/sucesso`,
        failure: `${process.env.PUBLIC_APP_URL || ''}/pagamento/falha`,
      },
      auto_return: 'approved',
    },
  });

  return {
    providerId: preference.id,
    checkoutUrl: preference.init_point,
  };
}

// Consulta o status real de um pagamento diretamente na API do Mercado
// Pago — nunca confiar apenas no corpo do webhook sem confirmar a origem,
// para evitar fraude de notificação falsa.
async function verifyPayment(paymentId) {
  try {
    const payment = await paymentClient.get({ id: paymentId });
    return {
      status: payment.status, // approved | pending | rejected | refunded
      externalReference: payment.external_reference,
      amount: payment.transaction_amount,
      paymentMethod: mapPaymentMethod(payment.payment_type_id),
    };
  } catch (err) {
    logger.error('Falha ao verificar pagamento no Mercado Pago', err.message);
    throw err;
  }
}

function mapPaymentMethod(mercadoPagoType) {
  const map = {
    credit_card: 'credit_card',
    debit_card: 'debit_card',
    bank_transfer: 'pix',
    ticket: 'boleto',
  };
  return map[mercadoPagoType] || mercadoPagoType;
}

module.exports = { createCharge, verifyPayment };
