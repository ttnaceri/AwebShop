const crypto = require('crypto');

const ALPHANUM = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function randomString(length, alphabet = ALPHANUM) {
  let out = '';
  const bytes = crypto.randomBytes(length);
  for (let i = 0; i < length; i++) {
    out += alphabet[bytes[i] % alphabet.length];
  }
  return out;
}

function generateUserId() {
  // 9 xonali raqam
  let id = '';
  const bytes = crypto.randomBytes(9);
  for (let i = 0; i < 9; i++) id += (bytes[i] % 10).toString();
  return id;
}

function generateWebId() {
  // 7 belgili alfanumerik
  return randomString(7);
}

function generateOrderId() {
  // 10 belgili alfanumerik
  return randomString(10);
}

function generateToken(bytes = 32) {
  return crypto.randomBytes(bytes).toString('hex');
}

function uniqueId(prefix, existingIds = []) {
  let id;
  do {
    id = `${prefix}_${randomString(12)}`;
  } while (existingIds.includes(id));
  return id;
}

module.exports = {
  randomString,
  generateUserId,
  generateWebId,
  generateOrderId,
  generateToken,
  uniqueId
};