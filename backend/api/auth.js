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

function send(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
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
      try {
        resolve(chunks ? JSON.parse(chunks) : {});
      } catch {
        reject(new Error('Invalid JSON'));
      }
    });
    req.on('error', reject);
  });
}

async function requestVerification(req, res) {
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

  // Telegram ID allaqachon ro'yxatdan o'tganmi?
  const data = readData();
  if (data.users.some(u => u.telegramId === telegramId && !u.deleted)) {
    return send(res, 409, {
      success: false,
      message: 'This Telegram ID is already registered.',
      code: 'TELEGRAM_IN_USE'
    });
  }

  const code = await issueVerificationCode({
    telegramId,
    telegramUsername,
    purpose: 'register'
  });

  await notifyUser(
    telegramId,
    `🔐 AWebShop verification code: ${code}\n\nThis code expires in 10 minutes.`
  );

  // Telegram yoqilmagan bo'lsa, dev rejimida kodni qaytaramiz.
  const includeDebug = !require('../../config').telegram.enabled;
  return send(res, 200, {
    success: true,
    data: {
      message: 'Verification code sent via Telegram.',
      ...(includeDebug ? { debugCode: code } : {})
    }
  });
}

async function register(req, res) {
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

  const existing = readData();
  if (existing.users.some(u => u.nickname.toLowerCase() === nickname.toLowerCase() && !u.deleted)) {
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
    telegramUsername: sanitizeString(body.telegramUsername, 64),
    telegramId,
    phone: sanitizeString(body.phone, 20)
  });

  const user = findUserByNickname(nickname);
  const token = createSession(user.id, 'user');

  send(res, 201, {
    success: true,
    data: {
      token,
      user: publicUser(user)
    }
  });
}

async function login(req, res) {
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
  if (user.blocked) {
    return send(res, 403, {
      success: false,
      message: 'Account is blocked. Contact support.',
      code: 'ACCOUNT_BLOCKED'
    });
  }
  if (!verifyPassword(password, user.passwordHash)) {
    return send(res, 401, {
      success: false,
      message: 'Invalid credentials.',
      code: 'INVALID_CREDENTIALS'
    });
  }

  const token = createSession(user.id, user.role || 'user');
  await notifyUser(user.telegramId, `🔔 AWebShop: New login to your account.\nNickname: ${user.nickname}\nTime: ${new Date().toISOString()}`);

  send(res, 200, {
    success: true,
    data: {
      token,
      user: publicUser(user)
    }
  });
}

async function logout(req, res) {
  const { readToken } = require('../middleware/auth');
  const token = readToken(req);
  if (token) destroySession(token);
  send(res, 200, { success: true, data: { message: 'Logged out.' } });
}

function me(req, res) {
  const user = findUserById(req.user.userId);
  if (!user) {
    return send(res, 404, {
      success: false,
      message: 'User not found.',
      code: 'NOT_FOUND'
    });
  }
  send(res, 200, { success: true, data: { user: publicUser(user) } });
}

function publicUser(u) {
  const { passwordHash, ...rest } = u;
  return rest;
}

async function forgotPassword(req, res) {
  const body = await readBody(req);
  const nickname = sanitizeString(body.nickname, 20);
  const user = findUserByNickname(nickname);
  if (user) {
    const code = await issueVerificationCode({
      telegramId: user.telegramId,
      telegramUsername: user.telegramUsername,
      purpose: 'recover'
    });
    await notifyUser(
      user.telegramId,
      `🔐 AWebShop recovery code: ${code}\n\nThis code expires in 10 minutes.`
    );
    const includeDebug = !require('../../config').telegram.enabled;
    return send(res, 200, {
      success: true,
      data: {
        message: 'Recovery code sent via Telegram.',
        ...(includeDebug ? { debugCode: code } : {})
      }
    });
  }
  // Xavfsizlik uchun bir xil javob
  send(res, 200, { success: true, data: { message: 'If the account exists, a recovery code was sent.' } });
}

async function resetPassword(req, res) {
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

  await update(data => {
    const u = data.users.find(x => x.id === user.id);
    if (u) {
      u.passwordHash = hashPassword(newPassword);
      u.updatedAt = new Date().toISOString();
    }
    return data;
  });

  await notifyUser(user.telegramId, '✅ Your AWebShop password was changed successfully.');
  send(res, 200, { success: true, data: { message: 'Password updated.' } });
}

module.exports = {
  requestVerification,
  register,
  login,
  logout,
  me,
  forgotPassword,
  resetPassword
};