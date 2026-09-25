'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Motoboy escolhido pelo @ (cliente digitou um nome de usuário em vez
    // de "0"). Fica guardado mesmo depois de cair pra busca automática,
    // só pra registro de quem foi pedido originalmente.
    await queryInterface.addColumn('rides', 'preferred_driver_id', {
      type: Sequelize.UUID,
      allowNull: true,
    });

    // Preenchido no momento em que a oferta é mandada SÓ pro motoboy
    // preferido. A varredura periódica (rideService.sweepExpiredPreferredOffers)
    // usa isso pra saber quando os 2 minutos de exclusividade estouraram.
    // Zerado (null) assim que a corrida cai pra busca automática — depois
    // disso vale como "já não está mais esperando exclusivamente por ele".
    await queryInterface.addColumn('rides', 'preferred_driver_offered_at', {
      type: Sequelize.DATE,
      allowNull: true,
    });

    // Lista de motoboys que já receberam oferta dessa corrida (preferido
    // e/ou qualquer rodada de busca automática) — evita mandar a mesma
    // oferta duas vezes pro mesmo motoboy quando a corrida recua (recusa
    // ou timeout) e tenta de novo com outros.
    await queryInterface.addColumn('rides', 'notified_driver_ids', {
      type: Sequelize.JSON,
      allowNull: true,
    });
  },

  down: async (queryInterface) => {
    await queryInterface.removeColumn('rides', 'preferred_driver_id');
    await queryInterface.removeColumn('rides', 'preferred_driver_offered_at');
    await queryInterface.removeColumn('rides', 'notified_driver_ids');
  },
};
