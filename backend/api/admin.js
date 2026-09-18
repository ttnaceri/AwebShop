// backend/api/admin.js
const { readData, update } = require('../utils/db');
const { now, sanitizeString, hashPassword } = require('../utils/helpers');
const { uniqueId, generateToken } = require('../utils/idGenerator');
const { recordTransaction } = require('../services/tokenService');
const { notifyUser, notifyAdmin } = require('../services/telegramService');

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
function logAdmin(req, action, target, meta = {}) {
  return update(d => {
    d.adminLogs.push({
      id: 'log_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8),
      adminId: req.user.userId,
      action,
      target: target || null,
      meta,
      timestamp: now()
    });
    return d;
  });
}

// ---------- helpers ----------
function ok(res, data) { send(res, 200, { success: true, data }); }
function err(res, status, message, code = 'ERROR') { send(res, status, { success: false, message, code }); }

// =========================================================
// STATS / LOGS / ANALYTICS
// =========================================================
async function stats(req, res) {
  const d = readData();
  const last14 = [...Array(14)].map((_, i) => {
    const day = new Date(); day.setDate(day.getDate() - (13 - i));
    const iso = day.toISOString().slice(0, 10);
    return {
      date: iso,
      users: d.users.filter(u => (u.createdAt || '').slice(0, 10) === iso).length,
      websites: d.websites.filter(w => (w.createdAt || '').slice(0, 10) === iso).length,
      orders: d.orders.filter(o => (o.createdAt || '').slice(0, 10) === iso).length,
      revenue: d.transactions
        .filter(t => t.status === 'completed' && (t.createdAt || '').slice(0, 10) === iso)
        .reduce((s, t) => s + (t.amountUZS || 0), 0)
    };
  });

  ok(res, {
    users: d.users.filter(u => !u.deleted).length,
    blockedUsers: d.users.filter(u => u.blocked).length,
    websites: d.websites.length,
    activeWebsites: d.websites.filter(w => w.status === 'active').length,
    soldWebsites: d.websites.filter(w => w.status === 'sold').length,
    orders: d.orders.length,
    transactions: d.transactions.length,
    escrows: d.escrows.length,
    pendingEscrows: d.escrows.filter(e => e.status === 'pending').length,
    withdrawals: d.withdrawals.length,
    pendingWithdrawals: d.withdrawals.filter(w => w.status === 'pending').length,
    pendingPayments: d.transactions.filter(t => t.status === 'pending_manual_verification').length,
    revenue: d.transactions.filter(t => t.status === 'completed' && t.type === 'sale_commission')
      .reduce((s, t) => s + (t.amountUZS || 0), 0),
    awcCirculation: d.users.reduce((s, u) => s + (u.balanceAWC || 0), 0),
    trend: last14
  });
}

async function logs(req, res) {
  const d = readData();
  ok(res, { items: (d.adminLogs || []).slice(-500) });
}

async function analytics(req, res) {
  const d = readData();
  // simple derived analytics
  const topicCounts = {};
  d.websites.forEach(w => { topicCounts[w.topic] = (topicCounts[w.topic] || 0) + 1; });
  const saleTypes = { safe: 0, fast: 0 };
  d.websites.forEach(w => { saleTypes[w.saleType] = (saleTypes[w.saleType] || 0) + 1; });
  const paymentMethods = {};
  d.transactions.forEach(t => {
    if (!t.paymentMethod) return;
    paymentMethods[t.paymentMethod] = (paymentMethods[t.paymentMethod] || 0) + 1;
  });
  ok(res, { topicCounts, saleTypes, paymentMethods });
}

// =========================================================
// USERS
// =========================================================
async function usersList(req, res) {
  const d = readData();
  ok(res, { items: d.users.filter(u => !u.deleted).map(({ passwordHash, ...u }) => u) });
}
async function blockUser(req, res) {
  const body = await readBody(req);
  const { userId, blocked } = body;
  await update(d => {
    const u = d.users.find(x => x.id === userId);
    if (u) { u.blocked = !!blocked; u.updatedAt = now(); }
    return d;
  });
  await logAdmin(req, blocked ? 'user_block' : 'user_unblock', userId);
  ok(res, { message: 'Updated.' });
}
async function softDeleteUser(req, res) {
  const body = await readBody(req);
  await update(d => {
    const u = d.users.find(x => x.id === body.userId);
    if (u) { u.deleted = true; u.deletedAt = now(); }
    return d;
  });
  await logAdmin(req, 'user_soft_delete', body.userId);
  ok(res, { message: 'Deleted.' });
}
async function restoreUser(req, res) {
  const body = await readBody(req);
  await update(d => {
    const u = d.users.find(x => x.id === body.userId);
    if (u) { u.deleted = false; u.deletedAt = null; }
    return d;
  });
  await logAdmin(req, 'user_restore', body.userId);
  ok(res, { message: 'Restored.' });
}
async function assignBadge(req, res) {
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
}
async function unassignBadge(req, res) {
  const body = await readBody(req);
  await update(d => {
    const u = d.users.find(x => x.id === body.userId);
    if (u) u.badges = (u.badges || []).filter(b => b !== body.badgeId);
    return d;
  });
  await logAdmin(req, 'user_badge_unassign', body.userId, { badgeId: body.badgeId });
  ok(res, { message: 'Badge removed.' });
}

// =========================================================
// ADMINS
// =========================================================
async function adminsList(req, res) {
  const d = readData();
  ok(res, { items: d.admins || [] });
}
async function adminsCreate(req, res) {
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
      userId,
      role,
      permissions: body.permissions || {},
      disabled: false,
      code: generateToken(6),
      createdAt: now()
    });
    const u = dd.users.find(x => x.id === userId);
    if (u) u.role = role;
    return dd;
  });
  await logAdmin(req, 'admin_create', userId, { role });
  ok(res, { message: 'Admin added.' });
}
async function adminsUpdate(req, res) {
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
}
async function adminsDelete(req, res) {
  const body = await readBody(req);
  await update(d => {
    d.admins = d.admins.filter(a => a.id !== body.id);
    return d;
  });
  await logAdmin(req, 'admin_delete', body.id);
  ok(res, { message: 'Deleted.' });
}

// =========================================================
// WEBSITES
// =========================================================
async function websitesList(req, res) {
  const d = readData();
  ok(res, { items: d.websites });
}
async function websiteUpdate(req, res) {
  const body = await readBody(req);
  await update(d => {
    const w = d.websites.find(x => x.webId === body.webId);
    if (w) {
      ['name','domain','description','topic','imageUrl','status','saleType'].forEach(k => {
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
  await update(d => {
    d.websites = d.websites.filter(w => w.webId !== body.webId);
    return d;
  });
  await logAdmin(req, 'website_delete', body.webId);
  ok(res, { message: 'Deleted.' });
}

// =========================================================
// ESCROW
// =========================================================
async function escrowList(req, res) {
  const d = readData();
  ok(res, { items: d.escrows });
}
async function escrowUpdate(req, res) {
  const body = await readBody(req);
  const allowed = ['pending','paid','transferred','verified','completed','cancelled','disputed','refunded'];
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
  if (buyer) await notifyUser(buyer.telegramId, `🔐 Escrow ${escrow.id} status: <b>${escrow.status}</b>`);
  if (seller) await notifyUser(seller.telegramId, `🔐 Escrow ${escrow.id} status: <b>${escrow.status}</b>`);
  await logAdmin(req, 'escrow_update', body.escrowId, { status: body.status });
  ok(res, { escrow });
}

// =========================================================
// WITHDRAWALS
// =========================================================
async function withdrawList(req, res) {
  const d = readData();
  ok(res, { items: d.withdrawals });
}
async function withdrawApprove(req, res) {
  const body = await readBody(req);
  const { withdrawalId, decision } = body;
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
      if (u && u.balanceAWC >= wd.amountAWC) u.balanceAWC = +(u.balanceAWC - wd.amountAWC).toFixed(4);
      return d;
    });
    await recordTransaction(wd.userId, 'withdraw_approved', {
      amountAWC: -wd.amountAWC, amountUZS: -wd.amountUZS,
      description: 'Withdrawal approved'
    });
  } else {
    await recordTransaction(wd.userId, 'withdraw_rejected', {
      amountAWC: wd.amountAWC, amountUZS: wd.amountUZS,
      description: 'Withdrawal rejected'
    });
  }

  const u2 = readData().users.find(u => u.id === wd.userId);
  if (u2) await notifyUser(u2.telegramId, `💰 Withdrawal ${decision}d: ${wd.amountAWC} AWC`);
  await logAdmin(req, 'withdraw_' + decision, withdrawalId);
  ok(res, { withdrawal: wd });
}

// =========================================================
// PAYMENTS
// =========================================================
async function transactionsList(req, res) {
  const d = readData();
  ok(res, { items: d.transactions.slice().reverse() });
}
async function verifyPayment(req, res) {
  const body = await readBody(req);
  const { transactionId, decision, adminNotes } = body;
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
      if (adminNotes !== undefined) t.adminNotes = sanitizeString(adminNotes, 1000);
      t.updatedAt = now();
      tx = { ...t };
    }
    return d;
  });
  if (!tx) return err(res, 404, 'Not found.', 'NOT_FOUND');
  const u = readData().users.find(x => x.id === tx.userId);
  if (u) await notifyUser(u.telegramId, `💳 Payment ${decision}d: ${tx.amountUZS} UZS`);
  await logAdmin(req, 'payment_' + decision, transactionId);
  ok(res, { transaction: tx });
}

// =========================================================
// CARDS
// =========================================================
async function cardsList(req, res) {
  const d = readData();
  ok(res, { items: d.paymentCards });
}
async function cardsCreate(req, res) {
  const body = await readBody(req);
  await update(d => {
    const card = {
      id: uniqueId('card', d.paymentCards.map(c => c.id)),
      cardNumber: sanitizeString(body.cardNumber, 32),
      owner: sanitizeString(body.owner, 100),
      bank: sanitizeString(body.bank, 100),
      type: sanitizeString(body.type || 'uzcard', 20),
      expiry: sanitizeString(body.expiry, 10),
      status: body.status === 'active' ? 'active' : 'inactive',
      isDefault: !!body.isDefault,
      createdAt: now()
    };
    if (card.isDefault) d.paymentCards.forEach(c => c.isDefault = false);
    d.paymentCards.push(card);
    return d;
  });
  await logAdmin(req, 'card_create');
  ok(res, { message: 'Card created.' });
}
async function cardsUpdate(req, res) {
  const body = await readBody(req);
  await update(d => {
    const c = d.paymentCards.find(x => x.id === body.id);
    if (c) {
      ['cardNumber','owner','bank','type','expiry','status'].forEach(k => {
        if (body[k] !== undefined) c[k] = sanitizeString(body[k], 200);
      });
      if (typeof body.isDefault === 'boolean') {
        if (body.isDefault) d.paymentCards.forEach(x => x.isDefault = false);
        c.isDefault = body.isDefault;
      }
      c.updatedAt = now();
    }
    return d;
  });
  await logAdmin(req, 'card_update', body.id);
  ok(res, { message: 'Updated.' });
}
async function cardsDelete(req, res) {
  const body = await readBody(req);
  await update(d => { d.paymentCards = d.paymentCards.filter(c => c.id !== body.id); return d; });
  await logAdmin(req, 'card_delete', body.id);
  ok(res, { message: 'Deleted.' });
}

// =========================================================
// PROMOCODES
// =========================================================
async function promocodesList(req, res) {
  ok(res, { items: readData().promocodes || [] });
}
async function promocodesCreate(req, res) {
  const body = await readBody(req);
  const code = sanitizeString(body.code, 32).toUpperCase();
  if (!code) return err(res, 400, 'Code required.', 'INVALID');
  const d = readData();
  if (d.promocodes.some(p => p.code === code)) return err(res, 409, 'Code exists.', 'DUPLICATE');
  await update(dd => {
    dd.promocodes.push({
      id: uniqueId('promo', dd.promocodes.map(p => p.id)),
      code,
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
}
async function promocodesUpdate(req, res) {
  const body = await readBody(req);
  await update(d => {
    const p = d.promocodes.find(x => x.id === body.id);
    if (p) {
      ['code','type','value','maxUses','expiresAt','enabled'].forEach(k => {
        if (body[k] !== undefined) p[k] = body[k];
      });
      if (p.code) p.code = String(p.code).toUpperCase();
      p.updatedAt = now();
    }
    return d;
  });
  await logAdmin(req, 'promocode_update', body.id);
  ok(res, { message: 'Updated.' });
}
async function promocodesDelete(req, res) {
  const body = await readBody(req);
  await update(d => { d.promocodes = d.promocodes.filter(p => p.id !== body.id); return d; });
  await logAdmin(req, 'promocode_delete', body.id);
  ok(res, { message: 'Deleted.' });
}

// =========================================================
// DISCOUNTS
// =========================================================
async function discountsList(req, res) {
  ok(res, { items: readData().discounts || [] });
}
async function discountsCreate(req, res) {
  const body = await readBody(req);
  await update(d => {
    d.discounts.push({
      id: uniqueId('disc', d.discounts.map(x => x.id)),
      target: body.target || 'all', // new | existing | all | selected
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
}
async function discountsUpdate(req, res) {
  const body = await readBody(req);
  await update(d => {
    const x = d.discounts.find(y => y.id === body.id);
    if (x) { Object.assign(x, body, { updatedAt: now() }); }
    return d;
  });
  await logAdmin(req, 'discount_update', body.id);
  ok(res, { message: 'Updated.' });
}
async function discountsDelete(req, res) {
  const body = await readBody(req);
  await update(d => { d.discounts = d.discounts.filter(x => x.id !== body.id); return d; });
  await logAdmin(req, 'discount_delete', body.id);
  ok(res, { message: 'Deleted.' });
}

// =========================================================
// EVENTS (FIFO 6 page)
// =========================================================
async function eventsList(req, res) {
  ok(res, { items: readData().events || [] });
}
async function eventsCreate(req, res) {
  const body = await readBody(req);
  await update(d => {
    const ev = {
      id: uniqueId('ev', d.events.map(x => x.id)),
      title: sanitizeString(body.title, 120),
      description: sanitizeString(body.description, 500),
      imageUrl: sanitizeString(body.imageUrl || '', 500),
      link: sanitizeString(body.link || '', 500),
      enabled: body.enabled !== false,
      createdAt: now()
    };
    d.events.push(ev);
    // FIFO — 6 tadan oshsa eng eskisini o'chirish
    if (d.events.length > 6) {
      d.events.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
      d.events = d.events.slice(-6);
    }
    return d;
  });
  await logAdmin(req, 'event_create');
  ok(res, { message: 'Created.' });
}
async function eventsUpdate(req, res) {
  const body = await readBody(req);
  await update(d => {
    const ev = d.events.find(x => x.id === body.id);
    if (ev) Object.assign(ev, body, { updatedAt: now() });
    return d;
  });
  await logAdmin(req, 'event_update', body.id);
  ok(res, { message: 'Updated.' });
}
async function eventsDelete(req, res) {
  const body = await readBody(req);
  await update(d => { d.events = d.events.filter(e => e.id !== body.id); return d; });
  await logAdmin(req, 'event_delete', body.id);
  ok(res, { message: 'Deleted.' });
}

// =========================================================
// ANNOUNCEMENTS
// =========================================================
async function announcementsList(req, res) {
  ok(res, { items: readData().announcements || [] });
}
async function announcementsCreate(req, res) {
  const body = await readBody(req);
  await update(d => {
    d.announcements.push({
      id: uniqueId('ann', d.announcements.map(x => x.id)),
      title: sanitizeString(body.title, 200),
      body: sanitizeString(body.body, 4000),
      target: body.target || 'users', // admins | users | collaborators
      scheduledAt: body.scheduledAt || null,
      status: body.scheduledAt ? 'scheduled' : 'published',
      createdAt: now()
    });
    return d;
  });
  await logAdmin(req, 'announcement_create');
  ok(res, { message: 'Created.' });
}
async function announcementsDelete(req, res) {
  const body = await readBody(req);
  await update(d => { d.announcements = d.announcements.filter(a => a.id !== body.id); return d; });
  await logAdmin(req, 'announcement_delete', body.id);
  ok(res, { message: 'Deleted.' });
}

// =========================================================
// REVIEWS
// =========================================================
async function reviewsList(req, res) {
  ok(res, { items: readData().reviews || [] });
}
async function reviewsUpdate(req, res) {
  const body = await readBody(req);
  await update(d => {
    const r = d.reviews.find(x => x.id === body.id);
    if (r) {
      if (body.status) r.status = body.status; // approved | pending | rejected
      r.updatedAt = now();
    }
    return d;
  });
  await logAdmin(req, 'review_update', body.id);
  ok(res, { message: 'Updated.' });
}
async function reviewsDelete(req, res) {
  const body = await readBody(req);
  await update(d => { d.reviews = d.reviews.filter(r => r.id !== body.id); return d; });
  await logAdmin(req, 'review_delete', body.id);
  ok(res, { message: 'Deleted.' });
}

// =========================================================
// FEATURED
// =========================================================
async function featuredList(req, res) {
  ok(res, { items: readData().featuredWebsites || [] });
}
async function featuredToggle(req, res) {
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
}

// =========================================================
// BADGES
// =========================================================
async function badgesList(req, res) {
  ok(res, { items: readData().badges || [] });
}
async function badgesCreate(req, res) {
  const body = await readBody(req);
  await update(d => {
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
}
async function badgesUpdate(req, res) {
  const body = await readBody(req);
  await update(d => {
    const b = d.badges.find(x => x.id === body.id);
    if (b) Object.assign(b, body, { updatedAt: now() });
    return d;
  });
  await logAdmin(req, 'badge_update', body.id);
  ok(res, { message: 'Updated.' });
}
async function badgesDelete(req, res) {
  const body = await readBody(req);
  await update(d => { d.badges = d.badges.filter(b => b.id !== body.id); return d; });
  await logAdmin(req, 'badge_delete', body.id);
  ok(res, { message: 'Deleted.' });
}

// =========================================================
// BANNED WORDS / DOMAINS
// =========================================================
async function wordsList(req, res) {
  const d = readData();
  ok(res, {
    words: d.settings.moderation?.bannedWords || [],
    domains: d.settings.moderation?.unsalableDomains || []
  });
}
async function wordsUpdate(req, res) {
  const body = await readBody(req);
  await update(d => {
    if (!d.settings.moderation) d.settings.moderation = {};
    if (Array.isArray(body.words)) d.settings.moderation.bannedWords = body.words.map(w => String(w).toLowerCase());
    if (Array.isArray(body.domains)) d.settings.moderation.unsalableDomains = body.domains.map(x => String(x).toLowerCase());
    return d;
  });
  await logAdmin(req, 'moderation_update');
  ok(res, { message: 'Updated.' });
}

// =========================================================
// SETTINGS
// =========================================================
async function settingsGet(req, res) {
  ok(res, { settings: readData().settings });
}
async function settingsUpdate(req, res) {
  const body = await readBody(req);
  await update(d => {
    d.settings = { ...d.settings, ...body, updatedAt: now() };
    return d;
  });
  await logAdmin(req, 'settings_update', null, { keys: Object.keys(body) });
  ok(res, { message: 'Updated.' });
}

// =========================================================
// PRICES
// =========================================================
async function pricesGet(req, res) {
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
}
async function pricesUpdate(req, res) {
  const body = await readBody(req);
  await update(d => {
    const numeric = ['awcPriceUZS','listingFeeUZS','saleCommissionPercent','escrowFeePercent',
                     'cashbackPercent','premiumCashbackPercent','referralBonusAWC','rewardedAdsPerFreeListing'];
    numeric.forEach(k => { if (body[k] !== undefined) d.settings[k] = Number(body[k]); });
    return d;
  });
  await logAdmin(req, 'prices_update');
  ok(res, { message: 'Updated.' });
}

// =========================================================
// PREMIUM PLANS
// =========================================================
async function premiumPlansList(req, res) {
  ok(res, { items: readData().premiumPlans });
}
async function premiumPlansUpdate(req, res) {
  const body = await readBody(req);
  await update(d => {
    const p = d.premiumPlans.find(x => x.id === body.id);
    if (p) {
      ['name','enabled'].forEach(k => { if (body[k] !== undefined) p[k] = body[k]; });
      ['monthlyPriceUZS','yearlyPriceUZS','commission','websitesPerMonth'].forEach(k => {
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
}

async function premiumSubscriptionsList(req, res) {
  ok(res, { items: readData().premiumSubscriptions || [] });
}
async function premiumSubscriptionUpdate(req, res) {
  const body = await readBody(req);
  await update(d => {
    const s = d.premiumSubscriptions.find(x => x.id === body.id);
    if (s) {
      if (body.status) s.status = body.status;
      if (body.endDate) s.endDate = body.endDate;
      s.updatedAt = now();
      // user premium maydonini sinxronlash
      if (s.status === 'active') {
        const u = d.users.find(x => x.id === s.userId);
        if (u) { u.premiumPlan = s.plan; u.premiumExpiresAt = s.endDate; }
      }
    }
    return d;
  });
  await logAdmin(req, 'premium_subscription_update', body.id, { status: body.status });
  ok(res, { message: 'Updated.' });
}

// =========================================================
// FORCE SUBSCRIBE
// =========================================================
async function forceSubList(req, res) {
  ok(res, { items: readData().forceSubscribeChannels || [] });
}
async function forceSubCreate(req, res) {
  const body = await readBody(req);
  await update(d => {
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
}
async function forceSubUpdate(req, res) {
  const body = await readBody(req);
  await update(d => {
    const c = d.forceSubscribeChannels.find(x => x.id === body.id);
    if (c) Object.assign(c, body, { updatedAt: now() });
    return d;
  });
  await logAdmin(req, 'force_sub_update', body.id);
  ok(res, { message: 'Updated.' });
}
async function forceSubDelete(req, res) {
  const body = await readBody(req);
  await update(d => {
    d.forceSubscribeChannels = d.forceSubscribeChannels.filter(x => x.id !== body.id);
    return d;
  });
  await logAdmin(req, 'force_sub_delete', body.id);
  ok(res, { message: 'Deleted.' });
}

// =========================================================
// ENVIRONMENT (special access)
// =========================================================
async function envList(req, res) {
  const d = readData();
  ok(res, { items: (d.environmentUsers || []).map(({ accessCodeHash, ...u }) => u) });
}
async function envCreate(req, res) {
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
}
async function envDelete(req, res) {
  const body = await readBody(req);
  await update(d => {
    d.environmentUsers = d.environmentUsers.filter(x => x.id !== body.id);
    return d;
  });
  await logAdmin(req, 'env_user_delete', body.id);
  ok(res, { message: 'Deleted.' });
}

// =========================================================
// MESSAGES (contact)
// =========================================================
async function messagesList(req, res) {
  ok(res, { items: readData().messages || [] });
}
async function messagesUpdate(req, res) {
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
}
async function messagesDelete(req, res) {
  const body = await readBody(req);
  await update(d => { d.messages = d.messages.filter(m => m.id !== body.id); return d; });
  await logAdmin(req, 'message_delete', body.id);
  ok(res, { message: 'Deleted.' });
}

// =========================================================
// TODO
// =========================================================
async function todoList(req, res) {
  ok(res, { items: readData().scheduledTasks.filter(t => t.type === 'todo') });
}
async function todoCreate(req, res) {
  const body = await readBody(req);
  await update(d => {
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
}
async function todoUpdate(req, res) {
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
}
async function todoDelete(req, res) {
  const body = await readBody(req);
  await update(d => { d.scheduledTasks = d.scheduledTasks.filter(t => t.id !== body.id); return d; });
  await logAdmin(req, 'todo_delete', body.id);
  ok(res, { message: 'Deleted.' });
}

// =========================================================
// SCHEDULE
// =========================================================
async function scheduleList(req, res) {
  ok(res, { items: readData().scheduledTasks.filter(t => t.type !== 'todo') });
}
async function scheduleCreate(req, res) {
  const body = await readBody(req);
  await update(d => {
    d.scheduledTasks.push({
      id: uniqueId('sch', d.scheduledTasks.map(x => x.id)),
      type: body.type || 'announcement', // announcement | note | backup | discount
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
}
async function scheduleDelete(req, res) {
  const body = await readBody(req);
  await update(d => { d.scheduledTasks = d.scheduledTasks.filter(t => t.id !== body.id); return d; });
  await logAdmin(req, 'schedule_delete', body.id);
  ok(res, { message: 'Deleted.' });
}

// =========================================================
// POPUP NOTIFICATIONS
// =========================================================
async function popupList(req, res) {
  ok(res, { items: readData().popupNotifications || [] });
}
async function popupCreate(req, res) {
  const body = await readBody(req);
  await update(d => {
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
}
async function popupUpdate(req, res) {
  const body = await readBody(req);
  await update(d => {
    const p = d.popupNotifications.find(x => x.id === body.id);
    if (p) Object.assign(p, body, { updatedAt: now() });
    return d;
  });
  await logAdmin(req, 'popup_update', body.id);
  ok(res, { message: 'Updated.' });
}
async function popupDelete(req, res) {
  const body = await readBody(req);
  await update(d => { d.popupNotifications = d.popupNotifications.filter(p => p.id !== body.id); return d; });
  await logAdmin(req, 'popup_delete', body.id);
  ok(res, { message: 'Deleted.' });
}

// =========================================================
// NOTIFICATIONS (system)
// =========================================================
async function notificationsList(req, res) {
  ok(res, { items: readData().notifications || [] });
}
async function notificationsCreate(req, res) {
  const body = await readBody(req);
  await update(d => {
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
}
async function notificationsDelete(req, res) {
  const body = await readBody(req);
  await update(d => { d.notifications = d.notifications.filter(n => n.id !== body.id); return d; });
  await logAdmin(req, 'notification_delete', body.id);
  ok(res, { message: 'Deleted.' });
}

// =========================================================
// BACKUP / EXPORT / IMPORT
// =========================================================
async function backup(req, res) {
  const fs = require('fs');
  const path = require('path');
  const ROOT = path.join(__dirname, '..', '..');
  const dir = path.join(ROOT, 'data', 'backups');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const file = path.join(dir, `backend-${stamp}.json`);
  fs.copyFileSync(require('../utils/db').DATA_PATH, file);
  await logAdmin(req, 'backup_create', file);
  ok(res, { file, message: 'Backup created.' });
}
async function backupList(req, res) {
  const fs = require('fs');
  const path = require('path');
  const dir = path.join(__dirname, '..', '..', 'data', 'backups');
  if (!fs.existsSync(dir)) return ok(res, { items: [] });
  const files = fs.readdirSync(dir).map(f => ({
    name: f,
    size: fs.statSync(path.join(dir, f)).size,
    createdAt: fs.statSync(path.join(dir, f)).mtime.toISOString()
  }));
  ok(res, { items: files });
}
async function backupRestore(req, res) {
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
}
async function exportData(req, res, query) {
  const d = readData();
  const type = query.type || 'users';
  const map = {
    users: d.users.map(({ passwordHash, ...u }) => u),
    websites: d.websites,
    orders: d.orders,
    transactions: d.transactions
  };
  const items = map[type] || [];
  if (query.format === 'csv') {
    if (!items.length) {
      res.writeHead(200, { 'Content-Type': 'text/csv' });
      return res.end('');
    }
    const cols = Object.keys(items[0]);
    const csv = [cols.join(',')]
      .concat(items.map(it => cols.map(c => `"${String(it[c] ?? '').replace(/"/g,'""')}"`).join(',')))
      .join('\n');
    res.writeHead(200, {
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="awebshop-${type}.csv"`
    });
    return res.end(csv);
  }
  ok(res, { items });
}
async function importData(req, res) {
  const body = await readBody(req);
  const type = body.type; // users | websites | orders | transactions
  const items = Array.isArray(body.items) ? body.items : [];
  if (!['users','websites','orders','transactions'].includes(type)) {
    return err(res, 400, 'Invalid type.', 'INVALID');
  }
  await update(d => {
    const key = type;
    // merge by id / webId
    items.forEach(item => {
      if (type === 'users') {
        if (!item.id) return;
        const idx = d.users.findIndex(u => u.id === item.id);
        if (idx >= 0) d.users[idx] = { ...d.users[idx], ...item };
        else d.users.push(item);
      } else if (type === 'websites') {
        if (!item.webId) return;
        const idx = d.websites.findIndex(w => w.webId === item.webId);
        if (idx >= 0) d.websites[idx] = { ...d.websites[idx], ...item };
        else d.websites.push(item);
      } else {
        const idField = 'id';
        if (!item[idField]) return;
        const idx = d[key].findIndex(x => x[idField] === item[idField]);
        if (idx >= 0) d[key][idx] = { ...d[key][idx], ...item };
        else d[key].push(item);
      }
    });
    return d;
  });
  await logAdmin(req, 'import', null, { type, count: items.length });
  ok(res, { message: `Imported ${items.length} ${type}.` });
}

// =========================================================
// SECURITY
// =========================================================
async function securityList(req, res) {
  const d = readData();
  ok(res, {
    securityLogs: (d.securityLogs || []).slice(-200),
    loginAttempts: (d.loginAttempts || []).slice(-200),
    blockedIps: d.settings.blockedIps || [],
    passwordPolicy: d.settings.passwordPolicy || { minLength: 8, requireUppercase: false, requireNumber: false }
  });
}
async function securityUpdate(req, res) {
  const body = await readBody(req);
  await update(d => {
    if (Array.isArray(body.blockedIps)) d.settings.blockedIps = body.blockedIps;
    if (body.passwordPolicy) d.settings.passwordPolicy = { ...d.settings.passwordPolicy, ...body.passwordPolicy };
    if (typeof body.rateLimitEnabled === 'boolean') d.settings.rateLimitEnabled = body.rateLimitEnabled;
    if (typeof body.captchaEnabled === 'boolean') d.settings.captchaEnabled = body.captchaEnabled;
    return d;
  });
  await logAdmin(req, 'security_update');
  ok(res, { message: 'Updated.' });
}
async function securityLogAdd(req, res) {
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
}

// =========================================================
// SEO / TELEGRAM SETTINGS
// =========================================================
async function seoGet(req, res) {
  ok(res, { seo: readData().settings.seo || {} });
}
async function seoUpdate(req, res) {
  const body = await readBody(req);
  await update(d => {
    d.settings.seo = { ...(d.settings.seo || {}), ...body };
    return d;
  });
  await logAdmin(req, 'seo_update');
  ok(res, { message: 'Updated.' });
}
async function telegramGet(req, res) {
  const s = readData().settings;
  ok(res, { telegram: s.telegramSettings || { enabled: false, messageTemplates: {} } });
}
async function telegramUpdate(req, res) {
  const body = await readBody(req);
  await update(d => {
    d.settings.telegramSettings = { ...(d.settings.telegramSettings || {}), ...body };
    return d;
  });
  await logAdmin(req, 'telegram_update');
  ok(res, { message: 'Updated.' });
}
async function telegramTest(req, res) {
  const { sendMessage } = require('../services/telegramService');
  const config = require('../../config');
  if (!config.telegram.adminChatId) return err(res, 400, 'Admin chat ID not configured.', 'NO_CHAT');
  const r = await sendMessage(config.telegram.adminChatId, '✅ AWebShop test message — Telegram is working.');
  if (r.ok) ok(res, { message: 'Test sent.' });
  else err(res, 500, 'Telegram send failed.', 'TG_FAIL');
}

// =========================================================
// MAINTENANCE
// =========================================================
async function maintenanceGet(req, res) {
  const s = readData().settings;
  ok(res, {
    enabled: !!s.maintenanceMode,
    message: s.maintenanceMessage || '',
    startAt: s.maintenanceStart || null,
    endAt: s.maintenanceEnd || null,
    whitelist: s.maintenanceWhitelist || []
  });
}
async function maintenanceUpdate(req, res) {
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
}

module.exports = {
  // stats / logs
  stats, logs, analytics,
  // users
  usersList, blockUser, softDeleteUser, restoreUser, assignBadge, unassignBadge,
  // admins
  adminsList, adminsCreate, adminsUpdate, adminsDelete,
  // websites
  websitesList, websiteUpdate, websiteDelete,
  // escrow
  escrowList, escrowUpdate,
  // withdraw
  withdrawList, withdrawApprove,
  // payments
  transactionsList, verifyPayment,
  // cards
  cardsList, cardsCreate, cardsUpdate, cardsDelete,
  // promocodes
  promocodesList, promocodesCreate, promocodesUpdate, promocodesDelete,
  // discounts
  discountsList, discountsCreate, discountsUpdate, discountsDelete,
  // events
  eventsList, eventsCreate, eventsUpdate, eventsDelete,
  // announcements
  announcementsList, announcementsCreate, announcementsDelete,
  // reviews
  reviewsList, reviewsUpdate, reviewsDelete,
  // featured
  featuredList, featuredToggle,
  // badges
  badgesList, badgesCreate, badgesUpdate, badgesDelete,
  // moderation
  wordsList, wordsUpdate,
  // settings
  settingsGet, settingsUpdate,
  // prices
  pricesGet, pricesUpdate,
  // premium
  premiumPlansList, premiumPlansUpdate, premiumSubscriptionsList, premiumSubscriptionUpdate,
  // force-sub
  forceSubList, forceSubCreate, forceSubUpdate, forceSubDelete,
  // environment
  envList, envCreate, envDelete,
  // messages
  messagesList, messagesUpdate, messagesDelete,
  // todo
  todoList, todoCreate, todoUpdate, todoDelete,
  // schedule
  scheduleList, scheduleCreate, scheduleDelete,
  // popup
  popupList, popupCreate, popupUpdate, popupDelete,
  // notifications
  notificationsList, notificationsCreate, notificationsDelete,
  // backup / export / import
  backup, backupList, backupRestore, exportData, importData,
  // security
  securityList, securityUpdate, securityLogAdd,
  // seo / telegram
  seoGet, seoUpdate, telegramGet, telegramUpdate, telegramTest,
  // maintenance
  maintenanceGet, maintenanceUpdate
};
async function usersCreate(req, res) {
  const body = await readBody(req);
  const { hashPassword } = require('../utils/helpers');
  const { generateUserId } = require('../utils/idGenerator');

  const nickname = sanitizeString(body.nickname, 20);
  const password = String(body.password || '');
  const customId = body.customId ? sanitizeString(body.customId, 20) : null;

  if (!nickname || password.length < 8) {
    return err(res, 400, 'Invalid nickname or password.', 'INVALID');
  }

  const d = readData();
  if (d.users.some(u => u.nickname.toLowerCase() === nickname.toLowerCase())) {
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
      id,
      nickname,
      passwordHash: hashPassword(password),
      telegramUsername: sanitizeString(body.telegramUsername || '', 64),
      telegramId: sanitizeString(body.telegramId || '', 20),
      phone: sanitizeString(body.phone || '', 20),
      email: null,
      role: ['user','moderator','admin'].includes(body.role) ? body.role : 'user',
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
    });
    return dd;
  });

  await logAdmin(req, 'user_create', id, { nickname });
  ok(res, { message: 'User created.', userId: id });
}