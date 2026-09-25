'use strict';

// Auditoria de tudo que a IA de comandos administrativos (WhatsApp) faz ou
// tenta fazer no painel — inclusive comandos rejeitados ou cancelados.
// Sem esta tabela, uma ação executada por linguagem natural fica sem
// rastro de quem pediu o quê, o que é inaceitável para ações que mexem
// em bloqueio de usuário ou dinheiro.
module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('admin_command_logs', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
      },
      admin_whatsapp: { type: Sequelize.STRING, allowNull: false },
      raw_message: { type: Sequelize.TEXT, allowNull: false },
      action: { type: Sequelize.STRING, allowNull: true },
      action_params: { type: Sequelize.JSON, allowNull: true },
      status: {
        // proposed: aguardando confirmação · executed: concluída ·
        // rejected: admin cancelou · failed: erro ao executar ·
        // info: resposta informativa (sem ação, ex: consulta ou dúvida)
        type: Sequelize.ENUM('proposed', 'executed', 'rejected', 'failed', 'info'),
        allowNull: false,
      },
      result_message: { type: Sequelize.TEXT, allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
    });
  },

  down: async (queryInterface) => {
    await queryInterface.dropTable('admin_command_logs');
  },
};
