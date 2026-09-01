'use strict';

// Histórico de créditos/débitos da carteira do motoboy (e do usuário, se
// usar saldo pré-pago). Sem esta tabela não há como auditar comissões
// descontadas de corridas pagas em dinheiro.
module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('wallet_transactions', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
      },
      driver_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'drivers', key: 'id' },
      },
      user_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'users', key: 'id' },
      },
      ride_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'rides', key: 'id' },
      },
      type: {
        type: Sequelize.ENUM('credit', 'debit'),
        allowNull: false,
      },
      amount: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false,
      },
      reason: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      balance_after: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false,
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW,
      },
    });
    await queryInterface.addIndex('wallet_transactions', ['driver_id']);
    await queryInterface.addIndex('wallet_transactions', ['user_id']);
  },

  down: async (queryInterface) => {
    await queryInterface.dropTable('wallet_transactions');
  },
};
