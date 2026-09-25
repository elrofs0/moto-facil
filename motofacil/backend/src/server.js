const app = require('./app');
const env = require('./config/env');
const { sequelize } = require('./models');
const { logger } = require('./utils');
const rideService = require('./services/rideService');

async function start() {
  try {
    await sequelize.authenticate();
    logger.info('Conexão com o banco de dados estabelecida.');

    // Varredura periódica pra motoboy preferido que não respondeu a tempo
    // (ver rideService.sweepExpiredPreferredOffers) — roda no processo da
    // API mesmo, sem dependência de fila/cron externo.
    rideService.startPreferredDriverSweep();

    app.listen(env.port, () => {
      logger.info(`MotoFácil API rodando na porta ${env.port} (${env.nodeEnv})`);
    });
  } catch (err) {
    logger.error('Falha ao iniciar a aplicação:', err);
    process.exit(1);
  }
}

start();
