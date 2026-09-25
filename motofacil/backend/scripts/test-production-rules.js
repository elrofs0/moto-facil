/**
 * Valida as duas regras de negócio mais críticas da rodada de produção:
 *
 * 1. Segmentação passageiro/entregas: um motoboy só pode ser escalado ou
 *    aceitar corrida de PASSAGEIRO se atende_passageiro=true E
 *    autorizadoPrefeitura=true — testa a filtragem (dispatch) E a trava
 *    atômica em acceptRide (dupla checagem, não só filtragem prévia).
 * 2. Precificação dinâmica: horário de pico e modo chuva multiplicam o
 *    preço corretamente, inclusive acumulados.
 *
 * Uso:
 *   cd backend && npm install && node scripts/test-production-rules.js
 */

process.env.DATABASE_URL = 'sqlite:./test-production-rules.sqlite';
process.env.JWT_SECRET = 'test';
process.env.EVOLUTION_API_URL = 'http://localhost:1';
process.env.EVOLUTION_API_KEY = 'test';
process.env.MERCADOPAGO_ACCESS_TOKEN = 'test';
process.env.MERCADOPAGO_WEBHOOK_SECRET = 'test';
process.env.ASAAS_API_KEY = 'test';
process.env.PRECO_BASE = '5.00';
process.env.PRECO_POR_KM = '2.00';
process.env.PRECO_POR_MINUTO = '0.30';
process.env.MULTIPLICADOR_PICO = '1.3';
process.env.MULTIPLICADOR_CHUVA = '1.15';

const fs = require('fs');
const path = require('path');
process.chdir(path.join(__dirname, '..'));
const DB_FILE = './test-production-rules.sqlite';

let failures = 0;
function assert(cond, msg) {
  if (!cond) { console.error('✗ FALHOU:', msg); failures++; }
  else console.log('✓', msg);
}

async function main() {
  const { sequelize, Driver } = require('../src/models');
  await sequelize.sync({ force: true });

  // ---------------- 1. Precificação dinâmica ----------------
  const settingsService = require('../src/services/settingsService');
  const pricingService = require('../src/services/pricingService');

  let rainOn = false;
  settingsService.isRainModeOn = async () => rainOn;

  const offPeakOffRain = await pricingService.calculatePrice(10, 20, { at: new Date('2026-01-01T09:00:00') });
  const expectedBase = 5 + 10 * 2 + 20 * 0.3; // 31
  assert(Math.abs(offPeakOffRain.price - expectedBase) < 0.01, `preço base sem pico/chuva = R$ ${expectedBase.toFixed(2)} (obtido: ${offPeakOffRain.price})`);

  const peakOffRain = await pricingService.calculatePrice(10, 20, { at: new Date('2026-01-01T12:00:00') });
  assert(Math.abs(peakOffRain.price - expectedBase * 1.3) < 0.01, 'preço em horário de pico aplica multiplicador 1.3x');
  assert(peakOffRain.breakdown.peakApplied === true, 'breakdown indica peakApplied=true no horário de pico');

  rainOn = true;
  const peakAndRain = await pricingService.calculatePrice(10, 20, { at: new Date('2026-01-01T18:00:00') });
  assert(Math.abs(peakAndRain.price - expectedBase * 1.3 * 1.15) < 0.01, 'pico + chuva acumulam os dois multiplicadores (1.3 × 1.15)');
  rainOn = false;

  const offPeakTime = await pricingService.calculatePrice(10, 20, { at: new Date('2026-01-01T15:00:00') });
  assert(Math.abs(offPeakTime.price - expectedBase) < 0.01, 'fora do horário de pico não aplica multiplicador');

  // ---------------- 2. Segmentação passageiro vs. entregas ----------------
  const rideService = require('../src/services/rideService');

  const naoAutorizado = await Driver.create({
    name: 'Motoboy Não Autorizado', whatsapp: '5511100000001',
    atende_entregas: true, atende_passageiro: true, autorizadoPrefeitura: false,
    status: 'available', documents_approved: true, last_lat: -29.6842, last_lng: -53.8069,
  });
  const autorizado = await Driver.create({
    name: 'Motoboy Autorizado', whatsapp: '5511100000002',
    atende_entregas: true, atende_passageiro: true, autorizadoPrefeitura: true,
    status: 'available', documents_approved: true, last_lat: -29.6842, last_lng: -53.8069,
    wallet_balance: 20.00, // precisa cobrir o lead fee pra conseguir aceitar no teste abaixo
  });
  const soEntrega = await Driver.create({
    name: 'Motoboy Só Entrega', whatsapp: '5511100000003',
    atende_entregas: true, atende_passageiro: false, autorizadoPrefeitura: false,
    status: 'available', documents_approved: true, last_lat: -29.6842, last_lng: -53.8069,
  });

  assert(rideService.isDriverEligibleForRideType(naoAutorizado, 'passenger') === false, 'atende_passageiro=true mas autorizadoPrefeitura=false → NÃO elegível para passageiro');
  assert(rideService.isDriverEligibleForRideType(autorizado, 'passenger') === true, 'atende_passageiro=true E autorizadoPrefeitura=true → elegível para passageiro');
  assert(rideService.isDriverEligibleForRideType(soEntrega, 'passenger') === false, 'atende_passageiro=false → NÃO elegível para passageiro, mesmo que fosse autorizado');
  assert(rideService.isDriverEligibleForRideType(soEntrega, 'delivery') === true, 'atende_entregas=true → elegível para entrega');

  const { User, Ride } = require('../src/models');
  const dummyClient = await User.create({ name: 'Cliente Teste', whatsapp: '5511999999999' });
  const passengerRide = await Ride.create({
    tracking_code: 'TESTE001', type: 'passenger', client_id: dummyClient.id,
    status: 'searching_driver', origin_address: 'A', destination_address: 'B',
    price: 20, payment_method: 'cash',
  });

  let threw = false;
  try {
    await rideService.acceptRide(passengerRide.id, naoAutorizado.id);
  } catch (err) {
    threw = err.message.startsWith('NOT_AUTHORIZED_PASSENGER:');
  }
  assert(threw, 'acceptRide REJEITA motoboy não autorizado tentando aceitar corrida de passageiro (trava no servidor, não só no dispatch)');

  await passengerRide.reload();
  assert(passengerRide.status === 'searching_driver' && !passengerRide.driver_id, 'corrida NÃO foi atribuída ao motoboy não autorizado');

  const { ride: accepted, driverBalance } = await rideService.acceptRide(passengerRide.id, autorizado.id);
  assert(accepted.status === 'accepted' && accepted.driver_id === autorizado.id, 'motoboy autorizado consegue aceitar a mesma corrida normalmente');
  assert(typeof driverBalance === 'number', 'acceptRide também retorna o saldo atualizado do motoboy (usado na mensagem de confirmação)');

  // ---------------- 3. Lead fee: cobra só de quem FICA com a corrida ----------------
  const env = require('../src/config/env');
  await autorizado.reload();
  assert(
    Math.abs(parseFloat(autorizado.wallet_balance) - (20.00 - env.leadFee.amount)) < 0.01,
    `lead fee (R$ ${env.leadFee.amount.toFixed(2)}) foi debitado do saldo do motoboy que aceitou`
  );

  const { WalletTransaction } = require('../src/models');
  const leadTx = await WalletTransaction.findOne({ where: { driver_id: autorizado.id, ride_id: passengerRide.id } });
  assert(leadTx && leadTx.type === 'debit' && parseFloat(leadTx.amount) === env.leadFee.amount, 'ficou registrado em wallet_transactions, auditável');

  // Segundo motoboy tentando aceitar a MESMA corrida depois que ela já foi
  // travada pelo primeiro — precisa falhar SEM debitar nada dele.
  const terceiro = await Driver.create({
    name: 'Motoboy Perdeu a Corrida', whatsapp: '5511100000004',
    atende_entregas: true, atende_passageiro: true, autorizadoPrefeitura: true,
    status: 'available', documents_approved: true, last_lat: -29.6842, last_lng: -53.8069,
    wallet_balance: 20.00,
  });
  let segundoRejeitado = false;
  try {
    await rideService.acceptRide(passengerRide.id, terceiro.id);
  } catch (err) {
    segundoRejeitado = err.message.includes('já foi aceita');
  }
  assert(segundoRejeitado, 'segundo motoboy tentando aceitar a mesma corrida é rejeitado');
  await terceiro.reload();
  assert(parseFloat(terceiro.wallet_balance) === 20.00, 'segundo motoboy NÃO foi cobrado — só quem ficou com a corrida paga o lead');

  // Motoboy sem saldo suficiente não consegue aceitar, e a corrida some da
  // busca de disponíveis (findNearbyAvailableDrivers já filtra por saldo).
  const semSaldo = await Driver.create({
    name: 'Motoboy Sem Saldo', whatsapp: '5511100000005',
    atende_entregas: true, atende_passageiro: false, autorizadoPrefeitura: false,
    status: 'available', documents_approved: true, last_lat: -29.6842, last_lng: -53.8069,
    wallet_balance: 0.50, // menos que o lead fee padrão
  });
  const deliveryRide = await Ride.create({
    tracking_code: 'TESTE002', type: 'delivery', client_id: dummyClient.id,
    status: 'searching_driver', origin_address: 'A', destination_address: 'B',
    price: 15, payment_method: 'cash',
  });
  let semSaldoRejeitado = false;
  try {
    await rideService.acceptRide(deliveryRide.id, semSaldo.id);
  } catch (err) {
    semSaldoRejeitado = err.message.startsWith('SALDO_INSUFICIENTE:');
  }
  assert(semSaldoRejeitado, 'motoboy sem saldo suficiente é impedido de aceitar (e a corrida continua disponível)');

  const nearby = await rideService.findNearbyAvailableDrivers(deliveryRide);
  assert(!nearby.some((d) => d.id === semSaldo.id), 'motoboy sem saldo nem aparece na lista de quem recebe a oferta');

  await sequelize.close();
  fs.unlinkSync(DB_FILE);

  console.log(failures === 0 ? '\n✅ Regras de negócio validadas.' : `\n❌ ${failures} verificação(ões) falharam.`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error('ERRO INESPERADO:', err);
  try { fs.unlinkSync(DB_FILE); } catch (_) {}
  process.exit(1);
});
