'use strict';

// Reforço de segurança do cadastro de motoboy: CNH (número + foto), foto do
// CRLV e selfie, todos obrigatórios. Também corrige o alvará (renomeado de
// alvara_document_url pra alvara_document): o campo antigo era um
// VARCHAR(255) guardando uma referência de mídia que nunca funcionou de
// verdade (URL criptografada nativa do WhatsApp, inútil sem decodificar via
// Evolution API) — nenhum alvará real foi enviado até hoje, então é seguro
// trocar. Agora guarda { base64, mimetype } de verdade, como os campos novos.
module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('drivers', 'cnh_numero', {
      type: Sequelize.STRING,
      allowNull: true,
    });
    await queryInterface.addColumn('drivers', 'cnh_foto', {
      type: Sequelize.JSON,
      allowNull: true,
    });
    await queryInterface.addColumn('drivers', 'crlv_foto', {
      type: Sequelize.JSON,
      allowNull: true,
    });
    await queryInterface.addColumn('drivers', 'selfie_foto', {
      type: Sequelize.JSON,
      allowNull: true,
    });
    await queryInterface.addColumn('drivers', 'alvara_document', {
      type: Sequelize.JSON,
      allowNull: true,
    });
    await queryInterface.removeColumn('drivers', 'alvara_document_url');
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('drivers', 'alvara_document_url', {
      type: Sequelize.STRING,
      allowNull: true,
    });
    await queryInterface.removeColumn('drivers', 'alvara_document');
    await queryInterface.removeColumn('drivers', 'selfie_foto');
    await queryInterface.removeColumn('drivers', 'crlv_foto');
    await queryInterface.removeColumn('drivers', 'cnh_foto');
    await queryInterface.removeColumn('drivers', 'cnh_numero');
  },
};
