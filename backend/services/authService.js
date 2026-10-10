// backend/services/authService.js
// AWebShop — Auth service: sessions, users, verification codes.
// SHA-256 based verification codes (deterministic).

'use strict';

const crypto = require('crypto');
const { jwt } = require('../../config');
const { readData, update } = require('../utils/db');
const { hashPassword, now } = require('../utils/helpers');
const { generateUserId, uniqueId } = require('../utils/idGenerator');

// ============================================================
// SESSIONS (in-memory)
// ============================================================
const sessions = new Map();

function signToken(payload) {
  const data = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = crypto
    .createHmac('sha256', jwt.secret)
    .update(data)
    .digest('base64url');
  return data + '.' + sig;
}

function verifySignedToken(token) {
  if (!token || !token.includes('.')) return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const data = parts[0];
  const sig = parts[1];
  const expected = crypto
    .createHmac('sha256', jwt.secret)
    .update(data)
    .digest('base64url');
  if (expected !== sig) return null;
  try {
    return JSON.parse(Buffer.from(data, 'base64url').toString('utf8'));
  } catch (_) {
    return null;
  }
}

function createSession(userId, role) {
  const token = signToken({ userId: userId, role: role || 'user', iat: Date.now() });
  sessions.set(token, {
    userId: userId,
    role: role || 'user',
    expiresAt: Date.now() + (jwt.tokenTtlMs || 7 * 24 * 60 * 60 * 1000)
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

// ============================================================
// USERS
// ============================================================
function findUserByNickname(nickname) {
  const data = readData();
  return data.users.find(function (u) {
    return u.nickname && u.nickname.toLowerCase() === String(nickname).toLowerCase() && !u.deleted;
  });
}

function findUserById(id) {
  const data = readData();
  return data.users.find(function (u) { return u.id === id; });
}

function createUser(payload) {
  return update(function (data) {
    const id = generateUserId();
    const user = {
      id: id,
      nickname: payload.nickname,
      passwordHash: hashPassword(payload.password),
      telegramUsername: payload.telegramUsername || '',
      telegramId: payload.telegramId || '',
      phone: payload.phone || '',
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
      moderationStrikes: { count: 0, until: null },
      banned: false,
      banReason: null,
      bannedAt: null,
      blockedUntil: null,
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

// ============================================================
// VERIFICATION CODES — SHA-256 (deterministic)
// ============================================================
function hashCode(code) {
  return crypto
    .createHash('sha256')
    .update('awebshop_' + String(code))
    .digest('hex');
}

async function issueVerificationCode(payload) {
  const code = String(crypto.randomInt(100000, 1000000)); // 100000-999999
  const codeHash = hashCode(code);

  const telegramId = String(payload.telegramId || '');
  const purpose = payload.purpose || 'register';

  await update(function (data) {
    if (!Array.isArray(data.verificationCodes)) data.verificationCodes = [];

    // Eski kodlarni o'chirish (bir xil telegramId + purpose)
    data.verificationCodes = data.verificationCodes.filter(function (c) {
      return !(c.telegramId === telegramId && c.purpose === purpose);
    });

    data.verificationCodes.push({
      id: uniqueId('code', data.verificationCodes.map(function (c) { return c.id; })),
      telegramId: telegramId,
      telegramUsername: payload.telegramUsername || '',
      purpose: purpose,
      codeHash: codeHash,
      codePlain: code,
      used: false,
      createdAt: now(),
      expiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString()
    });

    return data;
  });

  return code;
}

async function consumeVerificationCode(payload) {
  const telegramId = String(payload.telegramId || '');
  const purpose = payload.purpose || 'register';
  const code = String(payload.code || '');
  const codeHash = hashCode(code);

  let consumed = false;

  await update(function (data) {
    if (!Array.isArray(data.verificationCodes)) {
      data.verificationCodes = [];
      return data;
    }

    const entry = data.verificationCodes.find(function (c) {
      return c.telegramId === telegramId &&
             c.purpose === purpose &&
             !c.used &&
             new Date(c.expiresAt).getTime() > Date.now();
    });

    if (entry) {
      if (entry.codeHash === codeHash) {
        entry.used = true;
        entry.usedAt = now();
        consumed = true;
        console.log('[authService:consumeCode] ✅ Kod tasdiqlandi: ' + telegramId);
      } else {
        console.warn('[authService:consumeCode] ❌ Kod noto\'g\'ri: ' + telegramId +
          '\n  Kelgan hash:  ' + codeHash.slice(0, 20) +
          '\n  Kutlgan hash: ' + entry.codeHash.slice(0, 20));
      }
    } else {
      console.warn('[authService:consumeCode] ❌ Kod topilmadi yoki muddati o\'tgan: ' + telegramId);
    }

    return data;
  });

  return consumed;
}

// ============================================================
// EXPORTS
// ============================================================
module.exports = {
  createSession: createSession,
  verifySession: verifySession,
  destroySession: destroySession,
  findUserByNickname: findUserByNickname,
  findUserById: findUserById,
  createUser: createUser,
  issueVerificationCode: issueVerificationCode,
  consumeVerificationCode: consumeVerificationCode,
  signToken: signToken,
  verifySignedToken: verifySignedToken
};