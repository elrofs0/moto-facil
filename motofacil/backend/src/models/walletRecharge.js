module.exports = (sequelize, DataTypes) => {
  // Cada pedido de recarga de carteira do motoboy vira uma linha aqui,
  // do momento em que o Pix é gerado até a confirmação (ou expiração).
  // Sem isso não dá pra saber, no webhook do gateway, "de quem" é aquele
  // pagamento nem evitar creditar duas vezes se o gateway reenviar o
  // mesmo evento (comum em webhooks de pagamento).
  const WalletRecharge = sequelize.define('WalletRecharge', {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    driver_id: { type: DataTypes.UUID, allowNull: false },
    amount: { type: DataTypes.DECIMAL(10, 2), allowNull: false },
    provider: { type: DataTypes.STRING, allowNull: false }, // 'asaas' | 'mercadopago'
    provider_charge_id: { type: DataTypes.STRING, allowNull: false, unique: true },
    pix_qr_code_base64: { type: DataTypes.TEXT, allowNull: true },
    pix_copy_paste: { type: DataTypes.TEXT, allowNull: true },
    status: {
      type: DataTypes.ENUM('pending', 'paid', 'expired', 'failed'),
      allowNull: false,
      defaultValue: 'pending',
    },
    paid_at: { type: DataTypes.DATE, allowNull: true },
  }, {
    tableName: 'wallet_recharges',
    underscored: true,
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
  });

  return WalletRecharge;
};
