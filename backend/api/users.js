const { readData, update } = require('../utils/db');
const { sanitizeString, now, isValidNickname } = require('../utils/helpers');

function send(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(body));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let chunks = '';
    req.on('data', c => (chunks += c));
    req.on('end', () => {
      try { resolve(chunks ? JSON.parse(chunks) : {}); }
      catch { reject(new Error('Invalid JSON')); }
    });
    req.on('error', reject);
  });
}

async function profile(req, res) {
  const data = readData();
  const user = data.users.find(u => u.id === req.user.userId);
  if (!user) return send(res, 404, { success: false, message: 'Not found', code: 'NOT_FOUND' });
  const { passwordHash, ...safe } = user;
  send(res, 200, { success: true, data: { user: safe } });
}

async function updateProfile(req, res) {
  const body = await readBody(req);
  const data = readData();
  const user = data.users.find(u => u.id === req.user.userId);
  if (!user) return send(res, 404, { success: false, message: 'Not found', code: 'NOT_FOUND' });

  const patch = {};

  if (typeof body.darkMode === 'boolean') patch.darkMode = body.darkMode;
  if (body.language && ['en', 'uz'].includes(body.language)) patch.language = body.language;
  if (body.currency && ['UZS', 'USD'].includes(body.currency)) patch.currency = body.currency;

  if (body.nickname && body.nickname !== user.nickname) {
    if (!isValidNickname(body.nickname)) {
      return send(res, 400, { success: false, message: 'Invalid nickname.', code: 'INVALID_NICKNAME' });
    }
    const twoWeeks = 14 * 24 * 60 * 60 * 1000;
    const last = user.nicknameUpdatedAt ? new Date(user.nicknameUpdatedAt).getTime() : 0;
    if (Date.now() - last < twoWeeks) {
      return send(res, 400, {
        success: false,
        message: 'Nickname can only be changed once every 2 weeks.',
        code: 'NICKNAME_COOLDOWN'
      });
    }
    const taken = data.users.some(u => u.id !== user.id && u.nickname.toLowerCase() === String(body.nickname).toLowerCase());
    if (taken) return send(res, 409, { success: false, message: 'Nickname taken.', code: 'NICKNAME_TAKEN' });
    patch.nickname = sanitizeString(body.nickname, 20);
    patch.nicknameUpdatedAt = now();
  }

  await update(d => {
    const u = d.users.find(x => x.id === user.id);
    Object.assign(u, patch, { updatedAt: now() });
    return d;
  });

  const fresh = readData().users.find(u => u.id === user.id);
  const { passwordHash, ...safe } = fresh;
  send(res, 200, { success: true, data: { user: safe } });
}

async function myWebsites(req, res) {
  const data = readData();
  const items = data.websites.filter(w => w.sellerId === req.user.userId);
  send(res, 200, { success: true, data: { items } });
}

async function myTransactions(req, res) {
  const data = readData();
  const items = data.transactions.filter(t => t.userId === req.user.userId);
  send(res, 200, { success: true, data: { items } });
}

async function myReviews(req, res) {
  const data = readData();
  const items = data.reviews.filter(r => r.userId === req.user.userId || r.targetUserId === req.user.userId);
  send(res, 200, { success: true, data: { items } });
}

module.exports = { profile, updateProfile, myWebsites, myTransactions, myReviews };