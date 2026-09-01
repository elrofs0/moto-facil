const jwt = require('jsonwebtoken');
const env = require('../config/env');
const { AppError } = require('./errorHandler');

// Protege as rotas do painel administrativo. O login do admin gera um JWT
// simples; cada requisição subsequente precisa do header Authorization.
function authMiddleware(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return next(new AppError('Não autenticado', 401));
  }

  const token = header.replace('Bearer ', '');
  try {
    const payload = jwt.verify(token, env.jwtSecret);
    req.admin = payload;
    next();
  } catch (err) {
    next(new AppError('Sessão inválida ou expirada', 401));
  }
}

module.exports = authMiddleware;
