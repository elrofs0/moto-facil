'use strict';

// Tabela separada de 'drivers' para documentação do veículo (placa, CRLV,
// seguro) — importante para rastreabilidade e futura exigência legal caso
// o MotoFácil passe a operar corridas de passageiro.
module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('vehicles', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
      },
      driver_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'drivers', key: 'id' },
        onDelete: 'CASCADE',
      },
      plate: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      model: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      color: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      insurance_document_url: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      crlv_document_url: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      active: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true,
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
    await queryInterface.addIndex('vehicles', ['driver_id']);
  },

  down: async (queryInterface) => {
    await queryInterface.dropTable('vehicles');
  },
};
