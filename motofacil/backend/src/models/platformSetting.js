module.exports = (sequelize, DataTypes) => {
  // Configurações da plataforma controláveis pelo admin sem precisar de
  // deploy — hoje usado só para o modo chuva (tarifa dinâmica), mas serve
  // pra qualquer chave/valor futuro sem precisar de migration nova.
  const PlatformSetting = sequelize.define('PlatformSetting', {
    key: { type: DataTypes.STRING, primaryKey: true },
    value: { type: DataTypes.STRING, allowNull: false },
  }, {
    tableName: 'platform_settings',
    underscored: true,
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
  });

  return PlatformSetting;
};
