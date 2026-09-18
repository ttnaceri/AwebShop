// backend/api/forbidden-telegram.js
// Taqiqlangan Telegram ID'lar. Bu ID'lar bilan ro'yxatdan o'tib bo'lmaydi.

'use strict';

const { readData, update } = require('../utils/db');
const { uniqueId } = require('../utils/idGenerator');
const { now, sanitizeString } = require('../utils/helpers');

function send(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(body));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let chunks = '';
    req.on('data', c => (chunks += c));
    req.on('end', () => {
      try { resolve(chunks ? JSON.parse(chunks) : {}); }
      catch (e) { reject(new Error('Invalid JSON')); }
    });
    req.on('error', reject);
  });
}

function list(req, res) {
  const d = readData();
  send(res, 200, { success: true, data: { items: d.forbiddenTelegramIds || [] } });
}

async function create(req, res) {
  const body = await readBody(req);
  const telegramId = sanitizeString(body.telegramId, 20);
  const reason = sanitizeString(body.reason || '', 300);

  if (!telegramId || !/^\d{5,15}$/.test(telegramId)) {
    return send(res, 400, {
      success: false,
      message: 'Invalid Telegram ID (must be 5-15 digits).',
      code: 'INVALID_ID'
    });
  }

  const d = readData();
  if ((d.forbiddenTelegramIds || []).some(x => x.telegramId === telegramId)) {
    return send(res, 409, {
      success: false,
      message: 'This Telegram ID is already forbidden.',
      code: 'ALREADY_EXISTS'
    });
  }

  await update(dd => {
    dd.forbiddenTelegramIds = dd.forbiddenTelegramIds || [];
    dd.forbiddenTelegramIds.push({
      id: uniqueId('ftg', dd.forbiddenTelegramIds.map(x => x.id)),
      telegramId,
      reason,
      createdAt: now()
    });
    return dd;
  });

  send(res, 201, { success: true, data: { message: 'Added.' } });
}

async function remove(req, res) {
  const body = await readBody(req);
  await update(d => {
    d.forbiddenTelegramIds = (d.forbiddenTelegramIds || []).filter(x => x.id !== body.id);
    return d;
  });
  send(res, 200, { success: true, data: { message: 'Removed.' } });
}

/**
 * Ro'yxatdan o'tishda tekshirish uchun (auth.js chaqiradi).
 */
function isForbidden(telegramId) {
  const d = readData();
  return (d.forbiddenTelegramIds || []).some(x => x.telegramId === String(telegramId));
}

module.exports = { list, create, remove, isForbidden };