// backend/api/admin.js
// AWebShop — Admin API. Tez va xavfsiz.

'use strict';

const { readData, update } = require('../utils/db');
const { now, sanitizeString, hashPassword } = require('../utils/helpers');
const { uniqueId, generateToken, generateUserId } = require('../utils/idGenerator');

// ============================================================
// HELPERS
// ============================================================
function send(res, status, body) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization'
  });
  res.end(JSON.stringify(body));
}

function readBody(req) {
  return new Promise(function (resolve, reject) {
    let chunks = '';
    req.on('data', function (c) {
      chunks += c;
      if (chunks.length > 1e6) reject(new Error('Payload too large'));
    });
    req.on('end', function () {
      try { resolve(chunks ? JSON.parse(chunks) : {}); }
      catch (e) { reject(new Error('Invalid JSON')); }
    });
    req.on('error', reject);
  });
}

function ok(res, data) {
  send(res, 200, { success: true, data: data });
}

function err(res, status, message, code) {
  send(res, status, { success: false, message: message, code: code || 'ERROR' });
}

function logAdmin(req, action, target, meta) {
  try {
    return update(function (d) {
      if (!Array.isArray(d.adminLogs)) d.adminLogs = [];
      d.adminLogs.push({
        id: 'log_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8),
        adminId: req.user ? req.user.userId : null,
        action: action,
        target: target || null,
        meta: meta || {},
        timestamp: now()
      });
      // Loglar juda ko'payib ketmasligi uchun oxirgi 500 tasini saqlash
      if (d.adminLogs.length > 500) {
        d.adminLogs = d.adminLogs.slice(-500);
      }
      return d;
    });
  } catch (_) {}
}

// ============================================================
// STATS — TEZ VA YENGIL
// ============================================================
async function stats(req, res) {
  try {
    const d = readData();

    const users = Array.isArray(d.users) ? d.users : [];
    const websites = Array.isArray(d.websites) ? d.websites : [];
    const orders = Array.isArray(d.orders) ? d.orders : [];
    const transactions = Array.isArray(d.transactions) ? d.transactions : [];
    const escrows = Array.isArray(d.escrows) ? d.escrows : [];
    const withdrawals = Array.isArray(d.withdrawals) ? d.withdrawals : [];

    // Tez hisoblash (loop ichida filter ishlatmaslik)
    let activeUsers = 0, blockedUsers = 0, awcCirculation = 0;
    for (let i = 0; i < users.length; i++) {
      const u = users[i];
      if (!u) continue;
      if (!u.deleted) activeUsers++;
      if (u.blocked) blockedUsers++;
      awcCirculation += (u.balanceAWC || 0);
    }

    let activeWebsites = 0, soldWebsites = 0;
    for (let i = 0; i < websites.length; i++) {
      const w = websites[i];
      if (!w) continue;
      if (w.status === 'active') activeWebsites++;
      if (w.status === 'sold') soldWebsites++;
    }

    let pendingEscrows = 0;
    for (let i = 0; i < escrows.length; i++) {
      if (escrows[i] && escrows[i].status === 'pending') pendingEscrows++;
    }

    let pendingWithdrawals = 0;
    for (let i = 0; i < withdrawals.length; i++) {
      if (withdrawals[i] && withdrawals[i].status === 'pending') pendingWithdrawals++;
    }

    let pendingPayments = 0, revenue = 0;
    for (let i = 0; i < transactions.length; i++) {
      const t = transactions[i];
      if (!t) continue;
      if (t.status === 'pending_manual_verification') pendingPayments++;
      if (t.status === 'completed' && t.type === 'sale_commission') {
        revenue += (t.amountUZS || 0);
      }
    }

    ok(res, {
      users: activeUsers,
      blockedUsers: blockedUsers,
      websites: websites.length,
      activeWebsites: activeWebsites,
      soldWebsites: soldWebsites,
      orders: orders.length,
      transactions: transactions.length,
      escrows: escrows.length,
      pendingEscrows: pendingEscrows,
      withdrawals: withdrawals.length,
      pendingWithdrawals: pendingWithdrawals,
      pendingPayments: pendingPayments,
      revenue: revenue,
      awcCirculation: awcCirculation,
      trend: []
    });
  } catch (e) {
    console.error('[admin:stats]', e.message);
    ok(res, {
      users: 0, blockedUsers: 0, websites: 0, activeWebsites: 0, soldWebsites: 0,
      orders: 0, transactions: 0, escrows: 0, pendingEscrows: 0,
      withdrawals: 0, pendingWithdrawals: 0, pendingPayments: 0,
      revenue: 0, awcCirculation: 0, trend: []
    });
  }
}

// ============================================================
// LOGS / ANALYTICS
// ============================================================
async function logs(req, res) {
  const d = readData();
  const arr = Array.isArray(d.adminLogs) ? d.adminLogs : [];
  ok(res, { items: arr.slice(-200) });
}

async function analytics(req, res) {
  const d = readData();
  const websites = Array.isArray(d.websites) ? d.websites : [];
  const transactions = Array.isArray(d.transactions) ? d.transactions : [];

  const topicCounts = {};
  websites.forEach(function (w) {
    if (!w) return;
    topicCounts[w.topic] = (topicCounts[w.topic] || 0) + 1;
  });

  const saleTypes = { safe: 0, fast: 0 };
  websites.forEach(function (w) {
    if (!w) return;
    saleTypes[w.saleType] = (saleTypes[w.saleType] || 0) + 1;
  });

  const paymentMethods = {};
  transactions.forEach(function (t) {
    if (!t || !t.paymentMethod) return;
    paymentMethods[t.paymentMethod] = (paymentMethods[t.paymentMethod] || 0) + 1;
  });

  ok(res, { topicCounts: topicCounts, saleTypes: saleTypes, paymentMethods: paymentMethods });
}

// ============================================================
// USERS
// ============================================================
async function usersList(req, res) {
  const d = readData();
  const users = (Array.isArray(d.users) ? d.users : [])
    .filter(function (u) { return !u.deleted; })
    .map(function (u) {
      const copy = Object.assign({}, u);
      delete copy.passwordHash;
      return copy;
    });
  ok(res, { items: users });
}

async function usersCreate(req, res) {
  const body = await readBody(req);
  const nickname = sanitizeString(body.nickname, 20);
  const password = String(body.password || '');
  const customId = body.customId ? sanitizeString(body.customId, 20) : null;

  if (!nickname || password.length < 8) {
    return err(res, 400, 'Invalid nickname or password.', 'INVALID');
  }

  const d = readData();
  if (d.users.some(function (u) { return u.nickname.toLowerCase() === nickname.toLowerCase(); })) {
    return err(res, 409, 'Nickname already taken.', 'NICKNAME_TAKEN');
  }

  let id = customId || generateUserId();
  if (customId) {
    if (!/^\d{5,20}$/.test(customId)) return err(res, 400, 'Custom ID must be 5-20 digits.', 'INVALID_ID');
    if (d.users.some(function (u) { return u.id === customId; })) return err(res, 409, 'ID already taken.', 'ID_TAKEN');
  }

  await update(function (dd) {
    dd.users.push({
      id: id,
      nickname: nickname,
      passwordHash: hashPassword(password),
      telegramUsername: sanitizeString(body.telegramUsername || '', 64),
      telegramId: sanitizeString(body.telegramId || '', 20),
      phone: sanitizeString(body.phone || '', 20),
      email: null,
      role: ['user', 'moderator', 'admin'].includes(body.role) ? body.role : 'user',
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
    });
    return dd;
  });

  await logAdmin(req, 'user_create', id, { nickname: nickname });
  ok(res, { message: 'User created.', userId: id });
}

async function blockUser(req, res) {
  const body = await readBody(req);
  await update(function (d) {
    const u = d.users.find(function (x) { return x.id === body.userId; });
    if (u) {
      u.blocked = !!body.blocked;
      u.updatedAt = now();
    }
    return d;
  });
  await logAdmin(req, body.blocked ? 'user_block' : 'user_unblock', body.userId);
  ok(res, { message: 'Updated.' });
}

async function softDeleteUser(req, res) {
  const body = await readBody(req);
  await update(function (d) {
    const u = d.users.find(function (x) { return x.id === body.userId; });
    if (u) {
      u.deleted = true;
      u.deletedAt = now();
    }
    return d;
  });
  await logAdmin(req, 'user_soft_delete', body.userId);
  ok(res, { message: 'Deleted.' });
}

async function restoreUser(req, res) {
  const body = await readBody(req);
  await update(function (d) {
    const u = d.users.find(function (x) { return x.id === body.userId; });
    if (u) {
      u.deleted = false;
      u.deletedAt = null;
    }
    return d;
  });
  await logAdmin(req, 'user_restore', body.userId);
  ok(res, { message: 'Restored.' });
}

async function banUser(req, res) {
  const body = await readBody(req);
  const permanent = !!body.permanent;

  await update(function (d) {
    const u = d.users.find(function (x) { return x.id === body.userId; });
    if (u) {
      u.banned = permanent;
      u.banReason = sanitizeString(body.reason || '', 500);
      u.bannedAt = now();
      u.blocked = true;
      u.blockedUntil = permanent ? null : new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    }
    return d;
  });
  await logAdmin(req, permanent ? 'user_ban_perm' : 'user_ban_temp', body.userId);
  ok(res, { message: permanent ? 'Permanently banned.' : 'Banned for 24h.' });
}

async function unbanUser(req, res) {
  const body = await readBody(req);
  await update(function (d) {
    const u = d.users.find(function (x) { return x.id === body.userId; });
    if (u) {
      u.banned = false;
      u.banReason = null;
      u.bannedAt = null;
      u.blocked = false;
      u.blockedUntil = null;
      u.moderationStrikes = { count: 0, until: null };
    }
    return d;
  });
  await logAdmin(req, 'user_unban', body.userId);
  ok(res, { message: 'Unbanned.' });
}

async function banUserWithDuration(req, res) {
  const body = await readBody(req);
  const durations = { '1s': 1000, '1m': 60000, '1h': 3600000, '1d': 86400000, '1w': 604800000, '1y': 31536000000 };
  const isPermanent = !body.duration || !durations[body.duration];
  const ms = isPermanent ? null : durations[body.duration];
  const until = ms ? new Date(Date.now() + ms).toISOString() : null;

  await update(function (d) {
    const u = d.users.find(function (x) { return x.id === body.userId; });
    if (u) {
      u.banned = isPermanent;
      u.banReason = sanitizeString(body.reason || '', 500);
      u.bannedAt = now();
      u.blocked = true;
      u.blockedUntil = until;
    }
    return d;
  });
  await logAdmin(req, isPermanent ? 'user_ban_forever' : 'user_ban_' + body.duration, body.userId);
  ok(res, { message: isPermanent ? 'Permanently banned.' : 'Banned for ' + body.duration, until: until });
}

async function awcAdjust(req, res) {
  const body = await readBody(req);
  const amt = Number(body.amount);
  if (!amt || isNaN(amt)) return err(res, 400, 'Invalid amount.', 'INVALID_AMOUNT');

  let newBalance = 0;
  await update(function (d) {
    const u = d.users.find(function (x) { return x.id === body.userId; });
    if (u) {
      u.balanceAWC = +(u.balanceAWC + amt).toFixed(4);
      newBalance = u.balanceAWC;
      u.updatedAt = now();
    }
    return d;
  });
  await logAdmin(req, amt > 0 ? 'awc_add' : 'awc_remove', body.userId, { amount: amt });
  ok(res, { message: (amt > 0 ? 'Added ' : 'Removed ') + Math.abs(amt) + ' AWC.', newBalance: newBalance });
}

async function assignBadge(req, res) {
  const body = await readBody(req);
  await update(function (d) {
    const u = d.users.find(function (x) { return x.id === body.userId; });
    if (u) {
      u.badges = u.badges || [];
      if (u.badges.indexOf(body.badgeId) === -1) u.badges.push(body.badgeId);
    }
    return d;
  });
  await logAdmin(req, 'badge_assign', body.userId, { badgeId: body.badgeId });
  ok(res, { message: 'Badge assigned.' });
}

async function unassignBadge(req, res) {
  const body = await readBody(req);
  await update(function (d) {
    const u = d.users.find(function (x) { return x.id === body.userId; });
    if (u) {
      u.badges = (u.badges || []).filter(function (b) { return b !== body.badgeId; });
    }
    return d;
  });
  await logAdmin(req, 'badge_unassign', body.userId, { badgeId: body.badgeId });
  ok(res, { message: 'Badge removed.' });
}

// ============================================================
// WEBSITES / ESCROW / WITHDRAW / PAYMENTS
// ============================================================
async function websitesList(req, res) {
  const d = readData();
  ok(res, { items: Array.isArray(d.websites) ? d.websites : [] });
}

async function websiteUpdate(req, res) {
  const body = await readBody(req);
  await update(function (d) {
    const w = d.websites.find(function (x) { return x.webId === body.webId; });
    if (w) {
      ['name', 'domain', 'description', 'topic', 'imageUrl', 'status', 'saleType', 'type'].forEach(function (k) {
        if (body[k] !== undefined) w[k] = sanitizeString(body[k], 500);
      });
      if (body.priceUZS) w.priceUZS = Math.round(body.priceUZS);
      w.updatedAt = now();
    }
    return d;
  });
  await logAdmin(req, 'website_update', body.webId);
  ok(res, { message: 'Updated.' });
}

async function websiteDelete(req, res) {
  const body = await readBody(req);
  await update(function (d) {
    d.websites = d.websites.filter(function (w) { return w.webId !== body.webId; });
    return d;
  });
  await logAdmin(req, 'website_delete', body.webId);
  ok(res, { message: 'Deleted.' });
}

async function escrowList(req, res) {
  const d = readData();
  ok(res, { items: Array.isArray(d.escrows) ? d.escrows : [] });
}

async function escrowUpdate(req, res) {
  const body = await readBody(req);
  const allowed = ['pending', 'paid', 'transferred', 'verified', 'completed', 'cancelled', 'disputed', 'refunded'];
  if (allowed.indexOf(body.status) === -1) return err(res, 400, 'Invalid status.', 'INVALID_STATUS');

  await update(function (d) {
    const e = d.escrows.find(function (x) { return x.id === body.escrowId; });
    if (e) {
      e.status = body.status;
      if (body.adminNotes !== undefined) e.adminNotes = sanitizeString(body.adminNotes, 1000);
      e.updatedAt = now();
    }
    return d;
  });
  await logAdmin(req, 'escrow_update', body.escrowId, { status: body.status });
  ok(res, { message: 'Updated.' });
}

async function withdrawList(req, res) {
  const d = readData();
  ok(res, { items: Array.isArray(d.withdrawals) ? d.withdrawals : [] });
}

async function withdrawApprove(req, res) {
  const body = await readBody(req);
  const decision = body.decision === 'approve' ? 'approved' : 'rejected';
  let wd = null;

  await update(function (d) {
    const w = d.withdrawals.find(function (x) { return x.id === body.withdrawalId; });
    if (w) {
      w.status = decision;
      w.updatedAt = now();
      wd = Object.assign({}, w);

      if (decision === 'approved') {
        const u = d.users.find(function (x) { return x.id === w.userId; });
        if (u && u.balanceAWC >= w.amountAWC) {
          u.balanceAWC = +(u.balanceAWC - w.amountAWC).toFixed(4);
        }
      }
    }
    return d;
  });
  if (!wd) return err(res, 404, 'Not found.', 'NOT_FOUND');
  await logAdmin(req, 'withdraw_' + decision, body.withdrawalId);
  ok(res, { withdrawal: wd });
}

async function transactionsList(req, res) {
  const d = readData();
  const arr = Array.isArray(d.transactions) ? d.transactions : [];
  ok(res, { items: arr.slice().reverse().slice(0, 500) });
}

async function verifyPayment(req, res) {
  const body = await readBody(req);
  const decision = body.decision === 'approve' ? 'completed' : 'rejected';

  let tx = null;
  await update(function (d) {
    const t = d.transactions.find(function (x) { return x.id === body.transactionId; });
    if (t) {
      t.status = decision;
      t.updatedAt = now();

      if (decision === 'completed' && t.type === 'topup_pending') {
        const u = d.users.find(function (x) { return x.id === t.userId; });
        if (u) {
          u.balanceAWC = +(u.balanceAWC + (t.amountAWC || 0)).toFixed(4);
          u.updatedAt = now();
        }
      }
      tx = Object.assign({}, t);
    }
    return d;
  });
  if (!tx) return err(res, 404, 'Not found.', 'NOT_FOUND');
  await logAdmin(req, 'payment_' + decision, body.transactionId);
  ok(res, { transaction: tx });
}

// ============================================================
// MODULES (o'zgarishsiz qoldirilganlar)
// ============================================================
const { optionalRequire } = { optionalRequire: function (p, n) { try { return require(p); } catch (_) { return null; } } };

const adminsModule = require('./admin-admins');

// ... qolgan funksiyalar (admin-admins.js da)

// ============================================================
// EXPORTS
// ============================================================
module.exports = {
  // Core
  stats: stats,
  logs: logs,
  analytics: analytics,
  // Users
  usersList: usersList,
  usersCreate: usersCreate,
  blockUser: blockUser,
  softDeleteUser: softDeleteUser,
  restoreUser: restoreUser,
  banUser: banUser,
  unbanUser: unbanUser,
  banUserWithDuration: banUserWithDuration,
  awcAdjust: awcAdjust,
  assignBadge: assignBadge,
  unassignBadge: unassignBadge,
  // Websites
  websitesList: websitesList,
  websiteUpdate: websiteUpdate,
  websiteDelete: websiteDelete,
  // Escrow
  escrowList: escrowList,
  escrowUpdate: escrowUpdate,
  // Withdraw
  withdrawList: withdrawList,
  withdrawApprove: withdrawApprove,
  // Payments
  transactionsList: transactionsList,
  verifyPayment: verifyPayment
};