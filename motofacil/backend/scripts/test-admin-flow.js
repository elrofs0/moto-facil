/**
 * Teste funcional do fluxo de comandos administrativos por WhatsApp.
 *
 * Roda o fluxo inteiro (interpretação → desambiguação → confirmação →
 * execução → auditoria) contra um SQLite descartável, sem chamar a API
 * da Anthropic de verdade nem a Evolution API — ambas são substituídas
 * por versões falsas para o teste ser rápido, gratuito e determinístico.
 *
 * Uso:
 *   cd backend
 *   npm install               # se ainda não tiver rodado
 *   node scripts/test-admin-flow.js
 *
 * Se tudo aparecer "ok", o fluxo está funcionando como esperado. Isso
 * NÃO testa a qualidade da interpretação da IA (isso já é coberto pela
 * simulação); para testar a IA de verdade, configure ANTHROPIC_API_KEY
 * no .env e mande uma mensagem de um número autorizado pelo WhatsApp.
 */

process.env.DATABASE_URL = 'sqlite:./test-admin-flow.sqlite';
process.env.ADMIN_WHATSAPP = '5599999999999';
process.env.JWT_SECRET = 'test';
process.env.EVOLUTION_API_URL = 'http://localhost:1';
process.env.EVOLUTION_API_KEY = 'test';
process.env.MERCADOPAGO_ACCESS_TOKEN = 'test';
process.env.MERCADOPAGO_WEBHOOK_SECRET = 'test';
process.env.ANTHROPIC_API_KEY = 'test-key';

const fs = require('fs');
const path = require('path');
process.chdir(path.join(__dirname, '..'));

const DB_FILE = './test-admin-flow.sqlite';

let failures = 0;
function assert(cond, msg) {
  if (!cond) {
    console.error('✗ FALHOU:', msg);
    failures++;
  } else {
    console.log('✓', msg);
  }
}

async function main() {
  // ---- Substitui o Redis por um Map em memória ----
  const redis = require('../src/config/redis');
  const store = new Map();
  redis.get = async (k) => (store.has(k) ? store.get(k) : null);
  redis.set = async (k, v) => { store.set(k, v); return 'OK'; };
  redis.del = async (k) => { store.delete(k); return 1; };

  // ---- Captura mensagens que seriam enviadas pelo WhatsApp ----
  const evolutionService = require('../src/services/evolutionService');
  const sent = [];
  evolutionService.sendText = async (whatsapp, message) => { sent.push({ whatsapp, message }); };

  // ---- Substitui a chamada à IA por respostas pré-definidas por teste ----
  const aiCommandService = require('../src/services/aiCommandService');
  let stub = null;
  aiCommandService.interpretCommand = async () => {
    if (!stub) throw new Error('nenhuma resposta de IA simulada foi definida para este passo');
    return stub;
  };

  const { sequelize, Driver, User, AdminCommandLog } = require('../src/models');
  await sequelize.sync({ force: true });

  const joao1 = await Driver.create({ name: 'João Silva', whatsapp: '5511111111111', status: 'pending_approval' });
  const joao2 = await Driver.create({ name: 'João Pereira', whatsapp: '5511111111112', status: 'available', wallet_balance: 10 });
  const maria = await User.create({ name: 'Maria Souza', whatsapp: '5522222222222' });

  const adminCommandFlow = require('../src/chatbot/adminCommandFlow');
  const ADMIN = '5599999999999';

  // 1. número não autorizado é ignorado
  await adminCommandFlow.handleAdminMessage({ whatsapp: '000', text: 'aprova o joao' });
  assert(sent.length === 0, 'mensagem de número não autorizado é ignorada');

  // 2. nome ambíguo → pede para escolher, e só executa depois da escolha
  stub = { kind: 'action', action: 'approve_driver', params: { driver_name: 'joão' } };
  await adminCommandFlow.handleAdminMessage({ whatsapp: ADMIN, text: 'aprova o joão' });
  assert(sent.length === 1 && /mais de um/i.test(sent.at(-1).message), 'nome ambíguo pede para escolher entre homônimos');

  await adminCommandFlow.handleAdminMessage({ whatsapp: ADMIN, text: '1' });
  await joao1.reload();
  assert(joao1.status === 'offline' && joao1.documents_approved === true, 'motoboy certo (opção 1) foi aprovado após escolha');

  // 3. ação não sensível executa direto, sem pedir confirmação
  stub = { kind: 'action', action: 'get_today_stats', params: {} };
  await adminCommandFlow.handleAdminMessage({ whatsapp: ADMIN, text: 'quantas corridas hoje' });
  assert(/Hoje até agora/.test(sent.at(-1).message), 'consulta de estatísticas roda direto, sem confirmação');

  // 4. ação sensível (carteira) NÃO executa até o "sim"
  stub = { kind: 'action', action: 'adjust_driver_wallet', params: { driver_name: 'pereira', amount: 20, reason: 'recarga pix' } };
  await adminCommandFlow.handleAdminMessage({ whatsapp: ADMIN, text: 'credita 20 pro joao pereira, recarga pix' });
  assert(/Confirma/.test(sent.at(-1).message), 'ação sensível pede confirmação antes de executar');
  await joao2.reload();
  assert(parseFloat(joao2.wallet_balance) === 10, 'saldo não muda antes da confirmação');

  await adminCommandFlow.handleAdminMessage({ whatsapp: ADMIN, text: 'sim' });
  await joao2.reload();
  assert(parseFloat(joao2.wallet_balance) === 30, 'saldo muda só depois do "sim"');

  // 5. ação sensível cancelada com "não" não executa
  stub = { kind: 'action', action: 'set_user_blocked', params: { user_name: 'maria', blocked: true } };
  await adminCommandFlow.handleAdminMessage({ whatsapp: ADMIN, text: 'bloqueia a maria' });
  await adminCommandFlow.handleAdminMessage({ whatsapp: ADMIN, text: 'não, deixa quieto' });
  await maria.reload();
  assert(maria.is_blocked === false, 'usuário não é bloqueado se o admin responde "não"');

  // 6. nome inexistente dá aviso amigável, não erro
  stub = { kind: 'action', action: 'approve_driver', params: { driver_name: 'zzznonexistent' } };
  await adminCommandFlow.handleAdminMessage({ whatsapp: ADMIN, text: 'aprova o zzz' });
  assert(/não encontrei/i.test(sent.at(-1).message), 'nome que não existe retorna aviso amigável');

  // 7. tudo isso fica registrado em admin_command_logs
  const statuses = (await AdminCommandLog.findAll()).map((l) => l.status);
  assert(statuses.includes('executed'), 'log de auditoria registra ações executadas');
  assert(statuses.includes('rejected'), 'log de auditoria registra ações canceladas');
  assert(statuses.includes('failed'), 'log de auditoria registra falhas (ex: nome não encontrado)');

  await sequelize.close();
  fs.unlinkSync(DB_FILE);

  console.log(failures === 0 ? '\n✅ Tudo certo — fluxo de comandos administrativos validado.' : `\n❌ ${failures} verificação(ões) falharam.`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error('ERRO INESPERADO:', err);
  try { fs.unlinkSync(DB_FILE); } catch (_) {}
  process.exit(1);
});
