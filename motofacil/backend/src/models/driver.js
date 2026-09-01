module.exports = (sequelize, DataTypes) => {
  const Driver = sequelize.define('Driver', {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    name: { type: DataTypes.STRING, allowNull: false },
    whatsapp: { type: DataTypes.STRING, allowNull: false, unique: true },
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
  }, {
    tableName: 'drivers',
    underscored: true,
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
  });

  return Driver;
};
