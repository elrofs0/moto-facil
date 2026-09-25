'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('drivers', 'atende_entregas', {
      type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true,
    });
    await queryInterface.addColumn('drivers', 'atende_passageiro', {
      type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false,
    });
    await queryInterface.addColumn('drivers', 'autorizado_prefeitura', {
      type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false,
    });
    await queryInterface.addColumn('drivers', 'alvara_document_url', {
      type: Sequelize.STRING, allowNull: true,
    });
  },

  down: async (queryInterface) => {
    await queryInterface.removeColumn('drivers', 'atende_entregas');
    await queryInterface.removeColumn('drivers', 'atende_passageiro');
    await queryInterface.removeColumn('drivers', 'autorizado_prefeitura');
    await queryInterface.removeColumn('drivers', 'alvara_document_url');
  },
};
