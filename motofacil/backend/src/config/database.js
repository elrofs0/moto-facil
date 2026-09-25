// Configuração usada pelo Sequelize CLI (migrations) e pela conexão da aplicação.
require('dotenv').config();

const rawUrl = process.env.DATABASE_URL || '';

// Produção: aceita uma connection string padrão do Postgres
// (postgres://usuario:senha@host:5432/banco) — o formato que praticamente
// todo provedor gerenciado (Railway, Render, Supabase, RDS, VPS com
// Postgres próprio) entrega. SSL habilitado por padrão; desative só se o
// seu Postgres não usa SSL (DB_SSL=false).
function postgresUrlConfig(url) {
  return {
    url,
    dialect: 'postgres',
    logging: false,
    dialectOptions: {
      ssl: process.env.DB_SSL === 'false' ? false : { require: true, rejectUnauthorized: false },
    },
    pool: { max: 10, min: 0, acquire: 30000, idle: 10000 },
  };
}

// Postgres via variáveis individuais — alternativa a DATABASE_URL para
// quando o provedor não entrega uma connection string única.
function postgresDiscreteConfig() {
  return {
    username: process.env.DB_USER || 'motofacil',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'motofacil',
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    dialect: 'postgres',
    logging: false,
    dialectOptions: {
      ssl: process.env.DB_SSL === 'true' ? { require: true, rejectUnauthorized: false } : false,
    },
    pool: { max: 10, min: 0, acquire: 30000, idle: 10000 },
  };
}

// Desenvolvimento/teste: SQLite em arquivo local — zero setup.
function sqliteConfig(url, storageOverride) {
  return {
    dialect: 'sqlite',
    storage: storageOverride || (url || '').replace(/^sqlite:/, '') || './motofacil.sqlite',
    logging: false,
  };
}

// Config genérica a partir de DATABASE_URL, seja qual for o ambiente —
// usada tanto em development quanto em production quando a variável está
// definida, para nunca surpreender: se você aponta DATABASE_URL para um
// Postgres, é Postgres que roda, independente de NODE_ENV.
function configFromUrl(url) {
  if (url.startsWith('postgres://') || url.startsWith('postgresql://')) return postgresUrlConfig(url);
  if (url.startsWith('sqlite:') || url.endsWith('.sqlite')) return sqliteConfig(url);
  return null;
}

const fromUrl = rawUrl ? configFromUrl(rawUrl) : null;

module.exports = {
  development: fromUrl || sqliteConfig(rawUrl),
  test: fromUrl && fromUrl.dialect === 'postgres' ? fromUrl : sqliteConfig(rawUrl, './motofacil_test.sqlite'),
  // Produção sem DATABASE_URL definida cai para Postgres via variáveis
  // discretas (DB_HOST/DB_USER/...) em vez de SQLite — não faz sentido
  // rodar corridas reais num arquivo local que não escala nem sobrevive
  // a redeploys em muitos provedores de VPS/containers.
  production: fromUrl || postgresDiscreteConfig(),
};
