// backend/api/token.js
// AWC token balance, topup, transfer, withdraw, history, rate.
// Node.js v24 CommonJS uchun — top-level await YO'Q.

'use strict';

const { readData, update } = require('../utils/db');
const {
  getAwcUzsRate,
  getUsdRate,
  uzsToUsd,
  usdToUzs,
  awcToUzs,
  recordTransaction,
  adjustBalance
} = require('../services/tokenService');
const { uniqueId } = require('../utils/idGenerator');
const { now, sanitizeString } = require('../utils/helpers');
const { notifyAdmin } = require('../services/telegramService');

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

// ============================================================
// GET /api/token/balance
// ============================================================
function balance(req, res) {
  const data = readData();
  const user = data.users.find(u => u.id === req.user.userId);
  if (!user) {
    return send(res, 404, {
      success: false,
      message: 'User not found.',
      code: 'NOT_FOUND'
    });
  }
  const awcRate = getAwcUzsRate();
  const usdRate = getUsdRate();
  const balanceUZS = user.balanceAWC * awcRate;
  const balanceUSD = balanceUZS / usdRate;

  send(res, 200, {
    success: true,
    data: {
      balanceAWC: user.balanceAWC,
      awcPriceUZS: awcRate,
      balanceUZS: Math.round(balanceUZS),
      balanceUSD: +balanceUSD.toFixed(2),
      usdRate: usdRate
    }
  });
}

// ============================================================
// GET /api/token/rate
// ============================================================
function rate(req, res) {
  send(res, 200, {
    success: true,
    data: {
      awcPriceUZS: getAwcUzsRate(),
      usdRate: getUsdRate()
    }
  });
}

// ============================================================
// GET /api/token/history
// ============================================================
function history(req, res) {
  const data = readData();
  const items = data.transactions
    .filter(t => t.userId === req.user.userId)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  send(res, 200, { success: true, data: { items } });
}

// ============================================================
// POST /api/token/topup
// ============================================================
async function topup(req, res) {
  const body = await readBody(req);
  const amountUZS = Math.round(Number(body.amountUZS || 0));

  if (!amountUZS || amountUZS <= 0) {
    return send(res, 400, {
      success: false,
      message: 'Invalid amount.',
      code: 'INVALID_AMOUNT'
    });
  }

  const awcRate = getAwcUzsRate();
  const usdRate = getUsdRate();
  const amountAWC = +(amountUZS / awcRate).toFixed(4);
  const amountUSD = +(amountUZS / usdRate).toFixed(2);

  const data = readData();
  const method = data.paymentMethods.find(m => m.id === body.paymentMethodId)
              || data.paymentMethods[0];

  if (!method) {
    return send(res, 400, {
      success: false,
      message: 'No payment method configured.',
      code: 'NO_PAYMENT_METHOD'
    });
  }

  const tx = await recordTransaction(req.user.userId, 'topup_pending', {
    amountUZS,
    amountAWC,
    amountUSD,
    status: 'pending_manual_verification',
    paymentMethod: method.id,
    paymentDetailsReference: sanitizeString(body.reference || '', 200),
    description: 'Manual top-up awaiting admin verification'
  });

  // Admin'ga bildirishnoma (async, xatolik bersa ham davom etamiz)
  try {
    const user = readData().users.find(u => u.id === req.user.userId);
    if (user) {
      await notifyAdmin(
        `💳 <b>New top-up request</b>\n` +
        `User: ${user.nickname} (${user.id})\n` +
        `Amount: ${amountUZS} UZS = ${amountAWC} AWC\n` +
        `Tx: ${tx.id}\n` +
        `Reference: ${body.reference || '—'}`
      );
    }
  } catch (e) {
    console.warn('[topup:notifyAdmin]', e.message);
  }

  send(res, 201, {
    success: true,
    data: {
      transaction: tx,
      paymentMethod: method,
      instructions: 'Send payment to the card shown and wait for admin verification.'
    }
  });
}

// ============================================================
// POST /api/token/transfer
// ============================================================
async function transfer(req, res) {
  const body = await readBody(req);
  const toNickname = sanitizeString(body.toNickname, 20);
  const amount = Number(body.amountAWC || 0);

  if (!amount || amount <= 0) {
    return send(res, 400, {
      success: false,
      message: 'Invalid amount.',
      code: 'INVALID_AMOUNT'
    });
  }

  const data = readData();
  const from = data.users.find(u => u.id === req.user.userId);
  const to = data.users.find(u =>
    u.nickname.toLowerCase() === toNickname.toLowerCase() && !u.deleted
  );

  if (!from) {
    return send(res, 404, {
      success: false,
      message: 'Sender not found.',
      code: 'NOT_FOUND'
    });
  }
  if (!to) {
    return send(res, 404, {
      success: false,
      message: 'Recipient not found.',
      code: 'NOT_FOUND'
    });
  }
  if (from.id === to.id) {
    return send(res, 400, {
      success: false,
      message: 'Cannot transfer to yourself.',
      code: 'SELF_TRANSFER'
    });
  }
  if (from.balanceAWC < amount) {
    return send(res, 400, {
      success: false,
      message: 'Insufficient AWC balance.',
      code: 'INSUFFICIENT_BALANCE'
    });
  }

  await adjustBalance(from.id, -amount);
  await adjustBalance(to.id, amount);
  await recordTransaction(from.id, 'transfer_out', {
    amountAWC: amount,
    description: `Transfer to ${to.nickname}`
  });
  await recordTransaction(to.id, 'transfer_in', {
    amountAWC: amount,
    description: `Transfer from ${from.nickname}`
  });

  send(res, 200, {
    success: true,
    data: { message: 'Transfer completed.' }
  });
}

// ============================================================
// POST /api/token/withdraw
// ============================================================
async function withdraw(req, res) {
  const body = await readBody(req);
  const amountAWC = Number(body.amountAWC || 0);

  if (!amountAWC || amountAWC <= 0) {
    return send(res, 400, {
      success: false,
      message: 'Invalid amount.',
      code: 'INVALID_AMOUNT'
    });
  }

  const data = readData();
  const user = data.users.find(u => u.id === req.user.userId);
  if (!user) {
    return send(res, 404, {
      success: false,
      message: 'User not found.',
      code: 'NOT_FOUND'
    });
  }
  if (user.balanceAWC < amountAWC) {
    return send(res, 400, {
      success: false,
      message: 'Insufficient AWC.',
      code: 'INSUFFICIENT_BALANCE'
    });
  }

  const amountUZS = awcToUzs(amountAWC);
  let wd = null;

  await update(d => {
    wd = {
      id: uniqueId('wd', d.withdrawals.map(x => x.id)),
      userId: user.id,
      amountAWC,
      amountUZS,
      status: 'pending',
      cardNumber: sanitizeString(body.cardNumber || '', 32),
      adminNotes: '',
      createdAt: now(),
      updatedAt: now()
    };
    d.withdrawals.push(wd);
    return d;
  });

  // Admin'ga xabar
  try {
    await notifyAdmin(
      `💸 <b>Withdrawal request</b>\n` +
      `User: ${user.nickname} (${user.id})\n` +
      `Amount: ${amountAWC} AWC = ${amountUZS} UZS\n` +
      `WD ID: ${wd.id}`
    );
  } catch (e) {
    console.warn('[withdraw:notifyAdmin]', e.message);
  }

  send(res, 201, {
    success: true,
    data: { withdrawal: wd }
  });
}

// ============================================================
// EXPORTS
// ============================================================
module.exports = {
  balance,
  rate,
  history,
  topup,
  transfer,
  withdraw
};