'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.changeColumn('rides', 'client_id', {
      type: Sequelize.UUID,
      allowNull: true,
    });
    await queryInterface.addColumn('rides', 'source', {
      type: Sequelize.STRING,
      allowNull: false,
      defaultValue: 'motofacil',
    });
    await queryInterface.addColumn('rides', 'external_reference', {
      type: Sequelize.STRING,
      allowNull: true,
    });
    await queryInterface.addColumn('rides', 'partner_establishment_name', {
      type: Sequelize.STRING,
      allowNull: true,
    });
    await queryInterface.addIndex('rides', ['source', 'external_reference']);
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeIndex('rides', ['source', 'external_reference']);
    await queryInterface.removeColumn('rides', 'partner_establishment_name');
    await queryInterface.removeColumn('rides', 'external_reference');
    await queryInterface.removeColumn('rides', 'source');
    await queryInterface.changeColumn('rides', 'client_id', {
      type: Sequelize.UUID,
      allowNull: false,
    });
  },
};
