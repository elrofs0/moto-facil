'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('wallet_recharges', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
      driver_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'drivers', key: 'id' },
      },
      amount: { type: Sequelize.DECIMAL(10, 2), allowNull: false },
      provider: { type: Sequelize.STRING, allowNull: false },
      provider_charge_id: { type: Sequelize.STRING, allowNull: false, unique: true },
      pix_qr_code_base64: { type: Sequelize.TEXT, allowNull: true },
      pix_copy_paste: { type: Sequelize.TEXT, allowNull: true },
      status: {
        type: Sequelize.ENUM('pending', 'paid', 'expired', 'failed'),
        allowNull: false,
        defaultValue: 'pending',
      },
      paid_at: { type: Sequelize.DATE, allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
    });
  },

  down: async (queryInterface) => {
    await queryInterface.dropTable('wallet_recharges');
  },
};
