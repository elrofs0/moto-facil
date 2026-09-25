const { Sequelize, DataTypes } = require('sequelize');
const config = require('../config/database')[process.env.NODE_ENV || 'development'];

// A config pode vir de connection string (Postgres em produção) ou dos
// campos separados (SQLite em dev) — o construtor do Sequelize é diferente
// para cada caso, então isso não pode assumir só um formato.
const sequelize = config.url
  ? new Sequelize(config.url, config)
  : new Sequelize(config.database, config.username, config.password, config);

const db = {};

db.User = require('./user')(sequelize, DataTypes);
db.Driver = require('./driver')(sequelize, DataTypes);
db.Vehicle = require('./vehicle')(sequelize, DataTypes);
db.Ride = require('./ride')(sequelize, DataTypes);
db.WalletTransaction = require('./walletTransaction')(sequelize, DataTypes);
db.AdminCommandLog = require('./adminCommandLog')(sequelize, DataTypes);
db.PlatformSetting = require('./platformSetting')(sequelize, DataTypes);
db.WalletRecharge = require('./walletRecharge')(sequelize, DataTypes);
db.ReferralCommission = require('./referralCommission')(sequelize, DataTypes);

// Associações
db.Driver.hasMany(db.Vehicle, { foreignKey: 'driver_id', as: 'vehicles' });
db.Vehicle.belongsTo(db.Driver, { foreignKey: 'driver_id', as: 'driver' });

db.User.hasMany(db.Ride, { foreignKey: 'client_id', as: 'rides' });
db.Ride.belongsTo(db.User, { foreignKey: 'client_id', as: 'client' });

db.Driver.hasMany(db.Ride, { foreignKey: 'driver_id', as: 'rides' });
db.Ride.belongsTo(db.Driver, { foreignKey: 'driver_id', as: 'driver' });
db.Ride.belongsTo(db.Driver, { foreignKey: 'preferred_driver_id', as: 'preferredDriver' });

db.Driver.hasMany(db.WalletTransaction, { foreignKey: 'driver_id', as: 'walletTransactions' });
db.WalletTransaction.belongsTo(db.Driver, { foreignKey: 'driver_id', as: 'driver' });

db.Ride.hasMany(db.WalletTransaction, { foreignKey: 'ride_id', as: 'walletTransactions' });

db.Driver.hasMany(db.WalletRecharge, { foreignKey: 'driver_id', as: 'walletRecharges' });
db.WalletRecharge.belongsTo(db.Driver, { foreignKey: 'driver_id', as: 'driver' });

// Sistema de indicação: motoboy que indicou <-> motoboys ou clientes/
// estabelecimentos indicados por ele (sem diferenciação nenhuma na regra).
db.Driver.belongsTo(db.Driver, { foreignKey: 'referred_by_driver_id', as: 'referredBy' });
db.Driver.hasMany(db.Driver, { foreignKey: 'referred_by_driver_id', as: 'referredDrivers' });

db.User.belongsTo(db.Driver, { foreignKey: 'referred_by_driver_id', as: 'referredBy' });
db.Driver.hasMany(db.User, { foreignKey: 'referred_by_driver_id', as: 'referredUsers' });

db.Driver.hasMany(db.ReferralCommission, { foreignKey: 'referrer_driver_id', as: 'referralCommissionsEarned' });
db.ReferralCommission.belongsTo(db.Driver, { foreignKey: 'referrer_driver_id', as: 'referrer' });
db.ReferralCommission.belongsTo(db.Driver, { foreignKey: 'referred_driver_id', as: 'referredDriver' });
db.ReferralCommission.belongsTo(db.User, { foreignKey: 'referred_user_id', as: 'referredUser' });
db.ReferralCommission.belongsTo(db.Ride, { foreignKey: 'ride_id', as: 'ride' });

db.sequelize = sequelize;
db.Sequelize = Sequelize;

module.exports = db;
