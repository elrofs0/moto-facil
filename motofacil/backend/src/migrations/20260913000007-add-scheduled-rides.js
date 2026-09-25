'use strict';

// Agendamento de corrida pra horário futuro: novo status 'scheduled' (antes
// de 'searching_driver' no ciclo de vida) + campo scheduled_for com a data/
// hora combinada. No Postgres, status é um ENUM nativo — precisa de ALTER
// TYPE explícito pra aceitar o valor novo (addColumn/changeColumn sozinho
// não mexe nos valores permitidos de um ENUM já existente). No SQLite
// (dev/teste), o "ENUM" do Sequelize não é imposto por um tipo de verdade
// no banco, então não precisa de nada especial ali.
module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('rides', 'scheduled_for', {
      type: Sequelize.DATE,
      allowNull: true,
    });

    // Marca quando o despacho de fato começou — diferente de created_at,
    // que pra uma corrida agendada pode ser dias antes da hora de buscar
    // motoboy de verdade. sweepStaleSearchingRides (30 min sem sucesso)
    // precisa contar a partir daqui, senão uma corrida agendada cancelaria
    // sozinha no instante em que o despacho começasse (created_at já estaria
    // "velho" há muito tempo). Pra corrida imediata, vale o mesmo que
    // created_at (setado na hora da criação).
    await queryInterface.addColumn('rides', 'dispatch_started_at', {
      type: Sequelize.DATE,
      allowNull: true,
    });
    await queryInterface.sequelize.query(
      "UPDATE rides SET dispatch_started_at = created_at WHERE status = 'searching_driver' AND dispatch_started_at IS NULL;"
    );

    if (queryInterface.sequelize.getDialect() === 'postgres') {
      await queryInterface.sequelize.query(
        "ALTER TYPE \"enum_rides_status\" ADD VALUE IF NOT EXISTS 'scheduled';"
      );
    }
  },

  down: async (queryInterface) => {
    // Postgres não permite remover valor de ENUM sem recriar o tipo — não
    // vale o risco/complexidade pra um rollback; só remove as colunas.
    await queryInterface.removeColumn('rides', 'dispatch_started_at');
    await queryInterface.removeColumn('rides', 'scheduled_for');
  },
};
