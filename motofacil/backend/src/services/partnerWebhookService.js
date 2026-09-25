const axios = require('axios');
const env = require('../config/env');
const { logger } = require('../utils');

// Avisa o sistema parceiro (hoje só o PedidoFácil) sobre mudança de status
// numa entrega que ELE pediu — sem isso, quem está no painel do parceiro
// precisaria ficar consultando pra saber se achou motoboy. Nunca deve
// travar nem derrubar o fluxo principal: erro aqui só é logado.
async function notifyPartner(ride, event, driver = null) {
  if (ride.source !== 'partner' || !ride.external_reference) return;
  if (!env.partner.pedidoFacilWebhookUrl) return;

  try {
    await axios.post(
      env.partner.pedidoFacilWebhookUrl,
      {
        event,
        externalReference: ride.external_reference,
        motofacilRideId: ride.id,
        status: ride.status,
        driverName: driver?.name || null,
        driverWhatsapp: driver?.whatsapp || null,
      },
      {
        headers: { 'X-Partner-Key': env.partner.pedidoFacilWebhookKey },
        timeout: 8000,
      }
    );
  } catch (err) {
    logger.error(`Falha ao notificar parceiro sobre corrida ${ride.tracking_code} (evento: ${event})`, err.response?.data || err.message);
  }
}

module.exports = { notifyPartner };
