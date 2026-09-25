/**
 * Recria a instância e pega o QR Code (ou código de pareamento) usando o
 * ÚNICO endpoint real da Evolution API v2 pra isso: GET /instance/connect/{instance}
 *
 * As rotas /instance/connect/phone/{nome}, /instance/connect/code/{nome} e o
 * POST em /instance/connect/phone NÃO EXISTEM na v2 — não é bug seu, é rota
 * inventada/copiada de algum lugar errado. É só essa mesma que existe:
 *   GET /instance/connect/{instance}              → devolve o QR Code (base64)
 *   GET /instance/connect/{instance}?number=55...  → devolve código de pareamento
 *
 * Uso:
 *   cd backend
 *   node scripts/gerar-robo.js
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const axios = require('axios');

const API_URL = process.env.EVOLUTION_API_URL;
const API_KEY = process.env.EVOLUTION_API_KEY;
const INSTANCE_NAME = process.env.EVOLUTION_INSTANCE_NAME || 'motofacil_bot';
const PHONE_NUMBER = process.env.EVOLUTION_PHONE_NUMBER || null; // ex: 5555991695142, opcional
const QRCODE_OUTPUT_PATH = path.join(__dirname, '..', '..', 'qrcode.html');

if (!API_URL || !API_KEY) {
  console.error('EVOLUTION_API_URL e/ou EVOLUTION_API_KEY não estão definidos no backend/.env');
  process.exit(1);
}

const client = axios.create({
  baseURL: API_URL,
  headers: { apikey: API_KEY, 'Content-Type': 'application/json' },
  timeout: 15000,
});

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function deleteOldInstance() {
  try {
    await client.delete(`/instance/delete/${INSTANCE_NAME}`);
    console.log(`🗑️  Instância "${INSTANCE_NAME}" antiga removida — confirmando...`);
  } catch (err) {
    if (err.response?.status === 404) {
      console.log('Nenhuma instância antiga encontrada — seguindo direto pra criação.');
    } else {
      console.warn('Aviso ao apagar instância antiga (seguindo mesmo assim):', err.response?.data || err.message);
    }
    return;
  }

  // O DELETE responder OK não significa que já propagou de verdade — já
  // vimos o CREATE seguinte bater "nome já em uso" logo depois de um
  // delete "bem-sucedido". Confirma de verdade, checando a lista, antes
  // de seguir — evita a corrida entre apagar e criar.
  for (let attempt = 1; attempt <= 10; attempt++) {
    await sleep(1000);
    try {
      const { data } = await client.get('/instance/fetchInstances');
      const stillExists = Array.isArray(data) && data.some((i) => i.name === INSTANCE_NAME || i.instanceName === INSTANCE_NAME);
      if (!stillExists) {
        console.log('✅ Remoção confirmada.');
        return;
      }
      console.log(`Ainda aparece na lista, esperando... (${attempt}/10)`);
    } catch (err) {
      // segue tentando
    }
  }
  console.warn('⚠️  Não consegui confirmar a remoção em 10s — seguindo mesmo assim, pode falhar com "já em uso".');
}

async function waitForApiReady() {
  console.log('Aguardando a Evolution API responder...');
  for (let attempt = 1; attempt <= 15; attempt++) {
    try {
      await client.get('/instance/fetchInstances');
      console.log('✅ API respondendo.');
      return;
    } catch (err) {
      if (attempt === 15) throw new Error('Evolution API não respondeu a tempo. Confira `docker compose logs evolution`.');
      await sleep(2000);
    }
  }
}

async function createInstance() {
  console.log(`Criando instância "${INSTANCE_NAME}"...`);
  const { data } = await client.post('/instance/create', {
    instanceName: INSTANCE_NAME,
    qrcode: true,
    integration: 'WHATSAPP-BAILEYS',
  });
  return data;
}

// Único endpoint real pra isso na v2. Sem "number", devolve QR (base64).
// Com "number", devolve código de pareamento de 6 dígitos em vez de QR.
// 30 tentativas de 3s = até 90s de espera — a primeira conexão do Baileys
// (sem cache nenhum, sessão nova) pode legitimamente demorar mais que os
// 12s que a versão anterior deste script esperava.
async function getConnectData() {
  const path = PHONE_NUMBER
    ? `/instance/connect/${INSTANCE_NAME}?number=${PHONE_NUMBER}`
    : `/instance/connect/${INSTANCE_NAME}`;

  for (let attempt = 1; attempt <= 30; attempt++) {
    await sleep(3000);
    try {
      const { data } = await client.get(path);
      if (data.base64 || data.pairingCode || data.code) return data;
      console.log(`Tentativa ${attempt}/30 — instância ainda conectando (status ainda sem QR pronto)...`);
    } catch (err) {
      console.log(`Tentativa ${attempt}/30 — API ainda não tem o QR pronto...`);
    }
  }
  return null;
}

function saveQrCodeHtml(base64) {
  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<title>MotoFácil — Conectar WhatsApp</title>
<style>
  body { font-family: system-ui, sans-serif; background: #F6F1E7; display: flex;
         flex-direction: column; align-items: center; justify-content: center;
         min-height: 100vh; margin: 0; padding: 24px; text-align: center; }
  h1 { color: #17452F; font-size: 20px; margin-bottom: 4px; }
  p { color: #555; font-size: 14px; max-width: 360px; }
  img { margin-top: 16px; width: 300px; height: 300px; border: 1px solid #ddd;
        border-radius: 8px; background: white; padding: 12px; }
  .aviso { margin-top: 16px; font-size: 12px; color: #97591A; }
</style>
</head>
<body>
  <h1>MotoFácil — conectar WhatsApp</h1>
  <p>Abra o WhatsApp Business no celular do número dedicado da MotoFácil →
  Aparelhos conectados → Conectar um aparelho, e escaneie o código abaixo.</p>
  <img src="data:image/png;base64,${base64}" alt="QR Code WhatsApp" />
  <p class="aviso">O QR Code expira rápido (~60s). Se der "expirado" ao
  escanear, rode <code>node scripts/gerar-robo.js</code> de novo.</p>
</body>
</html>`;

  fs.writeFileSync(QRCODE_OUTPUT_PATH, html, 'utf-8');
  console.log(`\n✅ QR Code salvo em: ${QRCODE_OUTPUT_PATH}`);
  console.log('   Abra esse arquivo com dois cliques para escanear.');
}

async function main() {
  await deleteOldInstance();
  await waitForApiReady();
  await createInstance();

  const connectData = await getConnectData();
  if (!connectData) {
    console.error('\n❌ A API não devolveu QR nem código de pareamento a tempo.');
    console.error('   Isso costuma ser o bug conhecido do issue #2437 do repositório');
    console.error('   oficial (servidor sobrecarrega gerando as pre-keys). Confirme que');
    console.error('   as variáveis CACHE_REDIS_ENABLED=false / CACHE_LOCAL_ENABLED=true /');
    console.error('   DATABASE_SAVE_DATA_* =false estão no docker-compose.yml, suba de');
    console.error('   novo (`docker compose up -d`) e rode este script outra vez.');
    process.exit(1);
  }

  if (connectData.pairingCode || connectData.code) {
    const code = connectData.pairingCode || connectData.code;
    console.log('\n🚀 Código de pareamento — digite no celular:');
    console.log(`\n👉  ${code}  👈\n`);
    return;
  }

  saveQrCodeHtml(connectData.base64);
}

main().catch((err) => {
  if (err.response) {
    console.error(`\n❌ Erro ${err.response.status}:`, JSON.stringify(err.response.data, null, 2));
  } else {
    console.error('\n❌ Falha:', err.message);
  }
  process.exit(1);
});
