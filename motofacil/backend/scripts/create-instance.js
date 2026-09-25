/**
 * Cria a instância da Evolution API via HTTP, sem passar pelo terminal —
 * elimina de vez qualquer problema de aspas/escape do shell, porque o
 * corpo da requisição é um objeto JS de verdade, serializado pelo axios.
 *
 * Lê EVOLUTION_API_URL, EVOLUTION_API_KEY e EVOLUTION_INSTANCE_NAME do
 * mesmo backend/.env que o resto do sistema já usa — não precisa digitar
 * a chave de novo em lugar nenhum.
 *
 * Uso:
 *   cd backend
 *   node scripts/create-instance.js
 */

require('dotenv').config();
const axios = require('axios');

const API_URL = process.env.EVOLUTION_API_URL;
const API_KEY = process.env.EVOLUTION_API_KEY;
const INSTANCE_NAME = process.env.EVOLUTION_INSTANCE_NAME || 'motofacil';

if (!API_URL || !API_KEY) {
  console.error('EVOLUTION_API_URL e/ou EVOLUTION_API_KEY não estão definidos no backend/.env');
  process.exit(1);
}

// "integration" é um enum fixo da Evolution API v2 — o valor tem que ser
// exatamente esta string. "WHATSAPP", "whatsapp" ou "provider": "whatsapp"
// não existem na v2 e sempre retornam 400 "Invalid integration".
const payload = {
  instanceName: INSTANCE_NAME,
  qrcode: true,
  integration: 'WHATSAPP-BAILEYS',
};

async function main() {
  console.log(`Criando instância "${INSTANCE_NAME}" em ${API_URL}...`);

  try {
    const { data } = await axios.post(`${API_URL}/instance/create`, payload, {
      headers: {
        apikey: API_KEY,
        'Content-Type': 'application/json',
      },
      timeout: 15000,
    });

    console.log('\n✅ Instância criada!');
    console.log('Status:', data.instance?.status || data.status);

    // O token específico da instância vem no campo "hash" (não em
    // "token", apesar do nome sugerir isso) — guarde se for autenticar
    // requisições futuras direto nessa instância em vez do apikey global.
    if (data.hash) console.log('Token da instância (campo "hash"):', data.hash);

    if (data.qrcode?.base64) {
      console.log('\nQR Code recebido em base64 — abra o painel da Evolution API');
      console.log(`(${API_URL}/manager) e escaneie por lá, é mais confiável que renderizar o base64 manualmente aqui no terminal.`);
    } else {
      console.log('\nNenhum QR code veio nessa resposta ainda — confira em:');
      console.log(`GET ${API_URL}/instance/connect/${INSTANCE_NAME}`);
    }
  } catch (err) {
    if (err.response) {
      console.error(`\n❌ Erro ${err.response.status}:`, JSON.stringify(err.response.data, null, 2));
    } else {
      console.error('\n❌ Falha na requisição:', err.message);
    }
    process.exit(1);
  }
}

main();
