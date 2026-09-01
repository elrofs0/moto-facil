const { AppError } = require('./errorHandler');

// Validação leve, sem dependência externa. Passa um objeto { campo: 'obrigatório' }
// e valida se req.body[campo] existe.
function requireFields(fields) {
  return (req, res, next) => {
    const missing = fields.filter((field) => {
      const value = req.body[field];
      return value === undefined || value === null || value === '';
    });
    if (missing.length > 0) {
      return next(new AppError(`Campos obrigatórios ausentes: ${missing.join(', ')}`, 422));
    }
    next();
  };
}

module.exports = { requireFields };
