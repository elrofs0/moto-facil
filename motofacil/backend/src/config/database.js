// Configuração usada pelo Sequelize CLI (migrations) e pela conexão da aplicação.
require('dotenv').config();

const base = {
  username: process.env.DB_USER || 'motofacil',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'motofacil',
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  dialect: 'postgres',
  logging: false,
};

module.exports = {
  development: base,
  test: { ...base, database: `${base.database}_test` },
  production: { ...base, dialectOptions: { ssl: process.env.DB_SSL === 'true' ? { require: true, rejectUnauthorized: false } : false } },
};
