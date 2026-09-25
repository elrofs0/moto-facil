const env = require('../config/env');
const { logger } = require('../utils');
const evolutionService = require('../services/evolutionService');
const aiCommandService = require('../services/aiCommandService');
const adminActions = require('../services/adminActionsService');
const pendingState = require('../services/adminCommandStateService');
const { AdminCommandLog } = require('../models');

// Fluxo de comandos administrativos por WhatsApp, interpretados por IA.
// Só roda para o número em ADMIN_COMMANDS.adminWhatsapp — o webhook
// controller decide isso antes de chamar handleAdminMessage.
//
// Ações que mexem em bloqueio de conta ou dinheiro NUNCA executam direto:
// a IA propõe, o admin confirma respondendo "sim"/"não", e só então a
// ação roda. Toda tentativa (executada, cancelada ou com erro) fica
// registrada em admin_command_logs.

const SENSITIVE_ACTIONS = new Set(['adjust_driver_wallet', 'set_user_blocked']);

function isSensitive(action, params) {
  if (SENSITIVE_ACTIONS.has(action)) return true;
  if (action === 'set_driver_status' && params.status === 'blocked') return true;
  return false;
}

function isAffirmative(text) {
  const t = normalizeSimple(text);
  return ['sim', 'confirma', 'confirmar', 'pode', 'ok', 'isso', 'positivo', 'yes'].some((w) => t.includes(w));
}

function isNegative(text) {
  const t = normalizeSimple(text);
  return ['nao', 'não', 'cancela', 'cancelar', 'negativo', 'no'].some((w) => t.includes(w));
}

function normalizeSimple(text) {
  return (text || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
}

async function logCommand({ whatsapp, rawMessage, action, params, status, resultMessage }) {
  try {
    await AdminCommandLog.create({
      admin_whatsapp: whatsapp,
      raw_message: rawMessage,
      action: action || null,
      action_params: params || null,
      status,
      result_message: resultMessage || null,
    });
  } catch (err) {
    logger.error('Falha ao registrar admin_command_log', err);
  }
}

async function reply(whatsapp, message) {
  await evolutionService.sendText(whatsapp, message);
}

// Executa de fato a ação já resolvida (com IDs reais, não mais nomes).
async function executeAction(action, params) {
  switch (action) {
    case 'approve_driver': {
      const driver = await adminActions.approveDriver(params.driver_id);
      return `✅ ${driver.name} foi aprovado e já pode operar.`;
    }
    case 'set_driver_status': {
      const driver = await adminActions.setDriverStatus(params.driver_id, params.status);
      const labels = { available: 'disponível', busy: 'em corrida', offline: 'offline', blocked: 'bloqueado' };
      return `✅ ${driver.name} agora está ${labels[params.status] || params.status}.`;
    }
    case 'adjust_driver_wallet': {
      const balance = await adminActions.adjustDriverWallet(params.driver_id, params.amount, params.reason);
      const verbo = params.amount > 0 ? 'creditado' : 'debitado';
      return `✅ Valor ${verbo} na carteira de ${params.driver_name}. Novo saldo: R$ ${balance.toFixed(2)}.`;
    }
    case 'set_user_blocked': {
      const user = await adminActions.setUserBlocked(params.user_id, params.blocked);
      return params.blocked
        ? `✅ ${user.name} foi bloqueado.`
        : `✅ ${user.name} foi desbloqueado.`;
    }
    case 'get_today_stats': {
      const s = await adminActions.getTodayStats();
      return `📊 Hoje até agora:\n` +
        `• ${s.totalRides} corrida(s) concluída(s)\n` +
        `• Faturamento (leads): R$ ${s.totalLeadFees}\n` +
        `• Recarregado pelos motoboys: R$ ${s.totalRecharges}\n` +
        `• Corridas em andamento agora: ${s.activeRides}`;
    }
    default:
      throw new Error(`Ação desconhecida: ${action}`);
  }
}

function confirmationSummary(action, params) {
  switch (action) {
    case 'adjust_driver_wallet':
      return `Confirma ${params.amount > 0 ? 'creditar' : 'debitar'} R$ ${Math.abs(params.amount).toFixed(2)} ` +
        `na carteira de ${params.driver_name} (motivo: ${params.reason})? Responda *sim* ou *não*.`;
    case 'set_user_blocked':
      return `Confirma ${params.blocked ? 'bloquear' : 'desbloquear'} o usuário ${params.user_name}? Responda *sim* ou *não*.`;
    case 'set_driver_status':
      return `Confirma bloquear o motoboy ${params.driver_name}? Ele não vai mais receber corridas. Responda *sim* ou *não*.`;
    default:
      return `Confirma essa ação? Responda *sim* ou *não*.`;
  }
}

// Resolve o nome dito pelo admin para um registro real. Retorna:
// { resolved: {id, name} } | { ambiguous: [...] } | { notFound: true }
async function resolveEntity(action, params) {
  if (action === 'get_today_stats') return { resolved: null };

  if (action === 'set_user_blocked') {
    const matches = await adminActions.findUsersByName(params.user_name);
    if (matches.length === 0) return { notFound: true, entityLabel: 'usuário' };
    if (matches.length > 1) return { ambiguous: matches, entityLabel: 'usuário' };
    return { resolved: matches[0] };
  }

  // approve_driver, set_driver_status, adjust_driver_wallet — todas por driver_name
  const matches = await adminActions.findDriversByName(params.driver_name);
  if (matches.length === 0) return { notFound: true, entityLabel: 'motoboy' };
  if (matches.length > 1) return { ambiguous: matches, entityLabel: 'motoboy' };
  return { resolved: matches[0] };
}

function withResolvedId(action, params, entity) {
  if (action === 'set_user_blocked') return { ...params, user_id: entity.id, user_name: entity.name };
  return { ...params, driver_id: entity.id, driver_name: entity.name };
}

// Ponto de entrada único, chamado pelo webhook controller.
async function handleAdminMessage({ whatsapp, text }) {
  if (whatsapp !== env.adminCommands.adminWhatsapp) {
    logger.warn(`Mensagem de comando admin recebida de número não autorizado: ${whatsapp}`);
    return;
  }

  const pending = await pendingState.getPending(whatsapp);

  if (pending?.type === 'confirmation') {
    if (isAffirmative(text)) {
      await pendingState.clearPending(whatsapp);
      try {
        const resultMessage = await executeAction(pending.action, pending.params);
        await reply(whatsapp, resultMessage);
        await logCommand({ whatsapp, rawMessage: text, action: pending.action, params: pending.params, status: 'executed', resultMessage });
      } catch (err) {
        const msg = `⚠️ Não consegui concluir: ${err.message}`;
        await reply(whatsapp, msg);
        await logCommand({ whatsapp, rawMessage: text, action: pending.action, params: pending.params, status: 'failed', resultMessage: err.message });
      }
      return;
    }
    if (isNegative(text)) {
      await pendingState.clearPending(whatsapp);
      await reply(whatsapp, 'Ação cancelada.');
      await logCommand({ whatsapp, rawMessage: text, action: pending.action, params: pending.params, status: 'rejected' });
      return;
    }
    await reply(whatsapp, 'Não entendi. Responda *sim* para confirmar ou *não* para cancelar.');
    return;
  }

  if (pending?.type === 'disambiguation') {
    const index = parseInt(text.trim(), 10);
    const candidate = Number.isInteger(index) ? pending.candidates[index - 1] : null;
    if (!candidate) {
      await reply(whatsapp, 'Responda só com o número da lista, por favor.');
      return;
    }
    await pendingState.clearPending(whatsapp);
    const params = withResolvedId(pending.action, pending.params, candidate);
    await dispatch({ whatsapp, rawMessage: text, action: pending.action, params });
    return;
  }

  // Sem estado pendente — interpreta a mensagem do zero.
  if (!env.adminCommands.anthropicApiKey) {
    await reply(whatsapp, '⚠️ Comandos por IA ainda não estão configurados (falta ANTHROPIC_API_KEY). Use o painel web pra essas ações por enquanto.');
    return;
  }

  let interpretation;
  try {
    interpretation = await aiCommandService.interpretCommand(text);
  } catch (err) {
    logger.error('Erro chamando a IA de comandos administrativos', err.response?.data || err.message);
    await reply(whatsapp, '⚠️ Não consegui processar o comando agora. Tenta de novo em instantes.');
    return;
  }

  if (interpretation.kind === 'text') {
    await reply(whatsapp, interpretation.assistantText);
    await logCommand({ whatsapp, rawMessage: text, status: 'info', resultMessage: interpretation.assistantText });
    return;
  }

  await dispatch({ whatsapp, rawMessage: text, action: interpretation.action, params: interpretation.params });
}

// Resolve nomes, desambigua se preciso, e decide se executa direto ou
// pede confirmação — usado tanto na primeira interpretação quanto depois
// de uma desambiguação já resolvida.
async function dispatch({ whatsapp, rawMessage, action, params }) {
  const resolution = await resolveEntity(action, params);

  if (resolution.notFound) {
    const msg = `Não encontrei nenhum ${resolution.entityLabel} com esse nome.`;
    await reply(whatsapp, msg);
    await logCommand({ whatsapp, rawMessage, action, params, status: 'failed', resultMessage: msg });
    return;
  }

  if (resolution.ambiguous) {
    const list = resolution.ambiguous.map((c, i) => `${i + 1}. ${c.name}`).join('\n');
    await pendingState.setPending(whatsapp, {
      type: 'disambiguation',
      action,
      params,
      candidates: resolution.ambiguous.map((c) => ({ id: c.id, name: c.name })),
    });
    await reply(whatsapp, `Encontrei mais de um ${resolution.entityLabel} com esse nome. Qual deles?\n\n${list}\n\nResponda com o número.`);
    return;
  }

  const finalParams = resolution.resolved ? withResolvedId(action, params, resolution.resolved) : params;

  if (isSensitive(action, finalParams)) {
    await pendingState.setPending(whatsapp, { type: 'confirmation', action, params: finalParams });
    await reply(whatsapp, confirmationSummary(action, finalParams));
    await logCommand({ whatsapp, rawMessage, action, params: finalParams, status: 'proposed' });
    return;
  }

  try {
    const resultMessage = await executeAction(action, finalParams);
    await reply(whatsapp, resultMessage);
    await logCommand({ whatsapp, rawMessage, action, params: finalParams, status: 'executed', resultMessage });
  } catch (err) {
    const msg = `⚠️ Não consegui concluir: ${err.message}`;
    await reply(whatsapp, msg);
    await logCommand({ whatsapp, rawMessage, action, params: finalParams, status: 'failed', resultMessage: err.message });
  }
}

module.exports = { handleAdminMessage };
