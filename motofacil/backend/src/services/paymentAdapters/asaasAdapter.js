const axios = require('axios');
const env = require('../../config/env');
const { logger } = require('../../utils');

// Adapter do Asaas — mesma responsabilidade do mercadoPagoAdapter.js:
// todo o resto do sistema fala com paymentService.js, nunca diretamente
// com este arquivo. Implementa Pix real (QR code + copia-e-cola) via API
// oficial do Asaas. Por padrão aponta pro sandbox (ASAAS_BASE_URL) —
// troque para a URL de produção só depois de validar o fluxo inteiro.

const client = axios.create({
  baseURL: env.asaas.baseUrl,
  headers: {
    access_token: env.asaas.apiKey,
    'Content-Type': 'application/json',
  },
  timeout: 15000,
});

// O Asaas cobra em cima de um "customer" cadastrado, não de um WhatsApp
// solto. Em vez de guardar o customerId do Asaas numa coluna nova (mais
// uma migration, mais acoplamento), buscamos por externalReference — se
// já existe, reusa; se não, cria na hora. Um pouco mais lento que cachear
// o id, mas mantém o driver/user model livre de detalhe de gateway.
async function getOrCreateCustomer({ externalReference, name, whatsapp }) {
  try {
    const { data: existing } = await client.get('/customers', {
      params: { externalReference },
    });
    if (existing?.data?.length > 0) return existing.data[0].id;

    const { data: created } = await client.post('/customers', {
      name,
      mobilePhone: whatsapp,
      externalReference,
    });
    return created.id;
  } catch (err) {
    logger.error('Falha ao localizar/criar cliente no Asaas', err.response?.data || err.message);
    throw err;
  }
}

// Cria uma cobrança Pix real e devolve o QR code (base64 pronto pra
// exibir/enviar) e o código copia-e-cola — usado tanto para pagamento de
// corrida quanto para recarga de carteira do motoboy.
async function createPixCharge({ externalReference, customerName, customerWhatsapp, value, description }) {
  const customerId = await getOrCreateCustomer({
    externalReference,
    name: customerName,
    whatsapp: customerWhatsapp,
  });

  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() + 1); // Pix não expira de fato pelo "vencimento", mas o campo é obrigatório

  try {
    const { data: payment } = await client.post('/payments', {
      customer: customerId,
      billingType: 'PIX',
      value,
      dueDate: dueDate.toISOString().slice(0, 10),
      description,
      externalReference,
    });

    const { data: qrCode } = await client.get(`/payments/${payment.id}/pixQrCode`);

    return {
      providerId: payment.id,
      pixQrCodeBase64: qrCode.encodedImage,
      pixCopyPaste: qrCode.payload,
      expirationDate: qrCode.expirationDate || null,
    };
  } catch (err) {
    logger.error('Falha ao criar cobrança Pix no Asaas', err.response?.data || err.message);
    throw err;
  }
}

// Cria uma cobrança que aceita qualquer método (Pix, cartão, boleto) —
// usada no checkout de corrida quando o cliente não precisa ser
// restrito a Pix. Devolve um link de pagamento hospedado pelo Asaas.
async function createCharge({ ride, clientEmail }) {
  const { providerId } = await createPixChargeGeneric({
    externalReference: ride.id,
    customerName: `Cliente ${ride.tracking_code}`,
    customerWhatsapp: null,
    value: parseFloat(ride.price),
    description: `Corrida MotoFácil ${ride.tracking_code}`,
    email: clientEmail,
  });

  return {
    providerId,
    checkoutUrl: `${env.asaas.baseUrl.replace('/v3', '')}/i/${providerId}`,
  };
}

async function createPixChargeGeneric({ externalReference, customerName, customerWhatsapp, value, description, email }) {
  const customerId = await getOrCreateCustomer({
    externalReference,
    name: customerName,
    whatsapp: customerWhatsapp,
  });

  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() + 1);

  const { data: payment } = await client.post('/payments', {
    customer: customerId,
    billingType: 'UNDEFINED', // deixa o cliente escolher Pix, cartão ou boleto no link
    value,
    dueDate: dueDate.toISOString().slice(0, 10),
    description,
    externalReference,
  });

  return { providerId: payment.id };
}

// Consulta o status real de um pagamento direto na API do Asaas — nunca
// confiar só no corpo do webhook, para evitar fraude de notificação falsa
// (a validação primária do webhook em si é o token, ver
// paymentWebhookController.js; isso aqui é uma segunda camada).
async function verifyPayment(paymentId) {
  try {
    const { data: payment } = await client.get(`/payments/${paymentId}`);
    return {
      status: mapStatus(payment.status),
      externalReference: payment.externalReference,
      amount: payment.value,
      paymentMethod: payment.billingType === 'PIX' ? 'pix' : payment.billingType?.toLowerCase(),
    };
  } catch (err) {
    logger.error('Falha ao verificar pagamento no Asaas', err.response?.data || err.message);
    throw err;
  }
}

function mapStatus(asaasStatus) {
  const approved = ['RECEIVED', 'CONFIRMED', 'RECEIVED_IN_CASH'];
  const rejected = ['OVERDUE', 'REFUNDED', 'CANCELLED', 'CHARGEBACK_REQUESTED'];
  if (approved.includes(asaasStatus)) return 'approved';
  if (rejected.includes(asaasStatus)) return 'rejected';
  return 'pending';
}

module.exports = { createCharge, createPixCharge, verifyPayment };
