// backend/api/auth.js
// AWebShop — Auth: register, login, verification, recovery.
// Kod Telegram'ga HTML formatda yuboriladi (copyable).

'use strict';

const {
  createSession,
  destroySession,
  findUserByNickname,
  findUserById,
  createUser,
  issueVerificationCode,
  consumeVerificationCode
} = require('../services/authService');

const { validateRegistration } = require('../utils/validators');
const { hashPassword, verifyPassword, sanitizeString } = require('../utils/helpers');
const { readData, update } = require('../utils/db');
const { notifyUser } = require('../services/telegramService');

// ============================================================
// HELPERS
// ============================================================
function send(res, status, body) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS'
  });
  res.end(JSON.stringify(body));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let chunks = '';
    req.on('data', c => {
      chunks += c;
      if (chunks.length > 1e6) reject(new Error('Payload too large'));
    });
    req.on('end', () => {
      try { resolve(chunks ? JSON.parse(chunks) : {}); }
      catch (e) { reject(new Error('Invalid JSON')); }
    });
    req.on('error', reject);
  });
}

function publicUser(u) {
  if (!u) return null;
  const { passwordHash, ...rest } = u;
  return rest;
}

function isTelegramEnabled() {
  try {
    const c = require('../../config');
    return !!(c.telegram && c.telegram.enabled && c.telegram.botToken &&
              !c.telegram.botToken.includes('YOUR_'));
  } catch (_) {
    return false;
  }
}

/**
 * Kodni Telegram'ga yuborish — HTML formatda (copyable).
 * Xato bo'lsa ham davom etadi (javobni bloklamaydi).
 */
function sendCodeViaTelegram(telegramId, code, purpose) {
  const title = purpose === 'recover' ? '🔐 Recovery code' : '🔐 Verification code';

  const message =
    '<b>' + title + '</b>\n\n' +
    '<code>' + code + '</code>\n\n' +
    'Expires in 10 minutes.';

  // Xatolarni ushlash — javobni kutmasdan
  try {
    notifyUser(telegramId, message)
      .then(function (res) {
        if (res && res.ok) {
          console.log('[auth:sendCode] ✅ Sent to ' + telegramId + ' code=' + code);
        } else {
          console.error('[auth:sendCode] ❌ Failed:', res && res.description);
        }
      })
      .catch(function (e) {
        console.error('[auth:sendCode] ❌ Exception:', e.message);
      });
  } catch (e) {
    console.error('[auth:sendCode] ❌ Sync error:', e.message);
  }
}

// ============================================================
// REQUEST VERIFICATION
// ============================================================
async function requestVerification(req, res) {
  try {
    const body = await readBody(req);
    const telegramId = sanitizeString(body.telegramId, 20);
    const telegramUsername = sanitizeString(body.telegramUsername, 64);

    if (!telegramId || !/^\d{5,15}$/.test(telegramId)) {
      return send(res, 400, {
        success: false,
        message: 'Telegram ID is invalid.',
        code: 'INVALID_TELEGRAM_ID'
      });
    }

    const data = readData();

    if (data.users.some(u => u.telegramId === telegramId && !u.deleted)) {
      return send(res, 409, {
        success: false,
        message: 'This Telegram ID is already registered.',
        code: 'TELEGRAM_IN_USE'
      });
    }

    if ((data.forbiddenTelegramIds || []).some(x => x.telegramId === telegramId)) {
      return send(res, 403, {
        success: false,
        message: 'This Telegram ID is not allowed.',
        code: 'FORBIDDEN_TELEGRAM_ID'
      });
    }

    const code = await issueVerificationCode({
      telegramId,
      telegramUsername,
      purpose: 'register'
    });

    console.log('[auth:request-verification] Kod yaratildi: ' + telegramId + ' → ' + code);

    const tgEnabled = isTelegramEnabled();

    if (tgEnabled) {
      sendCodeViaTelegram(telegramId, code, 'register');
    } else {
      console.log('[auth:request-verification] [DEV] Telegram disabled. Kod: ' + code);
    }

    return send(res, 200, {
      success: true,
      data: {
        message: tgEnabled ? 'Verification code sent via Telegram.' : 'Telegram disabled. Use debug code.',
        debugCode: tgEnabled ? undefined : code
      }
    });
  } catch (err) {
    console.error('[auth:request-verification]', err.stack || err.message);
    return send(res, 500, {
      success: false,
      message: 'Request failed.',
      code: 'REQUEST_VERIFICATION_ERROR'
    });
  }
}

// ============================================================
// REGISTER
// ============================================================
async function register(req, res) {
  try {
    const body = await readBody(req);
    const errors = validateRegistration(body);

    if (errors.length) {
      return send(res, 400, {
        success: false,
        message: errors.join(' '),
        code: 'VALIDATION_ERROR'
      });
    }

    const nickname = sanitizeString(body.nickname, 20);
    const telegramId = sanitizeString(body.telegramId, 20);
    const telegramUsername = sanitizeString(body.telegramUsername, 64);
    const phone = sanitizeString(body.phone, 20);

    const existing = readData();

    if (existing.users.some(u =>
      u.nickname && u.nickname.toLowerCase() === nickname.toLowerCase() && !u.deleted
    )) {
      return send(res, 409, {
        success: false,
        message: 'Nickname is already taken.',
        code: 'NICKNAME_TAKEN'
      });
    }

    if (existing.users.some(u => u.telegramId === telegramId && !u.deleted)) {
      return send(res, 409, {
        success: false,
        message: 'This Telegram ID is already registered.',
        code: 'TELEGRAM_IN_USE'
      });
    }

    if ((existing.forbiddenTelegramIds || []).some(x => x.telegramId === telegramId)) {
      return send(res, 403, {
        success: false,
        message: 'This Telegram ID is not allowed.',
        code: 'FORBIDDEN_TELEGRAM_ID'
      });
    }

    const codeOk = await consumeVerificationCode({
      telegramId,
      purpose: 'register',
      code: body.code
    });

    if (!codeOk) {
      return send(res, 400, {
        success: false,
        message: 'Verification code is invalid or expired.',
        code: 'INVALID_CODE'
      });
    }

    await createUser({
      nickname,
      password: body.password,
      telegramUsername,
      telegramId,
      phone
    });

    const user = findUserByNickname(nickname);
    if (!user) {
      return send(res, 500, {
        success: false,
        message: 'Failed to create user.',
        code: 'CREATE_USER_ERROR'
      });
    }

    const token = createSession(user.id, 'user');

    // Welcome xabar — async
    if (isTelegramEnabled()) {
      notifyUser(
        telegramId,
        '🎉 Welcome to <b>AWebShop</b>, <b>' + nickname + '</b>!\n\nStart selling or buying websites today.'
      ).catch(function () {});
    }

    send(res, 201, {
      success: true,
      data: {
        token,
        user: publicUser(user)
      }
    });
  } catch (err) {
    console.error('[auth:register]', err.stack || err.message);
    return send(res, 500, {
      success: false,
      message: 'Registration failed.',
      code: 'REGISTER_ERROR'
    });
  }
}

// ============================================================
// LOGIN
// ============================================================
async function login(req, res) {
  try {
    const body = await readBody(req);
    const nickname = sanitizeString(body.nickname, 20);
    const password = String(body.password || '');

    const user = findUserByNickname(nickname);

    if (!user) {
      return send(res, 401, {
        success: false,
        message: 'Invalid credentials.',
        code: 'INVALID_CREDENTIALS'
      });
    }

    if (user.banned) {
      return send(res, 403, {
        success: false,
        message: 'Your account has been permanently banned.',
        code: 'ACCOUNT_BANNED',
        data: { reason: user.banReason || null }
      });
    }

    if (user.blocked && user.blockedUntil) {
      const until = new Date(user.blockedUntil).getTime();
      if (until > Date.now()) {
        return send(res, 403, {
          success: false,
          message: 'Your account is temporarily blocked.',
          code: 'ACCOUNT_TEMP_BLOCKED',
          data: { blockedUntil: user.blockedUntil }
        });
      }
    }

    if (!verifyPassword(password, user.passwordHash)) {
      return send(res, 401, {
        success: false,
        message: 'Invalid credentials.',
        code: 'INVALID_CREDENTIALS'
      });
    }

    const token = createSession(user.id, user.role || 'user');

    // Login xabari — async (javobni bloklamaydi)
    if (isTelegramEnabled() && user.telegramId) {
      notifyUser(
        user.telegramId,
        '🔔 <b>New login</b>\n\nNickname: <b>' + user.nickname + '</b>\nTime: ' + new Date().toISOString()
      ).catch(function () {});
    }

    send(res, 200, {
      success: true,
      data: {
        token,
        user: publicUser(user)
      }
    });
  } catch (err) {
    console.error('[auth:login]', err.stack || err.message);
    return send(res, 500, {
      success: false,
      message: 'Login failed.',
      code: 'LOGIN_ERROR'
    });
  }
}

// ============================================================
// LOGOUT
// ============================================================
async function logout(req, res) {
  try {
    const { readToken } = require('../middleware/auth');
    const token = readToken(req);
    if (token) destroySession(token);
    send(res, 200, { success: true, data: { message: 'Logged out.' } });
  } catch (err) {
    console.error('[auth:logout]', err.message);
    send(res, 500, { success: false, message: 'Logout failed.', code: 'LOGOUT_ERROR' });
  }
}

// ============================================================
// ME
// ============================================================
function me(req, res) {
  try {
    const user = findUserById(req.user.userId);
    if (!user) {
      return send(res, 404, {
        success: false,
        message: 'User not found.',
        code: 'NOT_FOUND'
      });
    }
    send(res, 200, { success: true, data: { user: publicUser(user) } });
  } catch (err) {
    console.error('[auth:me]', err.message);
    send(res, 500, { success: false, message: 'Failed.', code: 'ME_ERROR' });
  }
}

// ============================================================
// FORGOT PASSWORD
// ============================================================
async function forgotPassword(req, res) {
  try {
    const body = await readBody(req);
    const nickname = sanitizeString(body.nickname, 20);
    const user = findUserByNickname(nickname);

    if (user) {
      const code = await issueVerificationCode({
        telegramId: user.telegramId,
        telegramUsername: user.telegramUsername,
        purpose: 'recover'
      });

      console.log('[auth:forgot-password] Recovery kod: ' + nickname + ' → ' + code);

      const tgEnabled = isTelegramEnabled();

      if (tgEnabled) {
        sendCodeViaTelegram(user.telegramId, code, 'recover');
      } else {
        console.log('[auth:forgot-password] [DEV] Telegram disabled. Kod: ' + code);
      }

      return send(res, 200, {
        success: true,
        data: {
          message: tgEnabled ? 'Recovery code sent via Telegram.' : 'Telegram disabled. Use debug code.',
          debugCode: tgEnabled ? undefined : code
        }
      });
    }

    send(res, 200, {
      success: true,
      data: { message: 'If the account exists, a recovery code was sent.' }
    });
  } catch (err) {
    console.error('[auth:forgot-password]', err.stack || err.message);
    send(res, 500, {
      success: false,
      message: 'Failed.',
      code: 'FORGOT_ERROR'
    });
  }
}

// ============================================================
// RESET PASSWORD
// ============================================================
async function resetPassword(req, res) {
  try {
    const body = await readBody(req);
    const nickname = sanitizeString(body.nickname, 20);
    const code = String(body.code || '');
    const newPassword = String(body.newPassword || '');

    if (newPassword.length < 8) {
      return send(res, 400, {
        success: false,
        message: 'Password must be at least 8 characters.',
        code: 'WEAK_PASSWORD'
      });
    }

    const user = findUserByNickname(nickname);
    if (!user) {
      return send(res, 400, {
        success: false,
        message: 'Invalid recovery request.',
        code: 'INVALID_RECOVERY'
      });
    }

    const ok = await consumeVerificationCode({
      telegramId: user.telegramId,
      purpose: 'recover',
      code
    });

    if (!ok) {
      return send(res, 400, {
        success: false,
        message: 'Recovery code is invalid or expired.',
        code: 'INVALID_CODE'
      });
    }

    await update(d => {
      const u = d.users.find(x => x.id === user.id);
      if (u) {
        u.passwordHash = hashPassword(newPassword);
        u.updatedAt = new Date().toISOString();
      }
      return d;
    });

    if (isTelegramEnabled()) {
      notifyUser(user.telegramId, '✅ Your AWebShop password was changed successfully.')
        .catch(function () {});
    }

    send(res, 200, {
      success: true,
      data: { message: 'Password updated.' }
    });
  } catch (err) {
    console.error('[auth:reset-password]', err.stack || err.message);
    send(res, 500, {
      success: false,
      message: 'Failed.',
      code: 'RESET_ERROR'
    });
  }
}

// ============================================================
// EXPORTS
// ============================================================
module.exports = {
  requestVerification,
  register,
  login,
  logout,
  me,
  forgotPassword,
  resetPassword
};