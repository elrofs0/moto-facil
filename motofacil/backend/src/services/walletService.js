const { WalletTransaction, Driver, sequelize } = require('../models');
const { AppError } = require('../middleware/errorHandler');

// Toda alteração de saldo (motoboy ou usuário) passa por aqui — nunca
// atualizar wallet_balance diretamente em outro lugar do código. Isso
// garante que exista sempre um registro auditável em wallet_transactions
// para cada centavo que muda de mãos.

async function creditDriver(driverId, amount, reason, rideId = null, externalTransaction = null) {
  const run = async (t) => {
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
  };

  return externalTransaction ? run(externalTransaction) : sequelize.transaction(run);
}

// Debita valor do saldo do motoboy — usado tanto pra comissão de corrida
// em dinheiro quanto pro lead fee cobrado no aceite de qualquer corrida.
// Aceita uma transação externa (externalTransaction) pra poder rodar
// "tudo ou nada" junto com outra operação (ex: travar a corrida) — sem
// isso, debitar o lead e aceitar a corrida seriam duas operações
// separadas, com risco de uma dar certo e a outra não.
async function debitDriver(driverId, amount, reason, rideId = null, externalTransaction = null) {
  const run = async (t) => {
    const driver = await Driver.findByPk(driverId, { transaction: t, lock: t.LOCK.UPDATE });
    if (!driver) throw new AppError('Motoboy não encontrado', 404);

    const currentBalance = parseFloat(driver.wallet_balance);
    if (currentBalance < amount) {
      throw new AppError('SALDO_INSUFICIENTE:Saldo insuficiente na carteira. Recarregue pra continuar recebendo corridas.', 422);
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
  };

  return externalTransaction ? run(externalTransaction) : sequelize.transaction(run);
}

// Um motoboy só pode receber ofertas de corrida se tiver saldo suficiente
// pra cobrir o lead fee daquela oferta — sem essa checagem no despacho,
// ele receberia a oferta e só descobriria que não tem saldo na hora de
// aceitar, o que é uma experiência ruim e evitável.
async function hasSufficientBalance(driverId, amount) {
  const driver = await Driver.findByPk(driverId);
  if (!driver) return false;
  return parseFloat(driver.wallet_balance) >= parseFloat(amount);
}

module.exports = { creditDriver, debitDriver, hasSufficientBalance };
