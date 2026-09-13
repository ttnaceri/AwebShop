const crypto = require('crypto');

function hashPassword(password, salt = null) {
  const useSalt = salt || crypto.randomBytes(16).toString('hex');
  const hash = crypto
    .pbkdf2Sync(password, useSalt, 120000, 64, 'sha512')
    .toString('hex');
  return `${useSalt}:${hash}`;
}

function verifyPassword(password, stored) {
  if (!stored || !stored.includes(':')) return false;
  const [salt] = stored.split(':');
  return hashPassword(password, salt) === stored;
}

function now() {
  return new Date().toISOString();
}

function sanitizeString(str, maxLen = 1000) {
  if (typeof str !== 'string') return '';
  return str.trim().slice(0, maxLen);
}

function isValidPhone(phone) {
  return /^\+?\d{7,15}$/.test(String(phone).replace(/\s|-/g, ''));
}

function isValidTelegramUsername(u) {
  return /^@?[a-zA-Z0-9_]{5,32}$/.test(String(u).trim());
}

function isValidNickname(n) {
  return /^[a-zA-Z0-9_]{3,20}$/.test(String(n).trim());
}

function isValidDomain(domain) {
  if (!domain) return false;
  const d = String(domain)
    .trim()
    .replace(/^https?:\/\//i, '')
    .replace(/\/.*$/, '')
    .toLowerCase();
  // www. ixtiyoriy
  return /^(www\.)?([a-z0-9-]+\.)+[a-z]{2,}$/i.test(d);
}

function normalizeDomain(domain) {
  return String(domain)
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//i, '')
    .replace(/^www\./, '')
    .replace(/\/.*$/, '');
}

function descriptionLength(text) {
  // bo'sh joylarni hisobga olmagan holda uzunlik
  return String(text || '').replace(/\s/g, '').length;
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

module.exports = {
  hashPassword,
  verifyPassword,
  now,
  sanitizeString,
  isValidPhone,
  isValidTelegramUsername,
  isValidNickname,
  isValidDomain,
  normalizeDomain,
  descriptionLength,
  escapeHtml
};