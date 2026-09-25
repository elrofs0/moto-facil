'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('drivers', 'terms_shown_at', {
      type: Sequelize.DATE,
      allowNull: true,
    });
    await queryInterface.addColumn('drivers', 'terms_version', {
      type: Sequelize.STRING,
      allowNull: true,
    });
  },

  down: async (queryInterface) => {
    await queryInterface.removeColumn('drivers', 'terms_version');
    await queryInterface.removeColumn('drivers', 'terms_shown_at');
  },
};
