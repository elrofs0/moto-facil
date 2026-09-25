require('dotenv').config();

function required(name, fallback = undefined) {
  const value = process.env[name] ?? fallback;
  if (value === undefined) {
    console.warn(`[env] Variável ${name} não definida — configure o .env antes de ir para produção.`);
  }
  return value;
}

const nodeEnv = process.env.NODE_ENV || 'development';

// Origens de navegador autorizadas a chamar a API (painel admin). Não afeta
// chamadas server-to-server (webhooks do Mercado Pago/Asaas), já que CORS só
// existe pro browser — essas continuam funcionando sempre. Em produção, se
// CORS_ALLOWED_ORIGINS não for definida, cai pro domínio oficial do painel.
// Fora de produção, sem a env var, libera geral pra não travar o dev local.
const defaultCorsOrigins = nodeEnv === 'production'
  ? 'https://motofacil.tech,https://www.motofacil.tech'
  : '*';
const corsAllowedOrigins = (process.env.CORS_ALLOWED_ORIGINS || defaultCorsOrigins)
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

module.exports = {
  port: process.env.PORT || 3000,
  nodeEnv,
  corsAllowedOrigins,

  db: {
    host: required('DB_HOST', 'localhost'),
    port: process.env.DB_PORT || 5432,
    name: required('DB_NAME', 'motofacil'),
    user: required('DB_USER', 'motofacil'),
    password: required('DB_PASSWORD', ''),
  },

  redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',

  evolution: {
    apiUrl: required('EVOLUTION_API_URL'),
    apiKey: required('EVOLUTION_API_KEY'),
    instanceName: required('EVOLUTION_INSTANCE_NAME', 'motofacil'),
  },

  mercadoPago: {
    accessToken: required('MERCADOPAGO_ACCESS_TOKEN'),
    webhookSecret: required('MERCADOPAGO_WEBHOOK_SECRET'),
  },

  // Gateway de pagamento ativo para gerar cobranças reais (corrida) e
  // recarga de carteira do motoboy via Pix. 'asaas' ou 'mercadopago'.
  paymentProvider: process.env.PAYMENT_PROVIDER || 'asaas',

  asaas: {
    apiKey: required('ASAAS_API_KEY'),
    // Sandbox por padrão — troque para a URL de produção só quando tiver
    // testado o fluxo inteiro (ver README, seção "Pagamentos reais").
    baseUrl: process.env.ASAAS_BASE_URL || 'https://api-sandbox.asaas.com/v3',
    webhookToken: process.env.ASAAS_WEBHOOK_TOKEN || '',
  },

  googleMaps: {
    apiKey: process.env.GOOGLE_MAPS_API_KEY || '',
  },

  jwtSecret: required('JWT_SECRET', 'dev-secret-troque-em-producao'),

  // Hash bcrypt da senha do painel admin (ver backend/scripts/create-admin.js
  // pra gerar um novo). Usado em adminController.login — nunca comparar a
  // senha em texto puro diretamente.
  adminPasswordHash: required('ADMIN_PASSWORD_HASH'),

  // Comandos administrativos via WhatsApp, interpretados por IA (Claude).
  // Ver backend/src/chatbot/adminCommandFlow.js
  adminCommands: {
    // Único número autorizado a dar comandos ao painel pelo WhatsApp.
    // Mesmo formato salvo em Driver/User.whatsapp (só dígitos, com DDI —
    // ex: 5555991234567), sem "+" e sem "@s.whatsapp.net".
    adminWhatsapp: process.env.ADMIN_WHATSAPP || '',
    anthropicApiKey: process.env.ANTHROPIC_API_KEY || '',
    anthropicModel: process.env.ANTHROPIC_MODEL || 'claude-sonnet-5',
  },

  // Integração com sistemas parceiros (hoje só o PedidoFácil) — eles pedem
  // despacho pro pool de motoboys MotoFácil via POST /api/partners/dispatch
  // (autenticado por apiKey) quando não têm motoboy próprio disponível.
  // O caminho inverso (avisar o parceiro quando aceita/conclui/cancela)
  // usa pedidoFacilWebhookUrl/Key — ver services/partnerWebhookService.js.
  partner: {
    apiKey: process.env.PARTNER_API_KEY || '',
    pedidoFacilWebhookUrl: process.env.PEDIDOFACIL_WEBHOOK_URL || '',
    pedidoFacilWebhookKey: process.env.PEDIDOFACIL_WEBHOOK_KEY || '',
  },

  pricing: {
    base: parseFloat(process.env.PRECO_BASE || '5.00'),
    perKm: parseFloat(process.env.PRECO_POR_KM || '2.20'),
    perMin: parseFloat(process.env.PRECO_POR_MINUTO || '0.35'),
    // Piso da corrida — sem isso, trajeto curto (ex: endereço de partida e
    // destino quase iguais) podia sair por R$6 ou menos, pouco pro
    // motoboy aceitar.
    minimum: parseFloat(process.env.PRECO_MINIMO || '10.00'),
    // Multiplicador aplicado nos horários de pico (11:30–13:30 e
    // 17:30–19:30, horário local do servidor).
    peakMultiplier: parseFloat(process.env.MULTIPLICADOR_PICO || '1.3'),
    // Multiplicador aplicado quando o modo chuva está ligado no painel
    // (platform_settings, chave 'rain_mode') — ver pricingService.js.
    rainMultiplier: parseFloat(process.env.MULTIPLICADOR_CHUVA || '1.15'),
  },

  // Monetização por LEAD: o cliente sempre paga o motoboy direto (dinheiro
  // ou Pix pessoal dele, nunca passa pela plataforma). A MotoFácil cobra
  // um valor fixo do motoboy por corrida que ele ACEITA, debitado do saldo
  // pré-pago dele. Saldo zerado = ele para de receber ofertas de corrida
  // até recarregar.
  leadFee: {
    amount: parseFloat(process.env.LEAD_FEE_AMOUNT || '3.00'),
  },

  // Sistema de indicação de motoboys: link wa.me pré-preenchido pro próprio
  // número do bot (o mesmo que os clientes já usam), e valor fixo creditado
  // ao indicador a cada corrida completada pelo indicado.
  referral: {
    platformWhatsapp: process.env.PLATFORM_WHATSAPP_NUMBER || '',
    commissionAmount: parseFloat(process.env.REFERRAL_COMMISSION_AMOUNT || '0.50'),
  },
};
