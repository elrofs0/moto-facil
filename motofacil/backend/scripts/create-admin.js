/**
 * Gera o hash bcrypt da senha do administrador do painel.
 *
 * O login do admin (ver src/controllers/adminController.js) é intencionalmente
 * simples para o MVP: um único admin, autenticado por ADMIN_EMAIL +
 * ADMIN_PASSWORD_HASH no .env — não existe tabela de admins no banco.
 *
 * Uso:
 *   node scripts/create-admin.js "minhaSenhaForte"
 *
 * Copie o hash impresso para ADMIN_PASSWORD_HASH no arquivo .env.
 */
const bcrypt = require('bcryptjs');

const password = process.argv[2];

if (!password) {
  console.error('Uso: node scripts/create-admin.js "sua-senha"');
  process.exit(1);
}

const hash = bcrypt.hashSync(password, 10);

console.log('\nAdicione (ou substitua) esta linha no seu .env:\n');
console.log(`ADMIN_PASSWORD_HASH=${hash}\n`);
