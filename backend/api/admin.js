// backend/api/admin.js
// AWebShop — Admin API: stats, users, websites, escrow, withdraw, payments,
// promocodes, discounts, events, reviews, badges, etc.

'use strict';

const { readData, update } = require('../utils/db');
const { now, sanitizeString, hashPassword } = require('../utils/helpers');
const { uniqueId, generateToken, generateUserId } = require('../utils/idGenerator');
const { recordTransaction } = require('../services/tokenService');
const { notifyUser, notifyAdmin } = require('../services/telegramService');

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

function ok(res, data) {
  send(res, 200, { success: true, data: data });
}

function err(res, status, message, code) {
  send(res, status, { success: false, message: message, code: code || 'ERROR' });
}

function logAdmin(req, action, target, meta) {
  return update(d => {
    if (!Array.isArray(d.adminLogs)) d.adminLogs = [];
    d.adminLogs.push({
      id: 'log_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8),
      adminId: req.user.userId,
      action: action,
      target: target || null,
      meta: meta || {},
      timestamp: now()
    });
    return d;
  });
}

// ============================================================
// STATS
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

    // 14 kunlik trend
    const trend = [];
    for (let i = 13; i >= 0; i--) {
      const day = new Date();
      day.setDate(day.getDate() - i);
      const iso = day.toISOString().slice(0, 10);
      trend.push({
        date: iso,
        users: users.filter(u => u && (u.createdAt || '').slice(0, 10) === iso).length,
        websites: websites.filter(w => w && (w.createdAt || '').slice(0, 10) === iso).length,
        orders: orders.filter(o => o && (o.createdAt || '').slice(0, 10) === iso).length,
        revenue: transactions
          .filter(t => t && t.status === 'completed' && (t.createdAt || '').slice(0, 10) === iso)
          .reduce((s, t) => s + (t.amountUZS || 0), 0)
      });
    }

    ok(res, {
      users: users.filter(u => u && !u.deleted).length,
      blockedUsers: users.filter(u => u && u.blocked).length,
      websites: websites.length,
      activeWebsites: websites.filter(w => w && w.status === 'active').length,
      soldWebsites: websites.filter(w => w && w.status === 'sold').length,
      orders: orders.length,
      transactions: transactions.length,
      escrows: escrows.length,
      pendingEscrows: escrows.filter(e => e && e.status === 'pending').length,
      withdrawals: withdrawals.length,
      pendingWithdrawals: withdrawals.filter(w => w && w.status === 'pending').length,
      pendingPayments: transactions.filter(t => t && t.status === 'pending_manual_verification').length,
      revenue: transactions
        .filter(t => t && t.status === 'completed' && t.type === 'sale_commission')
        .reduce((s, t) => s + (t.amountUZS || 0), 0),
      awcCirculation: users.reduce((s, u) => s + (u.balanceAWC || 0), 0),
      trend: trend
    });
  } catch (e) {
    console.error('[admin:stats]', e.stack || e.message);
    ok(res, {
      users: 0, blockedUsers: 0,
      websites: 0, activeWebsites: 0, soldWebsites: 0,
      orders: 0, transactions: 0,
      escrows: 0, pendingEscrows: 0,
      withdrawals: 0, pendingWithdrawals: 0,
      pendingPayments: 0,
      revenue: 0, awcCirculation: 0,
      trend: [],
      error: e.message
    });
  }
}

// ============================================================
// LOGS
// ============================================================
async function logs(req, res) {
  try {
    const d = readData();
    const items = (d.adminLogs || []).slice(-500);
    ok(res, { items: items });
  } catch (e) {
    err(res, 500, e.message, 'LOGS_ERROR');
  }
}

// ============================================================
// ANALYTICS
// ============================================================
async function analytics(req, res) {
  try {
    const d = readData();

    const topicCounts = {};
    (d.websites || []).forEach(w => {
      if (w && w.topic) topicCounts[w.topic] = (topicCounts[w.topic] || 0) + 1;
    });

    const saleTypes = { safe: 0, fast: 0 };
    (d.websites || []).forEach(w => {
      if (w && w.saleType) saleTypes[w.saleType] = (saleTypes[w.saleType] || 0) + 1;
    });

    const paymentMethods = {};
    (d.transactions || []).forEach(t => {
      if (!t || !t.paymentMethod) return;
      paymentMethods[t.paymentMethod] = (paymentMethods[t.paymentMethod] || 0) + 1;
    });

    ok(res, {
      topicCounts: topicCounts,
      saleTypes: saleTypes,
      paymentMethods: paymentMethods
    });
  } catch (e) {
    err(res, 500, e.message, 'ANALYTICS_ERROR');
  }
}

// ============================================================
// USERS
// ============================================================
async function usersList(req, res) {
  try {
    const d = readData();
    const items = (d.users || [])
      .filter(u => u && !u.deleted)
      .map(u => {
        const { passwordHash, ...rest } = u;
        return rest;
      });
    ok(res, { items: items });
  } catch (e) {
    err(res, 500, e.message, 'USERS_LIST_ERROR');
  }
}

async function usersCreate(req, res) {
  try {
    const body = await readBody(req);
    const nickname = sanitizeString(body.nickname, 20);
    const password = String(body.password || '');
    const customId = body.customId ? sanitizeString(body.customId, 20) : null;

    if (!nickname || password.length < 8) {
      return err(res, 400, 'Invalid nickname or password.', 'INVALID');
    }

    const d = readData();
    if (d.users.some(u => u.nickname && u.nickname.toLowerCase() === nickname.toLowerCase())) {
      return err(res, 409, 'Nickname already taken.', 'NICKNAME_TAKEN');
    }

    let id = customId || generateUserId();
    if (customId) {
      if (!/^\d{5,20}$/.test(customId)) {
        return err(res, 400, 'Custom ID must be 5-20 digits.', 'INVALID_ID');
      }
      if (d.users.some(u => u.id === customId)) {
        return err(res, 409, 'ID already taken.', 'ID_TAKEN');
      }
    }

    await update(dd => {
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
  } catch (e) {
    err(res, 500, e.message, 'CREATE_USER_ERROR');
  }
}

async function blockUser(req, res) {
  try {
    const body = await readBody(req);
    const userId = body.userId;
    const blocked = !!body.blocked;

    await update(d => {
      const u = d.users.find(x => x.id === userId);
      if (u) { u.blocked = blocked; u.updatedAt = now(); }
      return d;
    });

    await logAdmin(req, blocked ? 'user_block' : 'user_unblock', userId);
    ok(res, { message: 'Updated.' });
  } catch (e) {
    err(res, 500, e.message, 'BLOCK_ERROR');
  }
}

async function softDeleteUser(req, res) {
  try {
    const body = await readBody(req);
    await update(d => {
      const u = d.users.find(x => x.id === body.userId);
      if (u) { u.deleted = true; u.deletedAt = now(); }
      return d;
    });
    await logAdmin(req, 'user_soft_delete', body.userId);
    ok(res, { message: 'Deleted.' });
  } catch (e) {
    err(res, 500, e.message, 'DELETE_ERROR');
  }
}

async function restoreUser(req, res) {
  try {
    const body = await readBody(req);
    await update(d => {
      const u = d.users.find(x => x.id === body.userId);
      if (u) { u.deleted = false; u.deletedAt = null; }
      return d;
    });
    await logAdmin(req, 'user_restore', body.userId);
    ok(res, { message: 'Restored.' });
  } catch (e) {
    err(res, 500, e.message, 'RESTORE_ERROR');
  }
}

async function assignBadge(req, res) {
  try {
    const body = await readBody(req);
    await update(d => {
      const u = d.users.find(x => x.id === body.userId);
      if (u) {
        u.badges = u.badges || [];
        if (!u.badges.includes(body.badgeId)) u.badges.push(body.badgeId);
      }
      return d;
    });
    await logAdmin(req, 'user_badge_assign', body.userId, { badgeId: body.badgeId });
    ok(res, { message: 'Badge assigned.' });
  } catch (e) {
    err(res, 500, e.message, 'BADGE_ERROR');
  }
}

async function unassignBadge(req, res) {
  try {
    const body = await readBody(req);
    await update(d => {
      const u = d.users.find(x => x.id === body.userId);
      if (u) u.badges = (u.badges || []).filter(b => b !== body.badgeId);
      return d;
    });
    await logAdmin(req, 'user_badge_unassign', body.userId, { badgeId: body.badgeId });
    ok(res, { message: 'Badge removed.' });
  } catch (e) {
    err(res, 500, e.message, 'BADGE_ERROR');
  }
}

async function banUser(req, res) {
  try {
    const body = await readBody(req);
    const userId = body.userId;
    const reason = sanitizeString(body.reason || '', 500);
    const permanent = !!body.permanent;

    let user = null;
    await update(d => {
      const u = d.users.find(x => x.id === userId);
      if (u) {
        u.banned = permanent;
        u.banReason = reason;
        u.bannedAt = now();
        u.blocked = true;
        u.blockedUntil = permanent ? null : new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
        user = { ...u };
      }
      return d;
    });

    if (!user) return err(res, 404, 'User not found.', 'NOT_FOUND');

    await logAdmin(req, permanent ? 'user_ban_permanent' : 'user_ban_temp', userId, { reason: reason });

    try {
      if (user.telegramId) {
        await notifyUser(user.telegramId,
          permanent
            ? '🚫 Your account has been permanently banned.\nReason: ' + (reason || 'N/A')
            : '🚫 You have been blocked for 24 hours.\nReason: ' + (reason || 'N/A')
        );
      }
    } catch (_) {}

    ok(res, {
      message: permanent ? 'User permanently banned.' : 'User banned for 24 hours.',
      user: user
    });
  } catch (e) {
    err(res, 500, e.message, 'BAN_ERROR');
  }
}

async function unbanUser(req, res) {
  try {
    const body = await readBody(req);
    const userId = body.userId;
    if (!userId) return err(res, 400, 'userId required.', 'MISSING_USER_ID');

    await update(d => {
      const u = d.users.find(x => x.id === userId);
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

    await logAdmin(req, 'user_unban', userId);
    ok(res, { message: 'User unbanned.' });
  } catch (e) {
    err(res, 500, e.message, 'UNBAN_ERROR');
  }
}

async function banUserWithDuration(req, res) {
  try {
    const body = await readBody(req);
    const userId = body.userId;
    const duration = body.duration;
    const reason = sanitizeString(body.reason || '', 500);

    if (!userId) return err(res, 400, 'userId required.', 'MISSING_USER_ID');

    const durations = {
      '1s': 1000,
      '1m': 60 * 1000,
      '1h': 60 * 60 * 1000,
      '1d': 24 * 60 * 60 * 1000,
      '1w': 7 * 24 * 60 * 60 * 1000,
      '1y': 365 * 24 * 60 * 60 * 1000
    };

    const isPermanent = !duration || !durations[duration];
    const ms = isPermanent ? null : durations[duration];
    const until = ms ? new Date(Date.now() + ms).toISOString() : null;

    let user = null;
    await update(d => {
      const u = d.users.find(x => x.id === userId);
      if (u) {
        u.banned = isPermanent;
        u.banReason = reason;
        u.bannedAt = now();
        u.blocked = true;
        u.blockedUntil = until;
        user = { ...u };
      }
      return d;
    });

    if (!user) return err(res, 404, 'User not found.', 'NOT_FOUND');

    await logAdmin(req, isPermanent ? 'user_ban_forever' : 'user_ban_' + duration, userId, { reason: reason });

    try {
      if (user.telegramId) {
        await notifyUser(user.telegramId,
          isPermanent
            ? '🚫 Your account has been permanently banned.\nReason: ' + (reason || 'N/A')
            : '🚫 You have been blocked until ' + new Date(until).toLocaleString() + '.\nReason: ' + (reason || 'N/A')
        );
      }
    } catch (_) {}

    ok(res, {
      message: isPermanent ? 'Permanently banned.' : 'Banned for ' + duration + '.',
      until: until,
      user: user
    });
  } catch (e) {
    err(res, 500, e.message, 'BAN_DURATION_ERROR');
  }
}

async function awcAdjust(req, res) {
  try {
    const body = await readBody(req);
    const userId = body.userId;
    const amount = Number(body.amount);
    const reason = sanitizeString(body.reason || '', 200);

    if (!userId) return err(res, 400, 'userId required.', 'MISSING_USER_ID');
    if (!amount || isNaN(amount)) return err(res, 400, 'Invalid amount.', 'INVALID_AMOUNT');

    const d1 = readData();
    const user = d1.users.find(u => u.id === userId);
    if (!user) return err(res, 404, 'User not found.', 'NOT_FOUND');

    const newBalance = +(user.balanceAWC + amount).toFixed(4);
    if (newBalance < 0) {
      return err(res, 400, 'Insufficient balance. Current: ' + user.balanceAWC + ' AWC', 'INSUFFICIENT_BALANCE');
    }

    await update(d => {
      const u = d.users.find(x => x.id === userId);
      if (u) {
        u.balanceAWC = newBalance;
        u.updatedAt = now();
      }
      return d;
    });

    try {
      await recordTransaction(userId, amount > 0 ? 'admin_credit' : 'admin_debit', {
        amountAWC: amount,
        description: reason || ('Admin ' + (amount > 0 ? 'credit' : 'debit'))
      });
    } catch (_) {}

    await logAdmin(req, amount > 0 ? 'awc_add' : 'awc_remove', userId, { amount: amount, reason: reason });
    ok(res, {
      message: (amount > 0 ? 'Added' : 'Removed') + ' ' + Math.abs(amount) + ' AWC.',
      newBalance: newBalance
    });
  } catch (e) {
    err(res, 500, e.message, 'AWC_ERROR');
  }
}

// ============================================================
// ADMINS
// ============================================================
async function adminsList(req, res) {
  try {
    const d = readData();
    ok(res, { items: d.admins || [] });
  } catch (e) {
    err(res, 500, e.message, 'ADMINS_LIST_ERROR');
  }
}

async function adminsCreate(req, res) {
  try {
    const body = await readBody(req);
    const userId = sanitizeString(body.userId, 20);
    const role = ['super_admin', 'admin', 'moderator'].includes(body.role) ? body.role : 'moderator';
    const d = readData();
    const user = d.users.find(u => u.id === userId);
    if (!user) return err(res, 404, 'User not found.', 'NOT_FOUND');
    if (d.admins.some(a => a.userId === userId)) return err(res, 409, 'Already an admin.', 'ALREADY_ADMIN');

    await update(dd => {
      dd.admins.push({
        id: uniqueId('adm', (dd.admins || []).map(a => a.id)),
        userId: userId,
        role: role,
        permissions: body.permissions || {},
        disabled: false,
        code: generateToken(6),
        createdAt: now()
      });
      const u = dd.users.find(x => x.id === userId);
      if (u) u.role = role;
      return dd;
    });

    await logAdmin(req, 'admin_create', userId, { role: role });
    ok(res, { message: 'Admin added.' });
  } catch (e) {
    err(res, 500, e.message, 'ADMIN_CREATE_ERROR');
  }
}

async function adminsUpdate(req, res) {
  try {
    const body = await readBody(req);
    await update(d => {
      const a = d.admins.find(x => x.id === body.id);
      if (a) {
        if (body.role) a.role = body.role;
        if (typeof body.disabled === 'boolean') a.disabled = body.disabled;
        if (body.permissions) a.permissions = body.permissions;
        a.updatedAt = now();
      }
      return d;
    });
    await logAdmin(req, 'admin_update', body.id);
    ok(res, { message: 'Updated.' });
  } catch (e) {
    err(res, 500, e.message, 'ADMIN_UPDATE_ERROR');
  }
}

async function adminsDelete(req, res) {
  try {
    const body = await readBody(req);
    await update(d => {
      d.admins = d.admins.filter(a => a.id !== body.id);
      return d;
    });
    await logAdmin(req, 'admin_delete', body.id);
    ok(res, { message: 'Deleted.' });
  } catch (e) {
    err(res, 500, e.message, 'ADMIN_DELETE_ERROR');
  }
}

// ============================================================
// WEBSITES
// ============================================================
async function websitesList(req, res) {
  try {
    const d = readData();
    ok(res, { items: d.websites || [] });
  } catch (e) {
    err(res, 500, e.message, 'WEBSITES_LIST_ERROR');
  }
}

async function websiteUpdate(req, res) {
  try {
    const body = await readBody(req);
    await update(d => {
      const w = d.websites.find(x => x.webId === body.webId);
      if (w) {
        ['name', 'domain', 'description', 'topic', 'imageUrl', 'status', 'saleType', 'type'].forEach(k => {
          if (body[k] !== undefined) w[k] = sanitizeString(body[k], 500);
        });
        if (body.priceUZS) w.priceUZS = Math.round(body.priceUZS);
        w.updatedAt = now();
      }
      return d;
    });
    await logAdmin(req, 'website_update', body.webId);
    ok(res, { message: 'Updated.' });
  } catch (e) {
    err(res, 500, e.message, 'WEBSITE_UPDATE_ERROR');
  }
}

async function websiteDelete(req, res) {
  try {
    const body = await readBody(req);
    await update(d => {
      d.websites = d.websites.filter(w => w.webId !== body.webId);
      return d;
    });
    await logAdmin(req, 'website_delete', body.webId);
    ok(res, { message: 'Deleted.' });
  } catch (e) {
    err(res, 500, e.message, 'WEBSITE_DELETE_ERROR');
  }
}

// ============================================================
// ESCROW
// ============================================================
async function escrowList(req, res) {
  try {
    const d = readData();
    ok(res, { items: d.escrows || [] });
  } catch (e) {
    err(res, 500, e.message, 'ESCROW_LIST_ERROR');
  }
}

async function escrowUpdate(req, res) {
  try {
    const body = await readBody(req);
    const allowed = ['pending', 'paid', 'transferred', 'verified', 'completed', 'cancelled', 'disputed', 'refunded'];
    if (!allowed.includes(body.status)) return err(res, 400, 'Invalid status.', 'INVALID_STATUS');

    let escrow = null;
    await update(d => {
      const e = d.escrows.find(x => x.id === body.escrowId);
      if (e) {
        e.status = body.status;
        if (body.adminNotes !== undefined) e.adminNotes = sanitizeString(body.adminNotes, 1000);
        e.updatedAt = now();
        escrow = { ...e };
      }
      return d;
    });
    if (!escrow) return err(res, 404, 'Not found.', 'NOT_FOUND');

    const d = readData();
    const buyer = d.users.find(u => u.id === escrow.buyerId);
    const seller = d.users.find(u => u.id === escrow.sellerId);
    if (buyer) await notifyUser(buyer.telegramId, '🔐 Escrow ' + escrow.id + ' status: ' + escrow.status);
    if (seller) await notifyUser(seller.telegramId, '🔐 Escrow ' + escrow.id + ' status: ' + escrow.status);

    await logAdmin(req, 'escrow_update', body.escrowId, { status: body.status });
    ok(res, { escrow: escrow });
  } catch (e) {
    err(res, 500, e.message, 'ESCROW_UPDATE_ERROR');
  }
}

// ============================================================
// WITHDRAWALS
// ============================================================
async function withdrawList(req, res) {
  try {
    const d = readData();
    ok(res, { items: d.withdrawals || [] });
  } catch (e) {
    err(res, 500, e.message, 'WITHDRAW_LIST_ERROR');
  }
}

async function withdrawApprove(req, res) {
  try {
    const body = await readBody(req);
    const withdrawalId = body.withdrawalId;
    const decision = body.decision;

    let wd = null;
    await update(d => {
      const w = d.withdrawals.find(x => x.id === withdrawalId);
      if (w) {
        w.status = decision === 'approve' ? 'approved' : 'rejected';
        w.updatedAt = now();
        wd = { ...w };
      }
      return d;
    });
    if (!wd) return err(res, 404, 'Not found.', 'NOT_FOUND');

    if (decision === 'approve') {
      await update(d => {
        const u = d.users.find(x => x.id === wd.userId);
        if (u && u.balanceAWC >= wd.amountAWC) {
          u.balanceAWC = +(u.balanceAWC - wd.amountAWC).toFixed(4);
        }
        return d;
      });
      try {
        await recordTransaction(wd.userId, 'withdraw_approved', {
          amountAWC: -wd.amountAWC,
          amountUZS: -wd.amountUZS,
          description: 'Withdrawal approved'
        });
      } catch (_) {}
    } else {
      try {
        await recordTransaction(wd.userId, 'withdraw_rejected', {
          amountAWC: wd.amountAWC,
          amountUZS: wd.amountUZS,
          description: 'Withdrawal rejected'
        });
      } catch (_) {}
    }

    const u2 = readData().users.find(u => u.id === wd.userId);
    if (u2) await notifyUser(u2.telegramId, '💰 Withdrawal ' + decision + 'd: ' + wd.amountAWC + ' AWC');

    await logAdmin(req, 'withdraw_' + decision, withdrawalId);
    ok(res, { withdrawal: wd });
  } catch (e) {
    err(res, 500, e.message, 'WITHDRAW_ERROR');
  }
}

// ============================================================
// PAYMENTS / TRANSACTIONS
// ============================================================
async function transactionsList(req, res) {
  try {
    const d = readData();
    ok(res, { items: (d.transactions || []).slice().reverse() });
  } catch (e) {
    err(res, 500, e.message, 'TX_LIST_ERROR');
  }
}

async function verifyPayment(req, res) {
  try {
    const body = await readBody(req);
    const transactionId = body.transactionId;
    const decision = body.decision;
    const adminNotes = body.adminNotes || '';

    let tx = null;
    await update(d => {
      const t = d.transactions.find(x => x.id === transactionId);
      if (t) {
        if (decision === 'approve') {
          t.status = 'completed';
          const u = d.users.find(x => x.id === t.userId);
          if (u && t.type === 'topup_pending') {
            u.balanceAWC = +(u.balanceAWC + (t.amountAWC || 0)).toFixed(4);
            u.updatedAt = now();
          }
        } else {
          t.status = 'rejected';
        }
        if (adminNotes) t.adminNotes = sanitizeString(adminNotes, 1000);
        t.updatedAt = now();
        tx = { ...t };
      }
      return d;
    });
    if (!tx) return err(res, 404, 'Not found.', 'NOT_FOUND');

    const u = readData().users.find(x => x.id === tx.userId);
    if (u) await notifyUser(u.telegramId, '💳 Payment ' + decision + 'd: ' + tx.amountUZS + ' UZS');

    await logAdmin(req, 'payment_' + decision, transactionId);
    ok(res, { transaction: tx });
  } catch (e) {
    err(res, 500, e.message, 'PAYMENT_ERROR');
  }
}

// ============================================================
// PROMOCODES
// ============================================================
async function promocodesList(req, res) {
  try {
    ok(res, { items: readData().promocodes || [] });
  } catch (e) {
    err(res, 500, e.message, 'PROMO_LIST_ERROR');
  }
}

async function promocodesCreate(req, res) {
  try {
    const body = await readBody(req);
    const code = sanitizeString(body.code, 32).toUpperCase();
    if (!code) return err(res, 400, 'Code required.', 'INVALID');

    const d = readData();
    if ((d.promocodes || []).some(p => p.code === code)) return err(res, 409, 'Code exists.', 'DUPLICATE');

    await update(dd => {
      dd.promocodes = dd.promocodes || [];
      dd.promocodes.push({
        id: uniqueId('promo', dd.promocodes.map(p => p.id)),
        code: code,
        type: body.type === 'fixed' ? 'fixed' : 'percent',
        value: Number(body.value) || 0,
        maxUses: Number(body.maxUses) || 0,
        usedCount: 0,
        usedBy: [],
        expiresAt: body.expiresAt || null,
        enabled: body.enabled !== false,
        createdAt: now()
      });
      return dd;
    });
    await logAdmin(req, 'promocode_create', code);
    ok(res, { message: 'Created.' });
  } catch (e) {
    err(res, 500, e.message, 'PROMO_CREATE_ERROR');
  }
}

async function promocodesUpdate(req, res) {
  try {
    const body = await readBody(req);
    await update(d => {
      const p = d.promocodes.find(x => x.id === body.id);
      if (p) {
        ['code', 'type', 'value', 'maxUses', 'expiresAt', 'enabled'].forEach(k => {
          if (body[k] !== undefined) p[k] = body[k];
        });
        if (p.code) p.code = String(p.code).toUpperCase();
        p.updatedAt = now();
      }
      return d;
    });
    await logAdmin(req, 'promocode_update', body.id);
    ok(res, { message: 'Updated.' });
  } catch (e) {
    err(res, 500, e.message, 'PROMO_UPDATE_ERROR');
  }
}

async function promocodesDelete(req, res) {
  try {
    const body = await readBody(req);
    await update(d => {
      d.promocodes = d.promocodes.filter(p => p.id !== body.id);
      return d;
    });
    await logAdmin(req, 'promocode_delete', body.id);
    ok(res, { message: 'Deleted.' });
  } catch (e) {
    err(res, 500, e.message, 'PROMO_DELETE_ERROR');
  }
}

// ============================================================
// DISCOUNTS
// ============================================================
async function discountsList(req, res) {
  try {
    ok(res, { items: readData().discounts || [] });
  } catch (e) { err(res, 500, e.message, 'DISCOUNT_LIST_ERROR'); }
}

async function discountsCreate(req, res) {
  try {
    const body = await readBody(req);
    await update(d => {
      d.discounts = d.discounts || [];
      d.discounts.push({
        id: uniqueId('disc', d.discounts.map(x => x.id)),
        target: body.target || 'all',
        userIds: body.userIds || [],
        topics: body.topics || [],
        type: body.type === 'fixed_awc' ? 'fixed_awc' : 'percent',
        value: Number(body.value) || 0,
        enabled: body.enabled !== false,
        startAt: body.startAt || null,
        endAt: body.endAt || null,
        createdAt: now()
      });
      return d;
    });
    await logAdmin(req, 'discount_create');
    ok(res, { message: 'Created.' });
  } catch (e) { err(res, 500, e.message, 'DISCOUNT_CREATE_ERROR'); }
}

async function discountsUpdate(req, res) {
  try {
    const body = await readBody(req);
    await update(d => {
      const x = d.discounts.find(y => y.id === body.id);
      if (x) Object.assign(x, body, { updatedAt: now() });
      return d;
    });
    await logAdmin(req, 'discount_update', body.id);
    ok(res, { message: 'Updated.' });
  } catch (e) { err(res, 500, e.message, 'DISCOUNT_UPDATE_ERROR'); }
}

async function discountsDelete(req, res) {
  try {
    const body = await readBody(req);
    await update(d => {
      d.discounts = d.discounts.filter(x => x.id !== body.id);
      return d;
    });
    await logAdmin(req, 'discount_delete', body.id);
    ok(res, { message: 'Deleted.' });
  } catch (e) { err(res, 500, e.message, 'DISCOUNT_DELETE_ERROR'); }
}

// ============================================================
// EVENTS
// ============================================================
async function eventsList(req, res) {
  try { ok(res, { items: readData().events || [] }); }
  catch (e) { err(res, 500, e.message, 'EVENTS_LIST_ERROR'); }
}

async function eventsCreate(req, res) {
  try {
    const body = await readBody(req);
    await update(d => {
      d.events = d.events || [];
      d.events.push({
        id: uniqueId('ev', d.events.map(x => x.id)),
        title: sanitizeString(body.title, 120),
        description: sanitizeString(body.description, 500),
        imageUrl: sanitizeString(body.imageUrl || '', 500),
        link: sanitizeString(body.link || '', 500),
        enabled: body.enabled !== false,
        createdAt: now()
      });
      if (d.events.length > 6) {
        d.events.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
        d.events = d.events.slice(-6);
      }
      return d;
    });
    await logAdmin(req, 'event_create');
    ok(res, { message: 'Created.' });
  } catch (e) { err(res, 500, e.message, 'EVENT_CREATE_ERROR'); }
}

async function eventsUpdate(req, res) {
  try {
    const body = await readBody(req);
    await update(d => {
      const ev = d.events.find(x => x.id === body.id);
      if (ev) Object.assign(ev, body, { updatedAt: now() });
      return d;
    });
    await logAdmin(req, 'event_update', body.id);
    ok(res, { message: 'Updated.' });
  } catch (e) { err(res, 500, e.message, 'EVENT_UPDATE_ERROR'); }
}

async function eventsDelete(req, res) {
  try {
    const body = await readBody(req);
    await update(d => {
      d.events = d.events.filter(e => e.id !== body.id);
      return d;
    });
    await logAdmin(req, 'event_delete', body.id);
    ok(res, { message: 'Deleted.' });
  } catch (e) { err(res, 500, e.message, 'EVENT_DELETE_ERROR'); }
}

// ============================================================
// ANNOUNCEMENTS
// ============================================================
async function announcementsList(req, res) {
  try { ok(res, { items: readData().announcements || [] }); }
  catch (e) { err(res, 500, e.message, 'ANN_LIST_ERROR'); }
}

async function announcementsCreate(req, res) {
  try {
    const body = await readBody(req);
    await update(d => {
      d.announcements = d.announcements || [];
      d.announcements.push({
        id: uniqueId('ann', d.announcements.map(x => x.id)),
        title: sanitizeString(body.title, 200),
        body: sanitizeString(body.body, 4000),
        target: body.target || 'users',
        scheduledAt: body.scheduledAt || null,
        status: body.scheduledAt ? 'scheduled' : 'published',
        createdAt: now()
      });
      return d;
    });
    await logAdmin(req, 'announcement_create');
    ok(res, { message: 'Created.' });
  } catch (e) { err(res, 500, e.message, 'ANN_CREATE_ERROR'); }
}

async function announcementsDelete(req, res) {
  try {
    const body = await readBody(req);
    await update(d => {
      d.announcements = d.announcements.filter(a => a.id !== body.id);
      return d;
    });
    await logAdmin(req, 'announcement_delete', body.id);
    ok(res, { message: 'Deleted.' });
  } catch (e) { err(res, 500, e.message, 'ANN_DELETE_ERROR'); }
}

// ============================================================
// REVIEWS
// ============================================================
async function reviewsList(req, res) {
  try { ok(res, { items: readData().reviews || [] }); }
  catch (e) { err(res, 500, e.message, 'REVIEWS_LIST_ERROR'); }
}

async function reviewsUpdate(req, res) {
  try {
    const body = await readBody(req);
    await update(d => {
      const r = d.reviews.find(x => x.id === body.id);
      if (r) {
        if (body.status) r.status = body.status;
        r.updatedAt = now();
      }
      return d;
    });
    await logAdmin(req, 'review_update', body.id);
    ok(res, { message: 'Updated.' });
  } catch (e) { err(res, 500, e.message, 'REVIEW_UPDATE_ERROR'); }
}

async function reviewsDelete(req, res) {
  try {
    const body = await readBody(req);
    await update(d => {
      d.reviews = d.reviews.filter(r => r.id !== body.id);
      return d;
    });
    await logAdmin(req, 'review_delete', body.id);
    ok(res, { message: 'Deleted.' });
  } catch (e) { err(res, 500, e.message, 'REVIEW_DELETE_ERROR'); }
}

// ============================================================
// FEATURED
// ============================================================
async function featuredList(req, res) {
  try { ok(res, { items: readData().featuredWebsites || [] }); }
  catch (e) { err(res, 500, e.message, 'FEATURED_LIST_ERROR'); }
}

async function featuredToggle(req, res) {
  try {
    const body = await readBody(req);
    await update(d => {
      d.featuredWebsites = d.featuredWebsites || [];
      const idx = d.featuredWebsites.findIndex(f => f.webId === body.webId);
      if (idx >= 0) {
        if (!body.visible) d.featuredWebsites.splice(idx, 1);
        else d.featuredWebsites[idx].visible = true;
      } else if (body.visible !== false) {
        d.featuredWebsites.push({
          id: uniqueId('feat', d.featuredWebsites.map(f => f.id)),
          webId: body.webId,
          visible: true,
          createdAt: now()
        });
      }
      return d;
    });
    await logAdmin(req, 'featured_toggle', body.webId, { visible: !!body.visible });
    ok(res, { message: 'Updated.' });
  } catch (e) { err(res, 500, e.message, 'FEATURED_ERROR'); }
}

// ============================================================
// BADGES
// ============================================================
async function badgesList(req, res) {
  try { ok(res, { items: readData().badges || [] }); }
  catch (e) { err(res, 500, e.message, 'BADGES_LIST_ERROR'); }
}

async function badgesCreate(req, res) {
  try {
    const body = await readBody(req);
    await update(d => {
      d.badges = d.badges || [];
      d.badges.push({
        id: uniqueId('badge', d.badges.map(x => x.id)),
        name: sanitizeString(body.name, 60),
        image: sanitizeString(body.image || '', 300),
        color: sanitizeString(body.color || '#7b5cff', 20),
        enabled: body.enabled !== false,
        createdAt: now()
      });
      return d;
    });
    await logAdmin(req, 'badge_create');
    ok(res, { message: 'Created.' });
  } catch (e) { err(res, 500, e.message, 'BADGE_CREATE_ERROR'); }
}

async function badgesUpdate(req, res) {
  try {
    const body = await readBody(req);
    await update(d => {
      const b = d.badges.find(x => x.id === body.id);
      if (b) Object.assign(b, body, { updatedAt: now() });
      return d;
    });
    await logAdmin(req, 'badge_update', body.id);
    ok(res, { message: 'Updated.' });
  } catch (e) { err(res, 500, e.message, 'BADGE_UPDATE_ERROR'); }
}

async function badgesDelete(req, res) {
  try {
    const body = await readBody(req);
    await update(d => {
      d.badges = d.badges.filter(b => b.id !== body.id);
      return d;
    });
    await logAdmin(req, 'badge_delete', body.id);
    ok(res, { message: 'Deleted.' });
  } catch (e) { err(res, 500, e.message, 'BADGE_DELETE_ERROR'); }
}

// ============================================================
// MODERATION (words)
// ============================================================
async function wordsList(req, res) {
  try {
    const d = readData();
    ok(res, {
      words: (d.settings && d.settings.moderation && d.settings.moderation.bannedWords) || [],
      domains: (d.settings && d.settings.moderation && d.settings.moderation.unsalableDomains) || []
    });
  } catch (e) { err(res, 500, e.message, 'WORDS_LIST_ERROR'); }
}

async function wordsUpdate(req, res) {
  try {
    const body = await readBody(req);
    await update(d => {
      if (!d.settings.moderation) d.settings.moderation = {};
      if (Array.isArray(body.words)) d.settings.moderation.bannedWords = body.words.map(w => String(w).toLowerCase());
      if (Array.isArray(body.domains)) d.settings.moderation.unsalableDomains = body.domains.map(x => String(x).toLowerCase());
      return d;
    });
    await logAdmin(req, 'moderation_update');
    ok(res, { message: 'Updated.' });
  } catch (e) { err(res, 500, e.message, 'WORDS_UPDATE_ERROR'); }
}

// ============================================================
// SETTINGS
// ============================================================
async function settingsGet(req, res) {
  try { ok(res, { settings: readData().settings }); }
  catch (e) { err(res, 500, e.message, 'SETTINGS_GET_ERROR'); }
}

async function settingsUpdate(req, res) {
  try {
    const body = await readBody(req);
    await update(d => {
      d.settings = { ...d.settings, ...body, updatedAt: now() };
      return d;
    });
    await logAdmin(req, 'settings_update', null, { keys: Object.keys(body) });
    ok(res, { message: 'Updated.' });
  } catch (e) { err(res, 500, e.message, 'SETTINGS_UPDATE_ERROR'); }
}

// ============================================================
// PRICES
// ============================================================
async function pricesGet(req, res) {
  try {
    const s = readData().settings;
    ok(res, {
      awcPriceUZS: s.awcPriceUZS,
      listingFeeUZS: s.listingFeeUZS,
      saleCommissionPercent: s.saleCommissionPercent,
      escrowFeePercent: s.escrowFeePercent,
      cashbackPercent: s.cashbackPercent,
      premiumCashbackPercent: s.premiumCashbackPercent,
      referralBonusAWC: s.referralBonusAWC,
      rewardedAdsPerFreeListing: s.rewardedAdsPerFreeListing
    });
  } catch (e) { err(res, 500, e.message, 'PRICES_GET_ERROR'); }
}

async function pricesUpdate(req, res) {
  try {
    const body = await readBody(req);
    await update(d => {
      const numeric = ['awcPriceUZS', 'listingFeeUZS', 'saleCommissionPercent', 'escrowFeePercent',
        'cashbackPercent', 'premiumCashbackPercent', 'referralBonusAWC', 'rewardedAdsPerFreeListing'];
      numeric.forEach(k => {
        if (body[k] !== undefined) d.settings[k] = Number(body[k]);
      });
      return d;
    });
    await logAdmin(req, 'prices_update');
    ok(res, { message: 'Updated.' });
  } catch (e) { err(res, 500, e.message, 'PRICES_UPDATE_ERROR'); }
}

// ============================================================
// PREMIUM
// ============================================================
async function premiumPlansList(req, res) {
  try { ok(res, { items: readData().premiumPlans || [] }); }
  catch (e) { err(res, 500, e.message, 'PLANS_LIST_ERROR'); }
}

async function premiumPlansUpdate(req, res) {
  try {
    const body = await readBody(req);
    await update(d => {
      const p = d.premiumPlans.find(x => x.id === body.id);
      if (p) {
        ['name', 'enabled'].forEach(k => { if (body[k] !== undefined) p[k] = body[k]; });
        ['monthlyPriceUZS', 'yearlyPriceUZS', 'monthlyPriceAWC', 'yearlyPriceAWC', 'commission', 'websitesPerMonth'].forEach(k => {
          if (body[k] !== undefined) p[k] = Number(body[k]);
        });
        if (typeof body.badge === 'boolean') p.badge = body.badge;
        if (Array.isArray(body.features)) p.features = body.features;
        p.updatedAt = now();
      }
      return d;
    });
    await logAdmin(req, 'premium_plan_update', body.id);
    ok(res, { message: 'Updated.' });
  } catch (e) { err(res, 500, e.message, 'PLAN_UPDATE_ERROR'); }
}

async function premiumSubscriptionsList(req, res) {
  try { ok(res, { items: readData().premiumSubscriptions || [] }); }
  catch (e) { err(res, 500, e.message, 'SUBS_LIST_ERROR'); }
}

async function premiumSubscriptionUpdate(req, res) {
  try {
    const body = await readBody(req);
    await update(d => {
      const s = d.premiumSubscriptions.find(x => x.id === body.id);
      if (s) {
        if (body.status) s.status = body.status;
        if (body.endDate) s.endDate = body.endDate;
        s.updatedAt = now();
        if (s.status === 'active') {
          const u = d.users.find(x => x.id === s.userId);
          if (u) { u.premiumPlan = s.plan; u.premiumExpiresAt = s.endDate; }
        }
      }
      return d;
    });
    await logAdmin(req, 'premium_subscription_update', body.id, { status: body.status });
    ok(res, { message: 'Updated.' });
  } catch (e) { err(res, 500, e.message, 'SUB_UPDATE_ERROR'); }
}

// ============================================================
// FORCE SUBSCRIBE
// ============================================================
async function forceSubList(req, res) {
  try { ok(res, { items: readData().forceSubscribeChannels || [] }); }
  catch (e) { err(res, 500, e.message, 'FS_LIST_ERROR'); }
}

async function forceSubCreate(req, res) {
  try {
    const body = await readBody(req);
    await update(d => {
      d.forceSubscribeChannels = d.forceSubscribeChannels || [];
      d.forceSubscribeChannels.push({
        id: uniqueId('fs', d.forceSubscribeChannels.map(x => x.id)),
        channelId: sanitizeString(body.channelId, 100),
        channelName: sanitizeString(body.channelName, 100),
        channelLink: sanitizeString(body.channelLink, 200),
        status: body.status === 'active' ? 'active' : 'inactive',
        createdAt: now()
      });
      return d;
    });
    await logAdmin(req, 'force_sub_create');
    ok(res, { message: 'Created.' });
  } catch (e) { err(res, 500, e.message, 'FS_CREATE_ERROR'); }
}

async function forceSubUpdate(req, res) {
  try {
    const body = await readBody(req);
    await update(d => {
      const c = d.forceSubscribeChannels.find(x => x.id === body.id);
      if (c) Object.assign(c, body, { updatedAt: now() });
      return d;
    });
    await logAdmin(req, 'force_sub_update', body.id);
    ok(res, { message: 'Updated.' });
  } catch (e) { err(res, 500, e.message, 'FS_UPDATE_ERROR'); }
}

async function forceSubDelete(req, res) {
  try {
    const body = await readBody(req);
    await update(d => {
      d.forceSubscribeChannels = d.forceSubscribeChannels.filter(x => x.id !== body.id);
      return d;
    });
    await logAdmin(req, 'force_sub_delete', body.id);
    ok(res, { message: 'Deleted.' });
  } catch (e) { err(res, 500, e.message, 'FS_DELETE_ERROR'); }
}

// ============================================================
// ENVIRONMENT
// ============================================================
async function envList(req, res) {
  try {
    const d = readData();
    const items = (d.environmentUsers || []).map(u => {
      const { accessCodeHash, ...rest } = u;
      return rest;
    });
    ok(res, { items: items });
  } catch (e) { err(res, 500, e.message, 'ENV_LIST_ERROR'); }
}

async function envCreate(req, res) {
  try {
    const body = await readBody(req);
    const accessCode = sanitizeString(body.accessCode, 64);
    if (!accessCode || accessCode.length < 6) return err(res, 400, 'Access code min 6 chars.', 'INVALID');

    await update(d => {
      d.environmentUsers = d.environmentUsers || [];
      d.environmentUsers.push({
        id: uniqueId('env', d.environmentUsers.map(x => x.id)),
        name: sanitizeString(body.name, 100),
        organization: sanitizeString(body.organization || '', 200),
        accessCodeHash: hashPassword(accessCode),
        rating: 0,
        stats: { views: 0, interactions: 0 },
        createdAt: now()
      });
      return d;
    });
    await logAdmin(req, 'env_user_create');
    ok(res, { message: 'Created.' });
  } catch (e) { err(res, 500, e.message, 'ENV_CREATE_ERROR'); }
}

async function envDelete(req, res) {
  try {
    const body = await readBody(req);
    await update(d => {
      d.environmentUsers = d.environmentUsers.filter(x => x.id !== body.id);
      return d;
    });
    await logAdmin(req, 'env_user_delete', body.id);
    ok(res, { message: 'Deleted.' });
  } catch (e) { err(res, 500, e.message, 'ENV_DELETE_ERROR'); }
}

// ============================================================
// MESSAGES
// ============================================================
async function messagesList(req, res) {
  try { ok(res, { items: readData().messages || [] }); }
  catch (e) { err(res, 500, e.message, 'MSG_LIST_ERROR'); }
}

async function messagesUpdate(req, res) {
  try {
    const body = await readBody(req);
    await update(d => {
      const m = d.messages.find(x => x.id === body.id);
      if (m) {
        if (body.status) m.status = body.status;
        if (body.reply !== undefined) m.reply = sanitizeString(body.reply, 4000);
        m.updatedAt = now();
      }
      return d;
    });
    await logAdmin(req, 'message_update', body.id);
    ok(res, { message: 'Updated.' });
  } catch (e) { err(res, 500, e.message, 'MSG_UPDATE_ERROR'); }
}

async function messagesDelete(req, res) {
  try {
    const body = await readBody(req);
    await update(d => {
      d.messages = d.messages.filter(m => m.id !== body.id);
      return d;
    });
    await logAdmin(req, 'message_delete', body.id);
    ok(res, { message: 'Deleted.' });
  } catch (e) { err(res, 500, e.message, 'MSG_DELETE_ERROR'); }
}

// ============================================================
// TODO
// ============================================================
async function todoList(req, res) {
  try {
    const d = readData();
    ok(res, { items: (d.scheduledTasks || []).filter(t => t.type === 'todo') });
  } catch (e) { err(res, 500, e.message, 'TODO_LIST_ERROR'); }
}

async function todoCreate(req, res) {
  try {
    const body = await readBody(req);
    await update(d => {
      d.scheduledTasks = d.scheduledTasks || [];
      d.scheduledTasks.push({
        id: uniqueId('todo', d.scheduledTasks.map(x => x.id)),
        type: 'todo',
        title: sanitizeString(body.title, 200),
        note: sanitizeString(body.note || '', 1000),
        status: 'open',
        createdAt: now()
      });
      return d;
    });
    await logAdmin(req, 'todo_create');
    ok(res, { message: 'Created.' });
  } catch (e) { err(res, 500, e.message, 'TODO_CREATE_ERROR'); }
}

async function todoUpdate(req, res) {
  try {
    const body = await readBody(req);
    await update(d => {
      const t = d.scheduledTasks.find(x => x.id === body.id);
      if (t) {
        if (body.status) t.status = body.status;
        if (body.title) t.title = sanitizeString(body.title, 200);
        if (body.note !== undefined) t.note = sanitizeString(body.note, 1000);
        t.updatedAt = now();
      }
      return d;
    });
    await logAdmin(req, 'todo_update', body.id);
    ok(res, { message: 'Updated.' });
  } catch (e) { err(res, 500, e.message, 'TODO_UPDATE_ERROR'); }
}

async function todoDelete(req, res) {
  try {
    const body = await readBody(req);
    await update(d => {
      d.scheduledTasks = d.scheduledTasks.filter(t => t.id !== body.id);
      return d;
    });
    await logAdmin(req, 'todo_delete', body.id);
    ok(res, { message: 'Deleted.' });
  } catch (e) { err(res, 500, e.message, 'TODO_DELETE_ERROR'); }
}

// ============================================================
// SCHEDULE
// ============================================================
async function scheduleList(req, res) {
  try {
    const d = readData();
    ok(res, { items: (d.scheduledTasks || []).filter(t => t.type !== 'todo') });
  } catch (e) { err(res, 500, e.message, 'SCH_LIST_ERROR'); }
}

async function scheduleCreate(req, res) {
  try {
    const body = await readBody(req);
    await update(d => {
      d.scheduledTasks = d.scheduledTasks || [];
      d.scheduledTasks.push({
        id: uniqueId('sch', d.scheduledTasks.map(x => x.id)),
        type: body.type || 'announcement',
        title: sanitizeString(body.title || '', 200),
        note: sanitizeString(body.note || '', 1000),
        scheduledAt: body.scheduledAt || null,
        status: 'scheduled',
        createdAt: now()
      });
      return d;
    });
    await logAdmin(req, 'schedule_create');
    ok(res, { message: 'Created.' });
  } catch (e) { err(res, 500, e.message, 'SCH_CREATE_ERROR'); }
}

async function scheduleDelete(req, res) {
  try {
    const body = await readBody(req);
    await update(d => {
      d.scheduledTasks = d.scheduledTasks.filter(t => t.id !== body.id);
      return d;
    });
    await logAdmin(req, 'schedule_delete', body.id);
    ok(res, { message: 'Deleted.' });
  } catch (e) { err(res, 500, e.message, 'SCH_DELETE_ERROR'); }
}

// ============================================================
// POPUPS
// ============================================================
async function popupList(req, res) {
  try { ok(res, { items: readData().popupNotifications || [] }); }
  catch (e) { err(res, 500, e.message, 'POPUP_LIST_ERROR'); }
}

async function popupCreate(req, res) {
  try {
    const body = await readBody(req);
    await update(d => {
      d.popupNotifications = d.popupNotifications || [];
      d.popupNotifications.push({
        id: uniqueId('pop', d.popupNotifications.map(x => x.id)),
        title: sanitizeString(body.title, 200),
        body: sanitizeString(body.body, 2000),
        targetPages: body.targetPages || ['main'],
        startAt: body.startAt || null,
        endAt: body.endAt || null,
        enabled: body.enabled !== false,
        createdAt: now()
      });
      return d;
    });
    await logAdmin(req, 'popup_create');
    ok(res, { message: 'Created.' });
  } catch (e) { err(res, 500, e.message, 'POPUP_CREATE_ERROR'); }
}

async function popupUpdate(req, res) {
  try {
    const body = await readBody(req);
    await update(d => {
      const p = d.popupNotifications.find(x => x.id === body.id);
      if (p) Object.assign(p, body, { updatedAt: now() });
      return d;
    });
    await logAdmin(req, 'popup_update', body.id);
    ok(res, { message: 'Updated.' });
  } catch (e) { err(res, 500, e.message, 'POPUP_UPDATE_ERROR'); }
}

async function popupDelete(req, res) {
  try {
    const body = await readBody(req);
    await update(d => {
      d.popupNotifications = d.popupNotifications.filter(p => p.id !== body.id);
      return d;
    });
    await logAdmin(req, 'popup_delete', body.id);
    ok(res, { message: 'Deleted.' });
  } catch (e) { err(res, 500, e.message, 'POPUP_DELETE_ERROR'); }
}

// ============================================================
// NOTIFICATIONS
// ============================================================
async function notificationsList(req, res) {
  try { ok(res, { items: readData().notifications || [] }); }
  catch (e) { err(res, 500, e.message, 'NOTIF_LIST_ERROR'); }
}

async function notificationsCreate(req, res) {
  try {
    const body = await readBody(req);
    await update(d => {
      d.notifications = d.notifications || [];
      d.notifications.push({
        id: uniqueId('not', d.notifications.map(x => x.id)),
        userId: body.userId || null,
        title: sanitizeString(body.title, 200),
        body: sanitizeString(body.body || '', 2000),
        read: false,
        createdAt: now()
      });
      return d;
    });
    await logAdmin(req, 'notification_create');
    ok(res, { message: 'Created.' });
  } catch (e) { err(res, 500, e.message, 'NOTIF_CREATE_ERROR'); }
}

async function notificationsDelete(req, res) {
  try {
    const body = await readBody(req);
    await update(d => {
      d.notifications = d.notifications.filter(n => n.id !== body.id);
      return d;
    });
    await logAdmin(req, 'notification_delete', body.id);
    ok(res, { message: 'Deleted.' });
  } catch (e) { err(res, 500, e.message, 'NOTIF_DELETE_ERROR'); }
}

// ============================================================
// BACKUP / EXPORT / IMPORT
// ============================================================
async function backup(req, res) {
  try {
    const fs = require('fs');
    const path = require('path');
    const ROOT = path.join(__dirname, '..', '..');
    const dir = path.join(ROOT, 'data', 'backups');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const file = path.join(dir, 'backend-' + stamp + '.json');
    fs.copyFileSync(require('../utils/db').DATA_PATH, file);
    await logAdmin(req, 'backup_create', file);
    ok(res, { file: file, message: 'Backup created.' });
  } catch (e) { err(res, 500, e.message, 'BACKUP_ERROR'); }
}

async function backupList(req, res) {
  try {
    const fs = require('fs');
    const path = require('path');
    const dir = path.join(__dirname, '..', '..', 'data', 'backups');
    if (!fs.existsSync(dir)) return ok(res, { items: [] });
    const files = fs.readdirSync(dir).map(f => {
      const full = path.join(dir, f);
      const stat = fs.statSync(full);
      return { name: f, size: stat.size, createdAt: stat.mtime.toISOString() };
    });
    ok(res, { items: files });
  } catch (e) { err(res, 500, e.message, 'BACKUP_LIST_ERROR'); }
}

async function backupRestore(req, res) {
  try {
    const body = await readBody(req);
    const fs = require('fs');
    const path = require('path');
    const file = path.join(__dirname, '..', '..', 'data', 'backups', body.name);
    if (!fs.existsSync(file)) return err(res, 404, 'Backup not found.', 'NOT_FOUND');
    const raw = fs.readFileSync(file, 'utf8');
    const parsed = JSON.parse(raw);
    await update(() => parsed);
    await logAdmin(req, 'backup_restore', body.name);
    ok(res, { message: 'Restored.' });
  } catch (e) { err(res, 500, e.message, 'RESTORE_ERROR'); }
}

async function exportData(req, res, query) {
  try {
    const d = readData();
    const type = query.type || 'users';
    const map = {
      users: (d.users || []).map(u => { const { passwordHash, ...r } = u; return r; }),
      websites: d.websites || [],
      orders: d.orders || [],
      transactions: d.transactions || []
    };
    const items = map[type] || [];
    if (query.format === 'csv') {
      if (!items.length) {
        res.writeHead(200, { 'Content-Type': 'text/csv' });
        return res.end('');
      }
      const cols = Object.keys(items[0]);
      const csv = [cols.join(',')]
        .concat(items.map(it => cols.map(c => '"' + String(it[c] == null ? '' : it[c]).replace(/"/g, '""') + '"').join(',')))
        .join('\n');
      res.writeHead(200, {
        'Content-Type': 'text/csv',
        'Content-Disposition': 'attachment; filename="awebshop-' + type + '.csv"'
      });
      return res.end(csv);
    }
    ok(res, { items: items });
  } catch (e) { err(res, 500, e.message, 'EXPORT_ERROR'); }
}

async function importData(req, res) {
  try {
    const body = await readBody(req);
    const type = body.type;
    const items = Array.isArray(body.items) ? body.items : [];
    if (!['users', 'websites', 'orders', 'transactions'].includes(type)) {
      return err(res, 400, 'Invalid type.', 'INVALID');
    }
    await update(d => {
      items.forEach(item => {
        if (type === 'users') {
          if (!item.id) return;
          const idx = d.users.findIndex(u => u.id === item.id);
          if (idx >= 0) d.users[idx] = Object.assign({}, d.users[idx], item);
          else d.users.push(item);
        } else if (type === 'websites') {
          if (!item.webId) return;
          const idx = d.websites.findIndex(w => w.webId === item.webId);
          if (idx >= 0) d.websites[idx] = Object.assign({}, d.websites[idx], item);
          else d.websites.push(item);
        } else {
          if (!item.id) return;
          const idx = d[type].findIndex(x => x.id === item.id);
          if (idx >= 0) d[type][idx] = Object.assign({}, d[type][idx], item);
          else d[type].push(item);
        }
      });
      return d;
    });
    await logAdmin(req, 'import', null, { type: type, count: items.length });
    ok(res, { message: 'Imported ' + items.length + ' ' + type + '.' });
  } catch (e) { err(res, 500, e.message, 'IMPORT_ERROR'); }
}

// ============================================================
// SECURITY
// ============================================================
async function securityList(req, res) {
  try {
    const d = readData();
    ok(res, {
      securityLogs: (d.securityLogs || []).slice(-200),
      loginAttempts: (d.loginAttempts || []).slice(-200),
      blockedIps: (d.settings && d.settings.blockedIps) || [],
      passwordPolicy: (d.settings && d.settings.passwordPolicy) || { minLength: 8 }
    });
  } catch (e) { err(res, 500, e.message, 'SEC_LIST_ERROR'); }
}

async function securityUpdate(req, res) {
  try {
    const body = await readBody(req);
    await update(d => {
      if (Array.isArray(body.blockedIps)) d.settings.blockedIps = body.blockedIps;
      if (body.passwordPolicy) d.settings.passwordPolicy = Object.assign({}, d.settings.passwordPolicy, body.passwordPolicy);
      if (typeof body.rateLimitEnabled === 'boolean') d.settings.rateLimitEnabled = body.rateLimitEnabled;
      if (typeof body.captchaEnabled === 'boolean') d.settings.captchaEnabled = body.captchaEnabled;
      return d;
    });
    await logAdmin(req, 'security_update');
    ok(res, { message: 'Updated.' });
  } catch (e) { err(res, 500, e.message, 'SEC_UPDATE_ERROR'); }
}

async function securityLogAdd(req, res) {
  try {
    const body = await readBody(req);
    await update(d => {
      d.securityLogs = d.securityLogs || [];
      d.securityLogs.push({
        id: 'sec_' + Date.now().toString(36),
        type: sanitizeString(body.type || 'info', 40),
        message: sanitizeString(body.message || '', 500),
        ip: sanitizeString(body.ip || '', 60),
        meta: body.meta || {},
        timestamp: now()
      });
      return d;
    });
    ok(res, { message: 'Logged.' });
  } catch (e) { err(res, 500, e.message, 'SEC_LOG_ERROR'); }
}

// ============================================================
// SEO / TELEGRAM
// ============================================================
async function seoGet(req, res) {
  try {
    const s = readData().settings;
    ok(res, { seo: s.seo || {} });
  } catch (e) { err(res, 500, e.message, 'SEO_GET_ERROR'); }
}

async function seoUpdate(req, res) {
  try {
    const body = await readBody(req);
    await update(d => {
      d.settings.seo = Object.assign({}, d.settings.seo || {}, body);
      return d;
    });
    await logAdmin(req, 'seo_update');
    ok(res, { message: 'Updated.' });
  } catch (e) { err(res, 500, e.message, 'SEO_UPDATE_ERROR'); }
}

async function telegramGet(req, res) {
  try {
    const s = readData().settings;
    ok(res, { telegram: s.telegramSettings || { enabled: false, messageTemplates: {} } });
  } catch (e) { err(res, 500, e.message, 'TG_GET_ERROR'); }
}

async function telegramUpdate(req, res) {
  try {
    const body = await readBody(req);
    await update(d => {
      d.settings.telegramSettings = Object.assign({}, d.settings.telegramSettings || {}, body);
      return d;
    });
    await logAdmin(req, 'telegram_update');
    ok(res, { message: 'Updated.' });
  } catch (e) { err(res, 500, e.message, 'TG_UPDATE_ERROR'); }
}

async function telegramTest(req, res) {
  try {
    const { sendMessage } = require('../services/telegramService');
    const config = require('../../config');
    if (!config.telegram.adminChatId) return err(res, 400, 'Admin chat ID not configured.', 'NO_CHAT');
    const r = await sendMessage(config.telegram.adminChatId, '✅ AWebShop test message — Telegram is working.');
    if (r.ok) ok(res, { message: 'Test sent.' });
    else err(res, 500, 'Telegram send failed.', 'TG_FAIL');
  } catch (e) { err(res, 500, e.message, 'TG_TEST_ERROR'); }
}

// ============================================================
// MAINTENANCE
// ============================================================
async function maintenanceGet(req, res) {
  try {
    const s = readData().settings;
    ok(res, {
      enabled: !!s.maintenanceMode,
      message: s.maintenanceMessage || '',
      startAt: s.maintenanceStart || null,
      endAt: s.maintenanceEnd || null,
      whitelist: s.maintenanceWhitelist || []
    });
  } catch (e) { err(res, 500, e.message, 'MAINT_GET_ERROR'); }
}

async function maintenanceUpdate(req, res) {
  try {
    const body = await readBody(req);
    await update(d => {
      if (typeof body.enabled === 'boolean') d.settings.maintenanceMode = body.enabled;
      if (body.message !== undefined) d.settings.maintenanceMessage = sanitizeString(body.message, 500);
      if (body.startAt !== undefined) d.settings.maintenanceStart = body.startAt;
      if (body.endAt !== undefined) d.settings.maintenanceEnd = body.endAt;
      if (Array.isArray(body.whitelist)) d.settings.maintenanceWhitelist = body.whitelist;
      return d;
    });
    await logAdmin(req, 'maintenance_update', null, { enabled: body.enabled });
    ok(res, { message: 'Updated.' });
  } catch (e) { err(res, 500, e.message, 'MAINT_UPDATE_ERROR'); }
}

// ============================================================
// EXPORTS
// ============================================================
module.exports = {
  // stats / logs / analytics
  stats: stats,
  logs: logs,
  analytics: analytics,

  // users
  usersList: usersList,
  usersCreate: usersCreate,
  blockUser: blockUser,
  softDeleteUser: softDeleteUser,
  restoreUser: restoreUser,
  assignBadge: assignBadge,
  unassignBadge: unassignBadge,
  banUser: banUser,
  unbanUser: unbanUser,
  banUserWithDuration: banUserWithDuration,
  awcAdjust: awcAdjust,

  // admins
  adminsList: adminsList,
  adminsCreate: adminsCreate,
  adminsUpdate: adminsUpdate,
  adminsDelete: adminsDelete,

  // websites
  websitesList: websitesList,
  websiteUpdate: websiteUpdate,
  websiteDelete: websiteDelete,

  // escrow
  escrowList: escrowList,
  escrowUpdate: escrowUpdate,

  // withdraw
  withdrawList: withdrawList,
  withdrawApprove: withdrawApprove,

  // payments
  transactionsList: transactionsList,
  verifyPayment: verifyPayment,

  // promocodes
  promocodesList: promocodesList,
  promocodesCreate: promocodesCreate,
  promocodesUpdate: promocodesUpdate,
  promocodesDelete: promocodesDelete,

  // discounts
  discountsList: discountsList,
  discountsCreate: discountsCreate,
  discountsUpdate: discountsUpdate,
  discountsDelete: discountsDelete,

  // events
  eventsList: eventsList,
  eventsCreate: eventsCreate,
  eventsUpdate: eventsUpdate,
  eventsDelete: eventsDelete,

  // announcements
  announcementsList: announcementsList,
  announcementsCreate: announcementsCreate,
  announcementsDelete: announcementsDelete,

  // reviews
  reviewsList: reviewsList,
  reviewsUpdate: reviewsUpdate,
  reviewsDelete: reviewsDelete,

  // featured
  featuredList: featuredList,
  featuredToggle: featuredToggle,

  // badges
  badgesList: badgesList,
  badgesCreate: badgesCreate,
  badgesUpdate: badgesUpdate,
  badgesDelete: badgesDelete,

  // moderation
  wordsList: wordsList,
  wordsUpdate: wordsUpdate,

  // settings
  settingsGet: settingsGet,
  settingsUpdate: settingsUpdate,

  // prices
  pricesGet: pricesGet,
  pricesUpdate: pricesUpdate,

  // premium
  premiumPlansList: premiumPlansList,
  premiumPlansUpdate: premiumPlansUpdate,
  premiumSubscriptionsList: premiumSubscriptionsList,
  premiumSubscriptionUpdate: premiumSubscriptionUpdate,

  // force-sub
  forceSubList: forceSubList,
  forceSubCreate: forceSubCreate,
  forceSubUpdate: forceSubUpdate,
  forceSubDelete: forceSubDelete,

  // environment
  envList: envList,
  envCreate: envCreate,
  envDelete: envDelete,

  // messages
  messagesList: messagesList,
  messagesUpdate: messagesUpdate,
  messagesDelete: messagesDelete,

  // todo
  todoList: todoList,
  todoCreate: todoCreate,
  todoUpdate: todoUpdate,
  todoDelete: todoDelete,

  // schedule
  scheduleList: scheduleList,
  scheduleCreate: scheduleCreate,
  scheduleDelete: scheduleDelete,

  // popups
  popupList: popupList,
  popupCreate: popupCreate,
  popupUpdate: popupUpdate,
  popupDelete: popupDelete,

  // notifications
  notificationsList: notificationsList,
  notificationsCreate: notificationsCreate,
  notificationsDelete: notificationsDelete,

  // backup / export / import
  backup: backup,
  backupList: backupList,
  backupRestore: backupRestore,
  exportData: exportData,
  importData: importData,

  // security
  securityList: securityList,
  securityUpdate: securityUpdate,
  securityLogAdd: securityLogAdd,

  // seo / telegram
  seoGet: seoGet,
  seoUpdate: seoUpdate,
  telegramGet: telegramGet,
  telegramUpdate: telegramUpdate,
  telegramTest: telegramTest,

  // maintenance
  maintenanceGet: maintenanceGet,
  maintenanceUpdate: maintenanceUpdate
};