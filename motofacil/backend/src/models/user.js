module.exports = (sequelize, DataTypes) => {
  const User = sequelize.define('User', {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    name: { type: DataTypes.STRING, allowNull: false },
    whatsapp: { type: DataTypes.STRING, allowNull: false, unique: true },
    wallet_balance: { type: DataTypes.DECIMAL(10, 2), allowNull: false, defaultValue: 0 },
    is_blocked: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    // 'feminino' | 'masculino' — perguntado uma única vez, na primeira
    // corrida de passageiro (mototáxi) pedida pelo cliente, e reusado
    // depois disso. Nunca perguntado pra entrega.
    gender: { type: DataTypes.STRING, allowNull: true },

    // Motoboy que indicou este cliente/estabelecimento (mesmo mecanismo do
    // Driver.referred_by_driver_id — ver referralService.js). Gravado uma
    // única vez, na criação do cadastro, a partir do @ mencionado na
    // primeira mensagem (link wa.me pré-preenchido). Nunca muda depois.
    referred_by_driver_id: { type: DataTypes.UUID, allowNull: true },
  }, {
    tableName: 'users',
    underscored: true,
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
  });

  return User;
};
