'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('referral_commissions', 'referred_user_id', {
      type: Sequelize.UUID,
      allowNull: true,
      references: { model: 'users', key: 'id' },
    });

    // Agora o indicado pode ser um motoboy OU um cliente/estabelecimento —
    // exatamente um dos dois campos preenchido por linha, nunca os dois.
    await queryInterface.changeColumn('referral_commissions', 'referred_driver_id', {
      type: Sequelize.UUID,
      allowNull: true,
      references: { model: 'drivers', key: 'id' },
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.changeColumn('referral_commissions', 'referred_driver_id', {
      type: Sequelize.UUID,
      allowNull: false,
      references: { model: 'drivers', key: 'id' },
    });
    await queryInterface.removeColumn('referral_commissions', 'referred_user_id');
  },
};
