module.exports = (sequelize, DataTypes) => {
  const ReferralCommission = sequelize.define('ReferralCommission', {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    referrer_driver_id: { type: DataTypes.UUID, allowNull: false },
    // Exatamente um dos dois é preenchido por linha — o indicado pode ser
    // um motoboy (indicação capturada no cadastro de Driver) ou um cliente/
    // estabelecimento (capturada no cadastro de User) — sem diferenciação
    // nenhuma no valor ou na regra, só no tipo de quem foi indicado.
    referred_driver_id: { type: DataTypes.UUID, allowNull: true },
    referred_user_id: { type: DataTypes.UUID, allowNull: true },
    ride_id: { type: DataTypes.UUID, allowNull: false },
    amount: { type: DataTypes.DECIMAL(10, 2), allowNull: false },
    // 'pending' até o admin acertar manualmente (semanal, fora do sistema,
    // ex: Pix) e marcar como 'paid' no painel — nunca decrementado num saldo
    // solto, sempre uma linha por corrida, auditável e fácil de somar.
    status: {
      type: DataTypes.ENUM('pending', 'paid'),
      allowNull: false,
      defaultValue: 'pending',
    },
    paid_at: { type: DataTypes.DATE, allowNull: true },
  }, {
    tableName: 'referral_commissions',
    underscored: true,
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
  });

  return ReferralCommission;
};
