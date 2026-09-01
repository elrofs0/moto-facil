const axios = require('axios');
const env = require('../config/env');
const { logger } = require('../utils');

// Cliente HTTP para a Evolution API. Toda a comunicação com o WhatsApp do
// MotoFácil passa por aqui — nenhum outro arquivo deve chamar a Evolution
// API diretamente, para manter um único ponto de manutenção se a versão
// da API mudar ou se decidirmos migrar para o WhatsApp Business Cloud API
// oficial no futuro (ver README, seção "Evolution API não é oficial").
const client = axios.create({
  baseURL: env.evolution.apiUrl,
  headers: {
    apikey: env.evolution.apiKey,
    'Content-Type': 'application/json',
  },
  timeout: 10000,
});

async function sendText(whatsapp, message) {
  try {
    await client.post(`/message/sendText/${env.evolution.instanceName}`, {
      number: whatsapp,
      text: message,
    });
  } catch (err) {
    logger.error(`Falha ao enviar texto para ${whatsapp}`, err.response?.data || err.message);
    throw err;
  }
}

// Envia mensagem com botões interativos — usado, por exemplo, para o
// motoboy responder [Aceitar] / [Recusar] a uma oferta de corrida.
async function sendButtons(whatsapp, title, description, buttons) {
  try {
    await client.post(`/message/sendButtons/${env.evolution.instanceName}`, {
      number: whatsapp,
      title,
      description,
      buttons: buttons.map((b) => ({
        buttonText: { displayText: b.label },
        buttonId: b.id,
      })),
    });
  } catch (err) {
    logger.error(`Falha ao enviar botões para ${whatsapp}`, err.response?.data || err.message);
    throw err;
  }
}

// Normaliza o payload de webhook recebido da Evolution API para um formato
// simples e estável, isolando o restante do sistema de mudanças no formato
// bruto da API.
function parseIncomingMessage(webhookBody) {
  const data = webhookBody?.data;
  if (!data) return null;

  const whatsapp = data.key?.remoteJid?.replace('@s.whatsapp.net', '');
  const text =
    data.message?.conversation ||
    data.message?.extendedTextMessage?.text ||
    data.message?.buttonsResponseMessage?.selectedButtonId ||
    null;
  const location = data.message?.locationMessage
    ? { lat: data.message.locationMessage.degreesLatitude, lng: data.message.locationMessage.degreesLongitude }
    : null;

  if (!whatsapp || (!text && !location)) return null;

  return { whatsapp, text, location, raw: data };
}

module.exports = { sendText, sendButtons, parseIncomingMessage };
