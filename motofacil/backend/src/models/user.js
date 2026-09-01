module.exports = (sequelize, DataTypes) => {
  const User = sequelize.define('User', {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    name: { type: DataTypes.STRING, allowNull: false },
    whatsapp: { type: DataTypes.STRING, allowNull: false, unique: true },
    wallet_balance: { type: DataTypes.DECIMAL(10, 2), allowNull: false, defaultValue: 0 },
    is_blocked: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
  }, {
    tableName: 'users',
    underscored: true,
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
  });

  return User;
};
