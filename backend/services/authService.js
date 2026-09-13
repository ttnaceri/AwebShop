const crypto = require('crypto');
const { jwt } = require('../../config');
const { readData, update } = require('../utils/db');
const {
  hashPassword,
  verifyPassword,
  now,
  isValidNickname
} = require('../utils/helpers');
const { generateToken, generateUserId, uniqueId } = require('../utils/idGenerator');

const sessions = new Map(); // token -> { userId, expiresAt, role }

function signToken(payload) {
  const data = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = crypto
    .createHmac('sha256', jwt.secret)
    .update(data)
    .digest('base64url');
  return `${data}.${sig}`;
}

function verifySignedToken(token) {
  if (!token || !token.includes('.')) return null;
  const [data, sig] = token.split('.');
  const expected = crypto
    .createHmac('sha256', jwt.secret)
    .update(data)
    .digest('base64url');
  if (expected !== sig) return null;
  try {
    return JSON.parse(Buffer.from(data, 'base64url').toString('utf8'));
  } catch {
    return null;
  }
}

function createSession(userId, role = 'user') {
  const token = signToken({ userId, role, iat: Date.now() });
  sessions.set(token, {
    userId,
    role,
    expiresAt: Date.now() + jwt.tokenTtlMs
  });
  return token;
}

function verifySession(token) {
  const signed = verifySignedToken(token);
  if (!signed) return null;
  const s = sessions.get(token);
  if (!s || s.expiresAt < Date.now()) {
    sessions.delete(token);
    return null;
  }
  return { userId: s.userId, role: s.role };
}

function destroySession(token) {
  sessions.delete(token);
}

function findUserByNickname(nickname) {
  const data = readData();
  return data.users.find(
    u => u.nickname.toLowerCase() === String(nickname).toLowerCase() && !u.deleted
  );
}

function findUserById(id) {
  const data = readData();
  return data.users.find(u => u.id === id);
}

function createUser(payload) {
  return update(data => {
    const id = generateUserId();
    const user = {
      id,
      nickname: payload.nickname,
      passwordHash: hashPassword(payload.password),
      telegramUsername: payload.telegramUsername,
      telegramId: payload.telegramId,
      phone: payload.phone,
      email: null,
      role: 'user',
      balanceAWC: 0,
      totalSpent: 0,
      totalEarned: 0,
      rating: 0,
      verified: true,
      darkMode: true,
      language: 'en',
      currency: 'UZS',
      premiumPlan: null,
      premiumExpiresAt: null,
      badges: [],
      createdAt: now(),
      updatedAt: now(),
      nicknameUpdatedAt: now(),
      deleted: false,
      blocked: false
    };
    data.users.push(user);
    return data;
  });
}

function issueVerificationCode({ telegramId, telegramUsername, purpose }) {
  const code = String(crypto.randomInt(100000, 999999));
  return update(data => {
    data.verificationCodes = (data.verificationCodes || []).filter(
      c => !(c.telegramId === telegramId && c.purpose === purpose)
    );
    data.verificationCodes.push({
      id: uniqueId('code', data.verificationCodes.map(c => c.id)),
      telegramId,
      telegramUsername,
      purpose,
      codeHash: hashPassword(code),
      createdAt: now(),
      expiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
      used: false
    });
    return data;
  }).then(() => code);
}

function consumeVerificationCode({ telegramId, purpose, code }) {
  let ok = false;
  update(data => {
    const entry = (data.verificationCodes || []).find(
      c =>
        c.telegramId === telegramId &&
        c.purpose === purpose &&
        !c.used &&
        new Date(c.expiresAt).getTime() > Date.now()
    );
    if (entry && verifyPassword(code, entry.codeHash)) {
      entry.used = true;
      ok = true;
    }
    return data;
  });
  return ok;
}

module.exports = {
  createSession,
  verifySession,
  destroySession,
  findUserByNickname,
  findUserById,
  createUser,
  issueVerificationCode,
  consumeVerificationCode,
  signToken,
  verifySignedToken
};