'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('drivers', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
      },
      name: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      whatsapp: {
        type: Sequelize.STRING,
        allowNull: false,
        unique: true,
      },
      status: {
        type: Sequelize.ENUM('pending_approval', 'available', 'busy', 'offline', 'blocked'),
        allowNull: false,
        defaultValue: 'pending_approval',
      },
      wallet_balance: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0,
      },
      last_lat: {
        type: Sequelize.DECIMAL(10, 7),
        allowNull: true,
      },
      last_lng: {
        type: Sequelize.DECIMAL(10, 7),
        allowNull: true,
      },
      last_location_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      documents_approved: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
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
    await queryInterface.addIndex('drivers', ['whatsapp']);
    await queryInterface.addIndex('drivers', ['status']);
  },

  down: async (queryInterface) => {
    await queryInterface.dropTable('drivers');
  },
};
