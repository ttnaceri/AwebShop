// backend/api/webhooks.js
// Webhooks CRUD.

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
  send(res, 200, { success: true, data: { items: d.webhooks || [] } });
}

async function create(req, res) {
  const body = await readBody(req);
  const url = sanitizeString(body.url, 500);
  if (!url || !/^https?:\/\//.test(url)) {
    return send(res, 400, { success: false, message: 'Valid URL required.', code: 'INVALID_URL' });
  }

  await update(d => {
    d.webhooks = d.webhooks || [];
    d.webhooks.push({
      id: uniqueId('wh', d.webhooks.map(w => w.id)),
      url,
      event: sanitizeString(body.event || 'generic', 60),
      secret: sanitizeString(body.secret || '', 200),
      active: body.active !== false,
      createdAt: now(),
      updatedAt: now()
    });
    return d;
  });

  send(res, 201, { success: true, data: { message: 'Webhook created.' } });
}

async function updateHook(req, res) {
  const body = await readBody(req);
  await update(d => {
    const w = (d.webhooks || []).find(x => x.id === body.id);
    if (w) {
      if (body.url !== undefined) w.url = sanitizeString(body.url, 500);
      if (body.event !== undefined) w.event = sanitizeString(body.event, 60);
      if (body.secret !== undefined) w.secret = sanitizeString(body.secret, 200);
      if (typeof body.active === 'boolean') w.active = body.active;
      w.updatedAt = now();
    }
    return d;
  });
  send(res, 200, { success: true, data: { message: 'Updated.' } });
}

async function remove(req, res) {
  const body = await readBody(req);
  await update(d => {
    d.webhooks = (d.webhooks || []).filter(x => x.id !== body.id);
    return d;
  });
  send(res, 200, { success: true, data: { message: 'Deleted.' } });
}

module.exports = { list, create, update: updateHook, remove };