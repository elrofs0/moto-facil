module.exports = (sequelize, DataTypes) => {
  const Vehicle = sequelize.define('Vehicle', {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    driver_id: { type: DataTypes.UUID, allowNull: false },
    plate: { type: DataTypes.STRING, allowNull: false },
    model: { type: DataTypes.STRING, allowNull: false },
    color: { type: DataTypes.STRING, allowNull: true },
    insurance_document_url: { type: DataTypes.STRING, allowNull: true },
    crlv_document_url: { type: DataTypes.STRING, allowNull: true },
    active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
  }, {
    tableName: 'vehicles',
    underscored: true,
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
  });

  return Vehicle;
};
