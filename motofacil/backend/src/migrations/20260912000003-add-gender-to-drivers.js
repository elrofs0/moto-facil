'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('drivers', 'gender', {
      // 'motoboy' | 'motogirl' — STRING (não ENUM) pra não precisar
      // gerenciar tipo enum no Postgres numa migration de addColumn;
      // validado na aplicação, mesmo padrão usado pra pix_key.
      type: Sequelize.STRING,
      allowNull: true,
    });
  },

  down: async (queryInterface) => {
    await queryInterface.removeColumn('drivers', 'gender');
  },
};
