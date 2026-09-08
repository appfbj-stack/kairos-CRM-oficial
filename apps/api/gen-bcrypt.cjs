// Gera hash bcrypt para usar no seed SQL
const bcrypt = require('bcryptjs');
const password = process.argv[2] || 'Troque@Senha123';
const rounds = parseInt(process.argv[3] || '12');
bcrypt.hash(password, rounds).then(h => console.log(h));
