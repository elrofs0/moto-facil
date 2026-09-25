'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // @ escolhido pelo próprio motoboy no cadastro (tipo @elrofs) — só
    // letras/números/underscore, validado na aplicação. Guardado sempre
    // em minúsculo.
    await queryInterface.addColumn('drivers', 'username', {
      type: Sequelize.STRING,
      allowNull: true,
    });

    // Índice único separado (em vez de unique:true na coluna) porque
    // SQLite não aceita ADD COLUMN ... UNIQUE via ALTER TABLE — só assim
    // a migration roda igual em dev (SQLite) e produção (Postgres). Trava
    // a unicidade mesmo sob concorrência (dois cadastros escolhendo o
    // mesmo @ ao mesmo tempo).
    await queryInterface.addIndex('drivers', ['username'], {
      unique: true,
      name: 'drivers_username_unique',
    });
  },

  down: async (queryInterface) => {
    await queryInterface.removeIndex('drivers', 'drivers_username_unique');
    await queryInterface.removeColumn('drivers', 'username');
  },
};
