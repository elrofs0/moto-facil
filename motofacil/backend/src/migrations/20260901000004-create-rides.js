'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('rides', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
      },
      tracking_code: {
        type: Sequelize.STRING,
        allowNull: false,
        unique: true,
      },
      type: {
        type: Sequelize.ENUM('passenger', 'delivery'),
        allowNull: false,
      },
      client_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'users', key: 'id' },
      },
      driver_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'drivers', key: 'id' },
      },
      status: {
        type: Sequelize.ENUM(
          'pending_payment',
          'searching_driver',
          'accepted',
          'in_transit',
          'completed',
          'cancelled'
        ),
        allowNull: false,
        defaultValue: 'pending_payment',
      },
      origin_address: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      origin_lat: { type: Sequelize.DECIMAL(10, 7), allowNull: true },
      origin_lng: { type: Sequelize.DECIMAL(10, 7), allowNull: true },
      destination_address: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      destination_lat: { type: Sequelize.DECIMAL(10, 7), allowNull: true },
      destination_lng: { type: Sequelize.DECIMAL(10, 7), allowNull: true },
      distance_km: {
        type: Sequelize.DECIMAL(6, 2),
        allowNull: true,
      },
      price: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false,
      },
      driver_commission: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: true,
      },
      platform_fee: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: true,
      },
      payment_method: {
        type: Sequelize.ENUM('pix', 'credit_card', 'debit_card', 'boleto', 'cash', 'wallet'),
        allowNull: true,
      },
      payment_status: {
        type: Sequelize.ENUM('pending', 'approved', 'refused', 'refunded'),
        allowNull: false,
        defaultValue: 'pending',
      },
      payment_provider_id: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      cancelled_reason: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW,
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW,
      },
    });
    await queryInterface.addIndex('rides', ['tracking_code']);
    await queryInterface.addIndex('rides', ['status']);
    await queryInterface.addIndex('rides', ['client_id']);
    await queryInterface.addIndex('rides', ['driver_id']);
  },

  down: async (queryInterface) => {
    await queryInterface.dropTable('rides');
  },
};
