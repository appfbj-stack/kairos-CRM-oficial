// Gera hash bcrypt para usar no seed SQL
import bcrypt from 'bcryptjs';
const password = process.argv[2] || 'Troque@Senha123';
const rounds = parseInt(process.argv[3] || '12');
const hash = await bcrypt.hash(password, rounds);
console.log(hash);
