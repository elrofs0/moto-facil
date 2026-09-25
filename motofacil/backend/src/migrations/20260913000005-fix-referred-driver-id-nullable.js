'use strict';

// A migration anterior (20260913000004) tentou tornar referred_driver_id
// opcional via changeColumn, mas isso silenciosamente não remove a
// constraint NOT NULL no Postgres (funciona no SQLite, que recria a tabela
// por baixo dos panos — no Postgres precisa de ALTER COLUMN explícito).
module.exports = {
  up: async (queryInterface, Sequelize) => {
    const dialect = queryInterface.sequelize.getDialect();
    if (dialect === 'postgres') {
      await queryInterface.sequelize.query(
        'ALTER TABLE referral_commissions ALTER COLUMN referred_driver_id DROP NOT NULL;'
      );
    } else {
      await queryInterface.changeColumn('referral_commissions', 'referred_driver_id', {
        type: Sequelize.UUID,
        allowNull: true,
      });
    }
  },

  down: async (queryInterface, Sequelize) => {
    const dialect = queryInterface.sequelize.getDialect();
    if (dialect === 'postgres') {
      await queryInterface.sequelize.query(
        'ALTER TABLE referral_commissions ALTER COLUMN referred_driver_id SET NOT NULL;'
      );
    } else {
      await queryInterface.changeColumn('referral_commissions', 'referred_driver_id', {
        type: Sequelize.UUID,
        allowNull: false,
      });
    }
  },
};
