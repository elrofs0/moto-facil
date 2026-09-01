const Redis = require('ioredis');
const env = require('./env');
const logger = require('../utils').logger;

const redisClient = new Redis(env.redisUrl, {
  maxRetriesPerRequest: 3,
});

redisClient.on('error', (err) => {
  logger.error('Erro na conexão com o Redis', err);
});

redisClient.on('connect', () => {
  logger.info('Conectado ao Redis');
});

module.exports = redisClient;
