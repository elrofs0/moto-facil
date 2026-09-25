module.exports = (sequelize, DataTypes) => {
  const Driver = sequelize.define('Driver', {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    name: { type: DataTypes.STRING, allowNull: false },
    whatsapp: { type: DataTypes.STRING, allowNull: false, unique: true },
    // @ escolhido pelo próprio motoboy, sempre em minúsculo. Obrigatório
    // no cadastro via WhatsApp (nullable aqui só pra não quebrar cadastros
    // anteriores a esse campo existir).
    username: { type: DataTypes.STRING, allowNull: true, unique: true },
    status: {
      type: DataTypes.ENUM('pending_approval', 'available', 'busy', 'offline', 'blocked'),
      allowNull: false,
      defaultValue: 'pending_approval',
    },
    wallet_balance: { type: DataTypes.DECIMAL(10, 2), allowNull: false, defaultValue: 0 },
    last_lat: { type: DataTypes.DECIMAL(10, 7), allowNull: true },
    last_lng: { type: DataTypes.DECIMAL(10, 7), allowNull: true },
    last_location_at: { type: DataTypes.DATE, allowNull: true },
    documents_approved: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },

    // Chave Pix pessoal do motoboy, pra receber direto do cliente (o
    // dinheiro da corrida nunca passa pela MotoFácil). Obrigatória no
    // fluxo de cadastro via WhatsApp — nullable aqui só pra não quebrar
    // cadastros antigos anteriores a esse campo existir.
    pix_key: { type: DataTypes.STRING, allowNull: true },

    // 'motoboy' | 'motogirl' — obrigatório no cadastro via WhatsApp.
    // Usado pra filtrar motoboys quando uma cliente pede atendimento só
    // por motogirl (ver rideService.findNearbyAvailableDrivers).
    gender: { type: DataTypes.STRING, allowNull: true },

    // --- Segmentação de serviço: entregas (delivery) vs. mototáxi (passageiro) ---
    // Um motoboy pode atender um, outro, ou os dois — mas transportar
    // passageiro (mototáxi) exige autorização da prefeitura, entregas não.
    atende_entregas: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    atende_passageiro: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },

    // Trava de negócio: SEM isso true, o motoboy nunca pode ser escalado
    // para corrida do tipo 'passenger', mesmo que atende_passageiro seja
    // true (atende_passageiro = "quero atender"; autorizadoPrefeitura =
    // "já pode atender", validado pelo admin). Ver rideService.js e
    // chatbot/conversationFlow.js — a checagem de verdade é sempre no
    // servidor, nunca só um aviso de interface.
    autorizadoPrefeitura: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      field: 'autorizado_prefeitura',
    },

    // Documentos de verificação — reforço de segurança do cadastro, todos
    // guardados como { base64, mimetype } (JSON), pra dar pro admin revisar
    // a foto de verdade no painel antes de aprovar. CNH, CRLV e selfie são
    // obrigatórios no cadastro; alvará continua opcional/adiável (só é
    // exigido de fato pra liberar corrida de passageiro).
    cnh_numero: { type: DataTypes.STRING, allowNull: true },
    cnh_foto: { type: DataTypes.JSON, allowNull: true },
    crlv_foto: { type: DataTypes.JSON, allowNull: true },
    selfie_foto: { type: DataTypes.JSON, allowNull: true },
    alvara_document: { type: DataTypes.JSON, allowNull: true },

    // Motoboy que indicou este cadastro (sistema de indicação — ver
    // referralCommission.js). Gravado uma única vez, no cadastro, a partir
    // do @ mencionado na mensagem que trouxe o motoboy (link wa.me
    // pré-preenchido). Nunca muda depois.
    referred_by_driver_id: { type: DataTypes.UUID, allowNull: true },

    // Comprovante de exibição dos Termos de Uso/Política de Privacidade —
    // aceitação passiva (não exige "aceito" digitado), mas fica registrado
    // quando a mensagem com o link foi mostrada e qual versão vigorava
    // naquele momento, pra eventual necessidade de comprovar depois.
    terms_shown_at: { type: DataTypes.DATE, allowNull: true },
    terms_version: { type: DataTypes.STRING, allowNull: true },
  }, {
    tableName: 'drivers',
    underscored: true,
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
  });

  return Driver;
};
