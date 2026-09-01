require('dotenv').config();

function required(name, fallback = undefined) {
  const value = process.env[name] ?? fallback;
  if (value === undefined) {
    console.warn(`[env] Variável ${name} não definida — configure o .env antes de ir para produção.`);
  }
  return value;
}

module.exports = {
  port: process.env.PORT || 3000,
  nodeEnv: process.env.NODE_ENV || 'development',

  db: {
    host: required('DB_HOST', 'localhost'),
    port: process.env.DB_PORT || 5432,
    name: required('DB_NAME', 'motofacil'),
    user: required('DB_USER', 'motofacil'),
    password: required('DB_PASSWORD', ''),
  },

  redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',

  evolution: {
    apiUrl: required('EVOLUTION_API_URL'),
    apiKey: required('EVOLUTION_API_KEY'),
    instanceName: required('EVOLUTION_INSTANCE_NAME', 'motofacil'),
  },

  mercadoPago: {
    accessToken: required('MERCADOPAGO_ACCESS_TOKEN'),
    webhookSecret: required('MERCADOPAGO_WEBHOOK_SECRET'),
  },

  jwtSecret: required('JWT_SECRET', 'dev-secret-troque-em-producao'),

  pricing: {
    base: parseFloat(process.env.PRECO_BASE || '5.00'),
    perKm: parseFloat(process.env.PRECO_POR_KM || '2.20'),
    platformCommissionPercent: parseFloat(process.env.COMISSAO_PLATAFORMA_PERCENTUAL || '20'),
  },
};
