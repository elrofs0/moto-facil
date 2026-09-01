const app = require('./app');
const env = require('./config/env');
const { sequelize } = require('./models');
const { logger } = require('./utils');

async function start() {
  try {
    await sequelize.authenticate();
    logger.info('Conexão com o banco de dados estabelecida.');

    app.listen(env.port, () => {
      logger.info(`MotoFácil API rodando na porta ${env.port} (${env.nodeEnv})`);
    });
  } catch (err) {
    logger.error('Falha ao iniciar a aplicação:', err);
    process.exit(1);
  }
}

start();
