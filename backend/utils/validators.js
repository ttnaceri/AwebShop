const {
  isValidPhone,
  isValidTelegramUsername,
  isValidNickname,
  isValidDomain,
  descriptionLength
} = require('./helpers');

function validateRegistration(body) {
  const errors = [];
  const {
    telegramUsername,
    phone,
    telegramId,
    code,
    nickname,
    password
  } = body || {};

  if (!isValidTelegramUsername(telegramUsername)) {
    errors.push('Telegram username is invalid (example: @username).');
  }
  if (!isValidPhone(phone)) {
    errors.push('Phone number is invalid.');
  }
  if (!telegramId || !/^\d{5,15}$/.test(String(telegramId))) {
    errors.push('Telegram ID must be numeric (5-15 digits).');
  }
  if (!code || !/^\d{6}$/.test(String(code))) {
    errors.push('Verification code must be 6 digits.');
  }
  if (!isValidNickname(nickname)) {
    errors.push('Nickname must be 3-20 chars (letters, digits, underscore).');
  }
  if (!password || String(password).length < 8) {
    errors.push('Password must be at least 8 characters.');
  }
  return errors;
}

function validateWebsite(body) {
  const errors = [];
  const { name, domain, description, topic, price, saleType } = body || {};

  if (!name || String(name).trim().length < 3 || String(name).length > 100) {
    errors.push('Website name must be 3-100 characters.');
  }
  if (!isValidDomain(domain)) {
    errors.push('Domain is invalid.');
  }
  if (!description || descriptionLength(description) > 200) {
    errors.push('Description is required and max 200 characters (excluding spaces).');
  }
  if (!topic || String(topic).length > 50) {
    errors.push('Topic is required.');
  }
  if (!price || isNaN(Number(price)) || Number(price) <= 0) {
    errors.push('Price must be a positive number.');
  }
  if (!['safe', 'fast'].includes(saleType)) {
    errors.push('Sale type must be "safe" or "fast".');
  }
  return errors;
}

module.exports = {
  validateRegistration,
  validateWebsite
};
function validateWebsite(body) {
  const errors = [];
  const { name, domain, description, topic, price, saleType, type } = body || {};

  // ... mavjud tekshiruvlar

  if (type && !['frontend', 'backend', 'fullstack'].includes(type)) {
    errors.push('Website type must be frontend, backend, or fullstack.');
  }

  return errors;
}