const { WalletTransaction } = require('../models');
const { asyncHandler } = require('../utils');
const adminActions = require('../services/adminActionsService');
const evolutionService = require('../services/evolutionService');
const { logger } = require('../utils');

const listDrivers = asyncHandler(async (req, res) => {
  const drivers = await adminActions.listDrivers(req.query.status);
  res.json(drivers);
});

// Conteúdo real dos documentos (CNH, CRLV, selfie, alvará) de UM motoboy —
// separado da listagem porque as fotos em base64 são pesadas demais pra
// trazer em toda consulta (ver adminActionsService.HEAVY_DOCUMENT_FIELDS).
const getDriverDocuments = asyncHandler(async (req, res) => {
  const documents = await adminActions.getDriverDocuments(req.params.id);
  res.json(documents);
});

// Cadastro manual pelo painel — dispara uma mensagem de boas-vindas pelo
// WhatsApp na mesma hora, pra quem cadastrou já saber que está no
// sistema (a "conversa automática" começa aqui, mesmo sem o motoboy
// nunca ter mandado mensagem nenhuma primeiro).
const createDriver = asyncHandler(async (req, res) => {
  const { name, whatsapp, pixKey, gender, plate, model, atendeEntregas, atendePassageiro } = req.body;
  const driver = await adminActions.createDriverManually({ name, whatsapp, pixKey, gender, plate, model, atendeEntregas, atendePassageiro });

  const servicos = [
    driver.atende_entregas ? 'entregas' : null,
    driver.atende_passageiro ? 'passageiro (mototáxi)' : null,
  ].filter(Boolean).join(' e ');

  evolutionService.sendText(
    driver.whatsapp,
    `Olá, ${driver.name}! Você foi cadastrado na MotoFácil para atender: ${servicos}.\n\n` +
    `Assim que quiser ficar disponível pra receber corridas, é só mandar "disponível" aqui.` +
    (driver.atende_passageiro
      ? '\n\nComo você vai atender passageiro, ainda falta enviar o alvará da prefeitura — manda foto ou PDF que a gente já deixa em análise.'
      : '')
  ).catch((err) => logger.error('Falha ao enviar boas-vindas ao motoboy recém-cadastrado', err.message));

  res.status(201).json(driver);
});

// Aprovação de cadastro — muda de 'pending_approval' para 'offline'
// (o motoboy precisa se colocar manualmente como disponível depois).
const approveDriver = asyncHandler(async (req, res) => {
  const driver = await adminActions.approveDriver(req.params.id);
  res.json(driver);
});

// Aprova/rejeita especificamente o alvará da prefeitura (autorização para
// corrida de passageiro) — separado da aprovação geral de cadastro.
const approveDriverAlvara = asyncHandler(async (req, res) => {
  const driver = await adminActions.approveDriverAlvara(req.params.id);
  res.json(driver);
});

const rejectDriverAlvara = asyncHandler(async (req, res) => {
  const driver = await adminActions.rejectDriverAlvara(req.params.id);
  res.json(driver);
});

// Edição dos dados cadastrais básicos (nome, whatsapp, pix, gênero,
// serviços) — corrige um cadastro feito errado sem precisar mexer direto
// no banco. Todos os campos são opcionais no corpo: só atualiza o que vier.
const updateDriver = asyncHandler(async (req, res) => {
  const { name, whatsapp, pixKey, gender, atendeEntregas, atendePassageiro } = req.body;
  const driver = await adminActions.updateDriverBasicInfo(req.params.id, {
    name, whatsapp, pixKey, gender, atendeEntregas, atendePassageiro,
  });
  res.json(driver);
});

const updateDriverStatus = asyncHandler(async (req, res) => {
  const driver = await adminActions.setDriverStatus(req.params.id, req.body.status);
  res.json(driver);
});

// Ajuste manual de saldo pelo admin (ex: motoboy fez recarga via Pix fora
// do fluxo automático) — sempre passa pelo walletService (via
// adminActionsService) para manter o histórico auditável.
const adjustDriverWallet = asyncHandler(async (req, res) => {
  const { amount, reason } = req.body;
  const balance = await adminActions.adjustDriverWallet(req.params.id, amount, reason);
  res.json({ balance });
});

const getDriverWalletHistory = asyncHandler(async (req, res) => {
  const transactions = await WalletTransaction.findAll({
    where: { driver_id: req.params.id },
    order: [['created_at', 'DESC']],
    limit: 100,
  });
  res.json(transactions);
});

module.exports = {
  listDrivers,
  getDriverDocuments,
  createDriver,
  updateDriver,
  approveDriver,
  approveDriverAlvara,
  rejectDriverAlvara,
  updateDriverStatus,
  adjustDriverWallet,
  getDriverWalletHistory,
};
