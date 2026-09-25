'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('rides', 'driver_gender_preference', {
      // null = sem preferência (padrão, e sempre o caso pra entrega).
      // 'motogirl' = cliente pediu atendimento só por motogirl nessa
      // corrida específica — é uma escolha por corrida, não fica salva
      // no cadastro do cliente (diferente do gênero dela, que fica).
      type: Sequelize.STRING,
      allowNull: true,
    });
  },

  down: async (queryInterface) => {
    await queryInterface.removeColumn('rides', 'driver_gender_preference');
  },
};
