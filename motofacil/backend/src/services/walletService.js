const { WalletTransaction, Driver, sequelize } = require('../models');
const { AppError } = require('../middleware/errorHandler');

// Toda alteração de saldo (motoboy ou usuário) passa por aqui — nunca
// atualizar wallet_balance diretamente em outro lugar do código. Isso
// garante que exista sempre um registro auditável em wallet_transactions
// para cada centavo que muda de mãos.

async function creditDriver(driverId, amount, reason, rideId = null) {
  return sequelize.transaction(async (t) => {
    const driver = await Driver.findByPk(driverId, { transaction: t, lock: t.LOCK.UPDATE });
    if (!driver) throw new AppError('Motoboy não encontrado', 404);

    const newBalance = parseFloat(driver.wallet_balance) + parseFloat(amount);
    await driver.update({ wallet_balance: newBalance }, { transaction: t });

    await WalletTransaction.create({
      driver_id: driverId,
      ride_id: rideId,
      type: 'credit',
      amount,
      reason,
      balance_after: newBalance,
    }, { transaction: t });

    return newBalance;
  });
}

// Debita a comissão da plataforma do saldo do motoboy — usado quando a
// corrida é paga em dinheiro direto ao motoboy (o cliente não paga a
// plataforma, então a plataforma cobra a comissão do saldo do motoboy).
async function debitDriver(driverId, amount, reason, rideId = null) {
  return sequelize.transaction(async (t) => {
    const driver = await Driver.findByPk(driverId, { transaction: t, lock: t.LOCK.UPDATE });
    if (!driver) throw new AppError('Motoboy não encontrado', 404);

    const currentBalance = parseFloat(driver.wallet_balance);
    if (currentBalance < amount) {
      throw new AppError('Saldo insuficiente na carteira do motoboy', 422);
    }

    const newBalance = currentBalance - parseFloat(amount);
    await driver.update({ wallet_balance: newBalance }, { transaction: t });

    await WalletTransaction.create({
      driver_id: driverId,
      ride_id: rideId,
      type: 'debit',
      amount,
      reason,
      balance_after: newBalance,
    }, { transaction: t });

    return newBalance;
  });
}

// Um motoboy só pode receber ofertas de corrida em dinheiro se tiver saldo
// suficiente para cobrir a comissão — sem essa checagem, o modelo de
// comissão em corridas de dinheiro não se sustenta (ver README).
async function hasSufficientBalanceForCommission(driverId, estimatedCommission) {
  const driver = await Driver.findByPk(driverId);
  if (!driver) return false;
  return parseFloat(driver.wallet_balance) >= parseFloat(estimatedCommission);
}

module.exports = { creditDriver, debitDriver, hasSufficientBalanceForCommission };
