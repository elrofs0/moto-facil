const express = require('express');
const cors = require('cors');
const env = require('./config/env');
const routes = require('./routes');
const { errorHandler, AppError } = require('./middleware/errorHandler');

const app = express();

app.use(cors({
  origin(origin, callback) {
    // Sem header Origin = chamada server-to-server (webhook, curl, etc.),
    // não passa pelo CORS do navegador — sempre libera.
    if (!origin) return callback(null, true);
    if (env.corsAllowedOrigins.includes('*') || env.corsAllowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    return callback(new AppError(`Origem não permitida pelo CORS: ${origin}`, 403));
  },
}));
app.use(express.json());

app.use('/api', routes);

app.use(errorHandler);

module.exports = app;
