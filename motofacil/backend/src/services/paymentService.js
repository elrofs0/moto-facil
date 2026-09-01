const mercadoPagoAdapter = require('./paymentAdapters/mercadoPagoAdapter');
const walletService = require('./walletService');
const { Ride } = require('../models');
const { logger } = require('../utils');

// Ponto único de acesso a pagamento no resto do sistema. Hoje só existe o
// adapter do Mercado Pago, mas qualquer controller/serviço deve chamar
// SEMPRE por aqui — trocar de gateway no futuro (ex: adicionar Asaas como
// alternativa) significa só adicionar um novo adapter e uma condição aqui,
// sem tocar em controllers ou no chatbot.

async function createChargeForRide(ride, clientEmail) {
  // Corrida em dinheiro não gera cobrança no gateway — o cliente paga
  // direto ao motoboy, e a comissão é debitada da carteira do motoboy.
  if (ride.payment_method === 'cash') {
    return { checkoutUrl: null, providerId: null };
  }

  const { checkoutUrl, providerId } = await mercadoPagoAdapter.createCharge({ ride, clientEmail });
  await ride.update({ payment_provider_id: providerId });
  return { checkoutUrl, providerId };
}

// Chamado pelo webhook do Mercado Pago. Sempre reconsulta o pagamento
// diretamente na API (verifyPayment) em vez de confiar cegamente no corpo
// da notificação recebida — evita fraude de webhook falsificado.
async function confirmPaymentFromWebhook(paymentId) {
  const result = await mercadoPagoAdapter.verifyPayment(paymentId);
  const ride = await Ride.findByPk(result.externalReference);

  if (!ride) {
    logger.warn(`Webhook de pagamento recebido para corrida inexistente: ${result.externalReference}`);
    return null;
  }

  if (result.status === 'approved' && ride.payment_status !== 'approved') {
    await ride.update({
      payment_status: 'approved',
      payment_method: result.paymentMethod,
      status: 'searching_driver',
    });
  } else if (result.status === 'rejected') {
    await ride.update({ payment_status: 'refused' });
  }

  return ride;
}

// Fluxo de pagamento em dinheiro: debita a comissão da carteira do
// motoboy no momento em que a corrida é concluída.
async function settleCashRide(ride) {
  await walletService.debitDriver(
    ride.driver_id,
    ride.platform_fee,
    `Comissão da corrida ${ride.tracking_code} (pagamento em dinheiro)`,
    ride.id
  );
  await ride.update({ payment_status: 'approved' });
}

module.exports = { createChargeForRide, confirmPaymentFromWebhook, settleCashRide };
