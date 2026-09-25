'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('users', 'gender', {
      // 'feminino' | 'masculino' — perguntado uma única vez, na primeira
      // vez que o cliente pede corrida de passageiro (mototáxi), e
      // guardado aqui pra nunca mais precisar perguntar de novo.
      type: Sequelize.STRING,
      allowNull: true,
    });
  },

  down: async (queryInterface) => {
    await queryInterface.removeColumn('users', 'gender');
  },
};
