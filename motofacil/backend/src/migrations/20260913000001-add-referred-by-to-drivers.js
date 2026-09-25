'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('drivers', 'referred_by_driver_id', {
      type: Sequelize.UUID,
      allowNull: true,
      references: { model: 'drivers', key: 'id' },
    });
  },

  down: async (queryInterface) => {
    await queryInterface.removeColumn('drivers', 'referred_by_driver_id');
  },
};
