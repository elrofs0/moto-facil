const axios = require('axios');
const env = require('../config/env');
const { logger } = require('../utils');
const { normalizeWhatsapp } = require('../utils/phoneUtils');

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

// Envia uma imagem (ex: QR Code Pix) — base64Image é a string base64 PURA
// da imagem, sem o prefixo "data:image/...;base64," (é o formato que
// tanto o Asaas quanto o Mercado Pago já devolvem prontos).
async function sendImage(whatsapp, base64Image, caption = '') {
  try {
    await client.post(`/message/sendMedia/${env.evolution.instanceName}`, {
      number: whatsapp,
      mediatype: 'image',
      mimetype: 'image/png',
      media: base64Image,
      caption,
      fileName: 'qrcode.png',
    });
  } catch (err) {
    logger.error(`Falha ao enviar imagem para ${whatsapp}`, err.response?.data || err.message);
    throw err;
  }
}

// Baixa o conteúdo real (decodificado) de uma mídia recebida — a Evolution
// API NÃO entrega isso pronto no payload do webhook: o que vem lá é, na
// prática, uma URL criptografada nativa do WhatsApp (mmg.whatsapp.net),
// inútil sem a chave de decodificação que só a própria Evolution API tem.
// Esse endpoint dedicado (getBase64FromMediaMessage) recebe a mensagem
// bruta do webhook de volta e devolve o arquivo de verdade, decodificado.
// Usado pra qualquer documento/foto do motoboy (CNH, CRLV, selfie, alvará).
async function fetchMediaBase64(rawMessageData) {
  const { data } = await client.post(`/chat/getBase64FromMediaMessage/${env.evolution.instanceName}`, {
    message: rawMessageData,
  });
  if (!data?.base64) throw new Error('Evolution API não retornou base64 pra essa mídia');
  return { base64: data.base64, mimetype: data.mimetype || 'application/octet-stream' };
}

// Normaliza o payload de webhook recebido da Evolution API para um formato
// simples e estável, isolando o restante do sistema de mudanças no formato
// bruto da API.
function parseIncomingMessage(webhookBody) {
  const data = webhookBody?.data;
  const event = webhookBody?.event;
  if (!data) return null;

  const whatsapp = normalizeWhatsapp(data.key?.remoteJid?.replace('@s.whatsapp.net', ''));
  const messageId = data.key?.id || null;
  const text =
    data.message?.conversation ||
    data.message?.extendedTextMessage?.text ||
    data.message?.buttonsResponseMessage?.selectedButtonId ||
    null;
  // "Localização atual" (locationMessage) e "Localização em tempo real"
  // (liveLocationMessage) são tipos diferentes no protocolo do WhatsApp,
  // mas carregam os mesmos campos de coordenada — tratamos os dois iguais
  // pra não perder a localização de quem manda por tempo real (é a opção
  // mais visível no app, e ficava sendo silenciosamente descartada).
  const locationPayload = data.message?.locationMessage || data.message?.liveLocationMessage;
  const location = locationPayload
    ? { lat: locationPayload.degreesLatitude, lng: locationPayload.degreesLongitude }
    : null;
  // Só sinaliza QUE existe mídia aqui — o conteúdo real (base64) precisa
  // ser buscado à parte via fetchMediaBase64(raw), passando a mensagem
  // bruta completa (é o formato que a Evolution API exige pra decodificar).
  const hasMedia = !!(data.message?.imageMessage || data.message?.documentMessage);

  if (!whatsapp || (!text && !location && !hasMedia)) return null;

  return { event, whatsapp, messageId, text, location, hasMedia, raw: data };
}

module.exports = { sendText, sendImage, fetchMediaBase64, parseIncomingMessage };
