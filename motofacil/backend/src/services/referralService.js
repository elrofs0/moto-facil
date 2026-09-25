const { Driver, User, ReferralCommission, Ride, sequelize } = require('../models');
const env = require('../config/env');

// Regex igual ao USERNAME_REGEX de conversationFlow.js (3-20 chars,
// letras/números/underscore) — usada aqui só pra extrair o @ mencionado no
// texto livre do link de indicação (ex: "...indicado por @julio").
const MENTION_REGEX = /@([a-zA-Z0-9_]{3,20})/;

// Acha o motoboy indicador a partir do texto original da 1a mensagem de
// cadastro (ex: link wa.me pré-preenchido com "...indicado por @julio").
// Sem @ reconhecido, ou @ de ninguém cadastrado: retorna null, sem erro —
// indicação é sempre opcional, nunca trava um cadastro normal.
async function findReferrerFromText(text) {
  const match = MENTION_REGEX.exec(text || '');
  if (!match) return null;
  const username = match[1].toLowerCase();
  return Driver.findOne({ where: { username } });
}

// Chamado a cada corrida completada — sem diferenciação nenhuma entre quem
// foi indicado: se o MOTOBOY que completou foi indicado por alguém, E/OU se
// o CLIENTE que pediu a corrida foi indicado por alguém, cada um gera sua
// própria comissão fixa pro respectivo indicador (podem ser pessoas
// diferentes, ou a mesma — os dois lados são checados independentemente).
// Uma linha por corrida por indicação (nunca soma direto num saldo), pra
// manter auditável e fácil de zerar semanalmente (ver markAsPaid). Nunca
// falha a conclusão da corrida em si — comissão é um bônus à parte.
async function recordCommissionForCompletedRide(ride) {
  if (ride.driver_id) {
    const driver = await Driver.findByPk(ride.driver_id);
    if (driver && driver.referred_by_driver_id) {
      await ReferralCommission.create({
        referrer_driver_id: driver.referred_by_driver_id,
        referred_driver_id: driver.id,
        ride_id: ride.id,
        amount: env.referral.commissionAmount,
        status: 'pending',
      });
    }
  }

  const client = await User.findByPk(ride.client_id);
  if (client && client.referred_by_driver_id) {
    await ReferralCommission.create({
      referrer_driver_id: client.referred_by_driver_id,
      referred_user_id: client.id,
      ride_id: ride.id,
      amount: env.referral.commissionAmount,
      status: 'pending',
    });
  }
}

// Resumo pro painel: por indicador, total pendente + total já pago +
// quantos indicados/corridas geraram comissão até agora.
async function getReferralSummary() {
  const referrerIds = await ReferralCommission.findAll({
    attributes: [[sequelize.fn('DISTINCT', sequelize.col('referrer_driver_id')), 'referrer_driver_id']],
    raw: true,
  });

  const summaries = await Promise.all(referrerIds.map(async ({ referrer_driver_id }) => {
    const referrer = await Driver.findByPk(referrer_driver_id, { attributes: ['id', 'name', 'username', 'whatsapp'] });

    const commissions = await ReferralCommission.findAll({
      where: { referrer_driver_id },
      include: [
        { model: Driver, as: 'referredDriver', attributes: ['id', 'name', 'username'] },
        { model: User, as: 'referredUser', attributes: ['id', 'name', 'whatsapp'] },
        { model: Ride, as: 'ride', attributes: ['id', 'tracking_code', 'type'] },
      ],
      order: [['created_at', 'DESC']],
    });

    const pendingTotal = commissions
      .filter((c) => c.status === 'pending')
      .reduce((sum, c) => sum + parseFloat(c.amount), 0);
    const paidTotal = commissions
      .filter((c) => c.status === 'paid')
      .reduce((sum, c) => sum + parseFloat(c.amount), 0);

    return {
      referrer,
      pendingTotal: parseFloat(pendingTotal.toFixed(2)),
      paidTotal: parseFloat(paidTotal.toFixed(2)),
      commissions,
    };
  }));

  return summaries.sort((a, b) => b.pendingTotal - a.pendingTotal);
}

// Marca todas as comissões PENDENTES daquele indicador como pagas (acerto
// manual semanal, feito fora do sistema — ex: Pix). Idempotente: rodar de
// novo sem nada pendente só não afeta nenhuma linha.
async function markCommissionsAsPaid(referrerDriverId) {
  const [affectedRows] = await ReferralCommission.update(
    { status: 'paid', paid_at: new Date() },
    { where: { referrer_driver_id: referrerDriverId, status: 'pending' } }
  );
  return { updated: affectedRows };
}

module.exports = {
  findReferrerFromText,
  recordCommissionForCompletedRide,
  getReferralSummary,
  markCommissionsAsPaid,
};
