const { Driver, User, Ride, Vehicle, WalletTransaction, WalletRecharge, sequelize } = require('../models');
const { Op } = require('sequelize');
const { AppError } = require('../middleware/errorHandler');
const walletService = require('./walletService');
const { normalizeWhatsapp } = require('../utils/phoneUtils');
const evolutionService = require('./evolutionService');
const { logger } = require('../utils');

// Toda ação administrativa "de verdade" mora aqui — os controllers HTTP e
// o fluxo de comandos por IA do WhatsApp (chatbot/adminCommandFlow.js)
// chamam as mesmas funções, então o painel e o WhatsApp nunca podem ficar
// com comportamento divergente para a mesma ação.

const DRIVER_STATUSES = ['available', 'busy', 'offline', 'blocked'];

// As fotos de documento (base64) são pesadas — nunca trazer isso na
// listagem geral, só a informação de "tem ou não tem" pra sinalizar o
// que falta revisar. Ver getDriverDocuments pra buscar o conteúdo real,
// sob demanda, de UM motoboy por vez.
const HEAVY_DOCUMENT_FIELDS = {
  cnh_foto: 'hasCnhFoto',
  crlv_foto: 'hasCrlvFoto',
  selfie_foto: 'hasSelfieFoto',
  alvara_document: 'hasAlvaraDocument',
};

async function listDrivers(status) {
  return Driver.findAll({
    where: status ? { status } : {},
    order: [['created_at', 'DESC']],
    attributes: {
      exclude: Object.keys(HEAVY_DOCUMENT_FIELDS),
      include: Object.entries(HEAVY_DOCUMENT_FIELDS).map(([field, alias]) => [
        sequelize.literal(`${field} IS NOT NULL`),
        alias,
      ]),
    },
  });
}

// Busca o conteúdo real dos documentos de UM motoboy — usado só na tela de
// revisão do painel, nunca na listagem (ver HEAVY_DOCUMENT_FIELDS acima).
async function getDriverDocuments(driverId) {
  const driver = await Driver.findByPk(driverId, {
    attributes: ['id', 'name', 'cnh_numero', 'cnh_foto', 'crlv_foto', 'selfie_foto', 'alvara_document'],
  });
  if (!driver) throw new AppError('Motoboy não encontrado', 404);
  return driver;
}

async function approveDriver(driverId) {
  const driver = await Driver.findByPk(driverId);
  if (!driver) throw new AppError('Motoboy não encontrado', 404);
  await driver.update({ status: 'offline', documents_approved: true });

  // Aviso não pode travar a aprovação em si — se o WhatsApp falhar, o
  // motoboy já foi aprovado no banco mesmo assim (mesmo padrão da
  // mensagem de boas-vindas em driverController.createDriver).
  evolutionService.sendText(
    driver.whatsapp,
    '✅ Seu cadastro foi aprovado! Você já pode começar a receber corridas — é só mandar "disponível" aqui quando quiser ficar online.'
  ).catch((err) => logger.error(`Falha ao avisar motoboy ${driver.id} sobre aprovação`, err.message));

  return driver;
}

// Cadastro manual pelo painel — o admin já conhece/vetou o motoboy
// pessoalmente, então nasce direto aprovado (documents_approved=true,
// status='offline'), sem passar pelo cadastro via WhatsApp. A
// autorização de PASSAGEIRO continua exigindo aprovação separada do
// alvará (autorizadoPrefeitura nasce false sempre, sem exceção).
async function createDriverManually({ name, whatsapp, pixKey, gender, plate, model, atendeEntregas, atendePassageiro }) {
  const normalizedWhatsapp = normalizeWhatsapp(whatsapp);
  const existing = await Driver.findOne({ where: { whatsapp: normalizedWhatsapp } });
  if (existing) throw new AppError('Já existe um motoboy cadastrado com esse WhatsApp.', 422);

  // Mesma exigência do cadastro via WhatsApp (ver conversationFlow.js) —
  // sem chave Pix o motoboy não tem como receber do cliente direto.
  if (!pixKey || !pixKey.trim()) {
    throw new AppError('Chave Pix é obrigatória.', 422);
  }

  // Idem pro gênero — usado pra filtrar motoboys quando uma cliente pede
  // atendimento só por motogirl (ver rideService.findNearbyAvailableDrivers).
  if (gender !== 'motoboy' && gender !== 'motogirl') {
    throw new AppError('Gênero é obrigatório (motoboy ou motogirl).', 422);
  }

  const driver = await Driver.create({
    name,
    whatsapp: normalizedWhatsapp,
    pix_key: pixKey.trim(),
    gender,
    status: 'offline',
    documents_approved: true,
    atende_entregas: atendeEntregas !== false,
    atende_passageiro: !!atendePassageiro,
  });

  if (plate && model) {
    await Vehicle.create({ driver_id: driver.id, plate, model });
  }

  return driver;
}

// Aprovação específica do alvará — separada da aprovação geral de
// cadastro porque um motoboy pode já estar aprovado para entregas há
// meses e só depois decidir atender passageiro também. Sem isso true,
// rideService nunca escala esse motoboy pra corrida de passageiro,
// mesmo que ele tenha marcado atende_passageiro = true.
async function approveDriverAlvara(driverId) {
  const driver = await Driver.findByPk(driverId);
  if (!driver) throw new AppError('Motoboy não encontrado', 404);
  if (!driver.alvara_document) {
    throw new AppError('Esse motoboy ainda não enviou o alvará.', 422);
  }
  await driver.update({ autorizadoPrefeitura: true });
  return driver;
}

async function rejectDriverAlvara(driverId) {
  const driver = await Driver.findByPk(driverId);
  if (!driver) throw new AppError('Motoboy não encontrado', 404);
  await driver.update({ autorizadoPrefeitura: false, alvara_document: null });
  return driver;
}

// Edição dos dados cadastrais básicos pelo painel — hoje é a única forma
// de corrigir um cadastro feito errado (ex: nome digitado errado durante
// o cadastro via WhatsApp) sem mexer direto no banco. Não toca em
// status/saldo/aprovação/documentos, que já têm fluxo próprio.
async function updateDriverBasicInfo(driverId, { name, whatsapp, pixKey, gender, atendeEntregas, atendePassageiro }) {
  const driver = await Driver.findByPk(driverId);
  if (!driver) throw new AppError('Motoboy não encontrado', 404);

  const updates = {};

  if (name !== undefined) {
    if (!name.trim()) throw new AppError('Nome não pode ficar em branco.', 422);
    updates.name = name.trim();
  }

  if (whatsapp !== undefined) {
    const normalizedWhatsapp = normalizeWhatsapp(whatsapp);
    const conflict = await Driver.findOne({
      where: { whatsapp: normalizedWhatsapp, id: { [Op.ne]: driverId } },
    });
    if (conflict) throw new AppError('Já existe outro motoboy cadastrado com esse WhatsApp.', 422);
    updates.whatsapp = normalizedWhatsapp;
  }

  if (pixKey !== undefined) {
    if (!pixKey.trim()) throw new AppError('Chave Pix é obrigatória.', 422);
    updates.pix_key = pixKey.trim();
  }

  if (gender !== undefined) {
    if (gender !== 'motoboy' && gender !== 'motogirl') {
      throw new AppError('Gênero é obrigatório (motoboy ou motogirl).', 422);
    }
    updates.gender = gender;
  }

  if (atendeEntregas !== undefined) updates.atende_entregas = !!atendeEntregas;
  if (atendePassageiro !== undefined) updates.atende_passageiro = !!atendePassageiro;

  await driver.update(updates);
  return driver;
}

async function setDriverStatus(driverId, status) {
  if (!DRIVER_STATUSES.includes(status)) {
    throw new AppError(`Status inválido. Use um de: ${DRIVER_STATUSES.join(', ')}`, 422);
  }
  const driver = await Driver.findByPk(driverId);
  if (!driver) throw new AppError('Motoboy não encontrado', 404);
  await driver.update({ status });
  return driver;
}

async function adjustDriverWallet(driverId, amount, reason) {
  if (!amount || !reason) throw new AppError('Informe amount e reason', 422);
  const newBalance = amount > 0
    ? await walletService.creditDriver(driverId, amount, reason)
    : await walletService.debitDriver(driverId, Math.abs(amount), reason);
  return newBalance;
}

async function listUsers() {
  return User.findAll({ order: [['created_at', 'DESC']] });
}

async function toggleBlockUser(userId) {
  const user = await User.findByPk(userId);
  if (!user) throw new AppError('Usuário não encontrado', 404);
  await user.update({ is_blocked: !user.is_blocked });
  return user;
}

async function setUserBlocked(userId, blocked) {
  const user = await User.findByPk(userId);
  if (!user) throw new AppError('Usuário não encontrado', 404);
  await user.update({ is_blocked: blocked });
  return user;
}

// Faturamento real da MotoFácil no modelo atual: a plataforma nunca
// recebe o valor da corrida (isso é sempre cliente → motoboy direto) —
// a receita de verdade é (1) os leads cobrados do saldo dos motoboys e
// (2) o dinheiro que efetivamente entrou via recarga de carteira.
// `totalRideValue` fica só como referência operacional (quanto os
// clientes pagaram aos motoboys no total), não é dinheiro da plataforma.
async function getBillingSummary({ from, to } = {}) {
  const rideWhere = { status: 'completed' };
  const txWhere = {};
  const rechargeWhere = { status: 'paid' };
  if (from && to) {
    const range = { [Op.between]: [new Date(from), new Date(to)] };
    rideWhere.created_at = range;
    txWhere.created_at = range;
    rechargeWhere.paid_at = range;
  }

  const rides = await Ride.findAll({ where: rideWhere });
  const leadTransactions = await WalletTransaction.findAll({
    where: { ...txWhere, type: 'debit', reason: { [Op.like]: 'Lead —%' } },
  });
  const recharges = await WalletRecharge.findAll({ where: rechargeWhere });

  const totalRideValue = rides.reduce((sum, r) => sum + parseFloat(r.price), 0);
  const totalLeadFees = leadTransactions.reduce((sum, t) => sum + parseFloat(t.amount), 0);
  const totalRecharges = recharges.reduce((sum, r) => sum + parseFloat(r.amount), 0);

  return {
    totalRides: rides.length,
    totalRideValue: totalRideValue.toFixed(2),
    totalLeadFees: totalLeadFees.toFixed(2),
    totalRecharges: totalRecharges.toFixed(2),
  };
}

async function getTodayStats() {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const billing = await getBillingSummary({ from: startOfDay, to: new Date() });
  const activeRides = await Ride.count({
    where: { status: ['searching_driver', 'accepted', 'in_transit'] },
  });

  return { ...billing, activeRides };
}

// Busca por nome (parcial, sem acento/caixa) — o admin fala "bloqueia o
// joão", não sabe o UUID de ninguém. Retorna todos os que baterem, para o
// fluxo de comando decidir se executa direto ou pede para o admin
// desambiguar entre homônimos.
function normalize(str) {
  return (str || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

async function findDriversByName(name) {
  const needle = normalize(name);
  const all = await Driver.findAll();
  return all.filter((d) => normalize(d.name).includes(needle));
}

async function findUsersByName(name) {
  const needle = normalize(name);
  const all = await User.findAll();
  return all.filter((u) => normalize(u.name).includes(needle));
}

module.exports = {
  DRIVER_STATUSES,
  listDrivers,
  getDriverDocuments,
  approveDriver,
  createDriverManually,
  updateDriverBasicInfo,
  approveDriverAlvara,
  rejectDriverAlvara,
  setDriverStatus,
  adjustDriverWallet,
  listUsers,
  toggleBlockUser,
  setUserBlocked,
  getBillingSummary,
  getTodayStats,
  findDriversByName,
  findUsersByName,
};
