// hashgen.js
// Parol hash generatori — bir marta ishlatish uchun.
// Ishlatish: node hashgen.js

'use strict';

const crypto = require('crypto');

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 120000, 64, 'sha512').toString('hex');
  return salt + ':' + hash;
}

console.log('');
console.log('═══════════════════════════════════════════════════════════');
console.log('  PAROL HASH GENERATORI');
console.log('═══════════════════════════════════════════════════════════');
console.log('');

// Admin paroli
const adminHash = hashPassword('Admin123!');
console.log('superAdmin / Admin123!');
console.log('   ' + adminHash);
console.log('');

// User paroli
const userHash = hashPassword('87654321');
console.log('user007 / 87654321');
console.log('   ' + userHash);
console.log('');

console.log('═══════════════════════════════════════════════════════════');
console.log('  NAMUNA — bu qiymatlarni backend.json ga qo\'ying:');
console.log('═══════════════════════════════════════════════════════════');
console.log('');
console.log('  "passwordHash": "' + adminHash + '"');
console.log('  "passwordHash": "' + userHash + '"');
console.log('');
console.log('═══════════════════════════════════════════════════════════');
console.log('');