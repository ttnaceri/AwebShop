// backend/api/cards.js
// To'lov kartalari (foydalanuvchi shu kartaga pul o'tkazadi).

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
    req.on('end', () => { try { resolve(chunks ? JSON.parse(chunks) : {}); } catch (e) { reject(e); } });
    req.on('error', reject);
  });
}

// PUBLIC: foydalanuvchi to'lov qilishi uchun aktiv kartani olish
function publicCard(req, res) {
  const d = readData();
  const card = (d.paymentCards || []).find(c => c.status === 'active' && c.isDefault)
             || (d.paymentCards || []).find(c => c.status === 'active');
  if (!card) return send(res, 404, { success: false, message: 'No active card.', code: 'NO_CARD' });
  send(res, 200, {
    success: true,
    data: {
      id: card.id,
      cardNumber: card.cardNumber,
      owner: card.owner,
      bank: card.bank,
      type: card.type
    }
  });
}

// ADMIN: List
function adminList(req, res) {
  const d = readData();
  send(res, 200, { success: true, data: { items: d.paymentCards || [] } });
}

// ADMIN: Create
async function adminCreate(req, res) {
  const body = await readBody(req);
  await update(d => {
    d.paymentCards = d.paymentCards || [];
    const card = {
      id: uniqueId('card', d.paymentCards.map(c => c.id)),
      cardNumber: sanitizeString(body.cardNumber, 32),
      owner: sanitizeString(body.owner, 100),
      bank: sanitizeString(body.bank, 100),
      type: sanitizeString(body.type || 'uzcard', 20),
      expiry: sanitizeString(body.expiry || '', 10),
      status: body.status === 'active' ? 'active' : 'inactive',
      isDefault: !!body.isDefault,
      createdAt: now()
    };
    if (card.isDefault) d.paymentCards.forEach(c => { c.isDefault = false; });
    d.paymentCards.push(card);
    return d;
  });
  send(res, 201, { success: true, data: { message: 'Card created.' } });
}

// ADMIN: Update
async function adminUpdate(req, res) {
  const body = await readBody(req);
  await update(d => {
    const c = (d.paymentCards || []).find(x => x.id === body.id);
    if (c) {
      ['cardNumber','owner','bank','type','expiry','status'].forEach(k => {
        if (body[k] !== undefined) c[k] = sanitizeString(body[k], 200);
      });
      if (typeof body.isDefault === 'boolean') {
        if (body.isDefault) d.paymentCards.forEach(x => { x.isDefault = false; });
        c.isDefault = body.isDefault;
      }
      c.updatedAt = now();
    }
    return d;
  });
  send(res, 200, { success: true, data: { message: 'Updated.' } });
}

// ADMIN: Delete
async function adminDelete(req, res) {
  const body = await readBody(req);
  await update(d => { d.paymentCards = (d.paymentCards || []).filter(c => c.id !== body.id); return d; });
  send(res, 200, { success: true, data: { message: 'Deleted.' } });
}

module.exports = { publicCard, adminList, adminCreate, adminUpdate, adminDelete };