'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('drivers', 'pix_key', {
      // Nullable no banco de propósito (não quebra motoboys já cadastrados
      // sem chave) — a obrigatoriedade de verdade é aplicada no fluxo de
      // cadastro via WhatsApp (conversationFlow.js), que não deixa
      // completar o cadastro sem uma chave.
      type: Sequelize.STRING,
      allowNull: true,
    });
  },

  down: async (queryInterface) => {
    await queryInterface.removeColumn('drivers', 'pix_key');
  },
};
