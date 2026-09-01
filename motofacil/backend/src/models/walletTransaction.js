module.exports = (sequelize, DataTypes) => {
  const WalletTransaction = sequelize.define('WalletTransaction', {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    driver_id: { type: DataTypes.UUID, allowNull: true },
    user_id: { type: DataTypes.UUID, allowNull: true },
    ride_id: { type: DataTypes.UUID, allowNull: true },
    type: { type: DataTypes.ENUM('credit', 'debit'), allowNull: false },
    amount: { type: DataTypes.DECIMAL(10, 2), allowNull: false },
    reason: { type: DataTypes.STRING, allowNull: false },
    balance_after: { type: DataTypes.DECIMAL(10, 2), allowNull: false },
  }, {
    tableName: 'wallet_transactions',
    underscored: true,
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: false,
  });

  return WalletTransaction;
};
