const { Sequelize, DataTypes } = require('sequelize');
const config = require('../config/database')[process.env.NODE_ENV || 'development'];

const sequelize = new Sequelize(config.database, config.username, config.password, config);

const db = {};

db.User = require('./user')(sequelize, DataTypes);
db.Driver = require('./driver')(sequelize, DataTypes);
db.Vehicle = require('./vehicle')(sequelize, DataTypes);
db.Ride = require('./ride')(sequelize, DataTypes);
db.WalletTransaction = require('./walletTransaction')(sequelize, DataTypes);

// Associações
db.Driver.hasMany(db.Vehicle, { foreignKey: 'driver_id', as: 'vehicles' });
db.Vehicle.belongsTo(db.Driver, { foreignKey: 'driver_id', as: 'driver' });

db.User.hasMany(db.Ride, { foreignKey: 'client_id', as: 'rides' });
db.Ride.belongsTo(db.User, { foreignKey: 'client_id', as: 'client' });

db.Driver.hasMany(db.Ride, { foreignKey: 'driver_id', as: 'rides' });
db.Ride.belongsTo(db.Driver, { foreignKey: 'driver_id', as: 'driver' });

db.Driver.hasMany(db.WalletTransaction, { foreignKey: 'driver_id', as: 'walletTransactions' });
db.WalletTransaction.belongsTo(db.Driver, { foreignKey: 'driver_id', as: 'driver' });

db.Ride.hasMany(db.WalletTransaction, { foreignKey: 'ride_id', as: 'walletTransactions' });

db.sequelize = sequelize;
db.Sequelize = Sequelize;

module.exports = db;
