module.exports = (sequelize, DataTypes) => {
  const AdminCommandLog = sequelize.define('AdminCommandLog', {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    admin_whatsapp: { type: DataTypes.STRING, allowNull: false },
    raw_message: { type: DataTypes.TEXT, allowNull: false },
    action: { type: DataTypes.STRING, allowNull: true },
    action_params: { type: DataTypes.JSON, allowNull: true },
    status: {
      type: DataTypes.ENUM('proposed', 'executed', 'rejected', 'failed', 'info'),
      allowNull: false,
    },
    result_message: { type: DataTypes.TEXT, allowNull: true },
  }, {
    tableName: 'admin_command_logs',
    underscored: true,
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: false,
  });

  return AdminCommandLog;
};
