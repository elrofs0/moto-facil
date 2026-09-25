const axios = require('axios');
const env = require('../config/env');
const { logger } = require('../utils');

// Interpreta a mensagem em linguagem natural do admin e devolve UMA ação
// estruturada (ou nenhuma, se for só uma dúvida/conversa). A IA nunca
// executa nada diretamente — só decide "o que" fazer; quem decide "pode
// fazer agora ou precisa confirmar" e quem de fato executa é o
// chatbot/adminCommandFlow.js. Isso mantém a parte arriscada (mexer no
// banco) fora do controle do modelo.

const TOOLS = [
  {
    name: 'approve_driver',
    description: 'Aprova o cadastro de um motoboy que está aguardando aprovação, liberando-o para operar.',
    input_schema: {
      type: 'object',
      properties: { driver_name: { type: 'string', description: 'Nome (ou parte do nome) do motoboy' } },
      required: ['driver_name'],
    },
  },
  {
    name: 'set_driver_status',
    description: 'Muda o status de um motoboy — usado principalmente para bloquear (status "blocked") ou desbloquear (volta para "offline") um motoboy.',
    input_schema: {
      type: 'object',
      properties: {
        driver_name: { type: 'string' },
        status: { type: 'string', enum: ['available', 'busy', 'offline', 'blocked'] },
      },
      required: ['driver_name', 'status'],
    },
  },
  {
    name: 'adjust_driver_wallet',
    description: 'Credita ou debita valor na carteira de um motoboy. Use amount negativo para debitar.',
    input_schema: {
      type: 'object',
      properties: {
        driver_name: { type: 'string' },
        amount: { type: 'number', description: 'Positivo credita, negativo debita' },
        reason: { type: 'string', description: 'Motivo do ajuste, curto' },
      },
      required: ['driver_name', 'amount', 'reason'],
    },
  },
  {
    name: 'set_user_blocked',
    description: 'Bloqueia ou desbloqueia um cliente/usuário da plataforma.',
    input_schema: {
      type: 'object',
      properties: {
        user_name: { type: 'string' },
        blocked: { type: 'boolean', description: 'true para bloquear, false para desbloquear' },
      },
      required: ['user_name', 'blocked'],
    },
  },
  {
    name: 'get_today_stats',
    description: 'Consulta o resumo de corridas e faturamento do dia de hoje.',
    input_schema: { type: 'object', properties: {} },
  },
];

const SYSTEM_PROMPT = `Você interpreta comandos em português que o administrador da MotoFácil
(marketplace de moto-táxi/entregas via WhatsApp em Santa Maria, RS) manda pelo próprio WhatsApp
para operar o painel administrativo.

Regras:
- Se a mensagem pedir claramente uma das ações disponíveis, chame a ferramenta correspondente.
- Se faltar informação essencial (ex: pediu para ajustar carteira mas não disse o valor), NÃO
  chame nenhuma ferramenta — responda em texto pedindo a informação que falta.
- Se a mensagem não for um comando (cumprimento, dúvida, conversa solta), responda em texto,
  curto e cordial, sem chamar nenhuma ferramenta.
- Nunca invente nomes, valores ou motivos que o admin não disse.`;

async function interpretCommand(text) {
  if (!env.adminCommands.anthropicApiKey) {
    throw new Error('ANTHROPIC_API_KEY não configurada — defina no .env para habilitar os comandos por IA.');
  }

  const response = await axios.post(
    'https://api.anthropic.com/v1/messages',
    {
      model: env.adminCommands.anthropicModel,
      max_tokens: 512,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: text }],
      tools: TOOLS,
    },
    {
      headers: {
        'x-api-key': env.adminCommands.anthropicApiKey,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json',
      },
      timeout: 15000,
    }
  );

  const blocks = response.data?.content || [];
  const toolUse = blocks.find((b) => b.type === 'tool_use');
  const text_ = blocks.filter((b) => b.type === 'text').map((b) => b.text).join('\n').trim();

  if (toolUse) {
    return { kind: 'action', action: toolUse.name, params: toolUse.input, assistantText: text_ || null };
  }

  return { kind: 'text', assistantText: text_ || 'Não entendi. Pode reformular?' };
}

module.exports = { interpretCommand, TOOLS };
