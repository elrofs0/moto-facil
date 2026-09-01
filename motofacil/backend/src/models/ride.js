module.exports = (sequelize, DataTypes) => {
  const Ride = sequelize.define('Ride', {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    tracking_code: { type: DataTypes.STRING, allowNull: false, unique: true },
    type: { type: DataTypes.ENUM('passenger', 'delivery'), allowNull: false },
    client_id: { type: DataTypes.UUID, allowNull: false },
    driver_id: { type: DataTypes.UUID, allowNull: true },
    status: {
      type: DataTypes.ENUM(
        'pending_payment', 'searching_driver', 'accepted', 'in_transit', 'completed', 'cancelled'
      ),
      allowNull: false,
      defaultValue: 'pending_payment',
    },
    origin_address: { type: DataTypes.STRING, allowNull: false },
    origin_lat: { type: DataTypes.DECIMAL(10, 7), allowNull: true },
    origin_lng: { type: DataTypes.DECIMAL(10, 7), allowNull: true },
    destination_address: { type: DataTypes.STRING, allowNull: false },
    destination_lat: { type: DataTypes.DECIMAL(10, 7), allowNull: true },
    destination_lng: { type: DataTypes.DECIMAL(10, 7), allowNull: true },
    distance_km: { type: DataTypes.DECIMAL(6, 2), allowNull: true },
    price: { type: DataTypes.DECIMAL(10, 2), allowNull: false },
    driver_commission: { type: DataTypes.DECIMAL(10, 2), allowNull: true },
    platform_fee: { type: DataTypes.DECIMAL(10, 2), allowNull: true },
    payment_method: {
      type: DataTypes.ENUM('pix', 'credit_card', 'debit_card', 'boleto', 'cash', 'wallet'),
      allowNull: true,
    },
    payment_status: {
      type: DataTypes.ENUM('pending', 'approved', 'refused', 'refunded'),
      allowNull: false,
      defaultValue: 'pending',
    },
    payment_provider_id: { type: DataTypes.STRING, allowNull: true },
    cancelled_reason: { type: DataTypes.STRING, allowNull: true },
  }, {
    tableName: 'rides',
    underscored: true,
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
  });

  return Ride;
};
