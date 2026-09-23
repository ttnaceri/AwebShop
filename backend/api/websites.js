// backend/api/websites.js
// Websites API: list, search, detail, create, buy, strike tracking.
// Node.js v20/v24 uchun mos.

'use strict';

const { readData, update } = require('../utils/db');
const { validateWebsite } = require('../utils/validators');
const { generateWebId, generateOrderId, uniqueId } = require('../utils/idGenerator');
const {
  sanitizeString,
  now,
  normalizeDomain,
  descriptionLength
} = require('../utils/helpers');
const { notifyUser } = require('../services/telegramService');

// ============================================================
// HELPERS
// ============================================================
function safeUzsToUsd(uzs) {
  try {
    const { uzsToUsd } = require('../services/tokenService');
    return uzsToUsd(uzs);
  } catch (_) {
    const rate = 12650;
    return +(Number(uzs || 0) / rate).toFixed(4);
  }
}

function safeGetAwcRate() {
  try {
    const d = readData();
    return (d.settings && d.settings.awcPriceUZS) || 10000;
  } catch (_) { return 10000; }
}

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

function safeReadData() {
  try {
    const d = readData();
    return {
      users: Array.isArray(d.users) ? d.users : [],
      websites: Array.isArray(d.websites) ? d.websites : [],
      orders: Array.isArray(d.orders) ? d.orders : [],
      escrows: Array.isArray(d.escrows) ? d.escrows : [],
      settings: d.settings || {},
      all: d
    };
  } catch (e) {
    console.error('[websites:safeReadData]', e.message);
    return { users: [], websites: [], orders: [], escrows: [], settings: {}, all: {} };
  }
}

function publicWebsite(w) {
  return {
    webId: w.webId || '',
    name: w.name || '',
    domain: w.domain || '',
    type: w.type || 'frontend',              // ← YANGI
    description: w.description || '',
    topic: w.topic || '',
    imageUrl: w.imageUrl || '',
    priceUZS: w.priceUZS || 0,
    priceUSD: w.priceUSD || 0,
    priceAWC: w.priceAWC || 0,
    saleType: w.saleType || 'fast',
    status: w.status || 'active',
    views: w.views || 0,
    rating: w.rating || 0,
    createdAt: w.createdAt || null
  };
}

// ============================================================
// MODERATION
// ============================================================
function moderate(settings, payload) {
  const mod = (settings && settings.moderation) || {};
  const banned = (mod.bannedWords || []).map(w => String(w).toLowerCase());
  const unsalable = (mod.unsalableDomains || []).map(d => String(d).toLowerCase());

  const domain = normalizeDomain(payload.domain || '');
  const haystack = [payload.name || '', payload.description || '', payload.topic || '']
    .join(' ').toLowerCase();

  for (const word of banned) {
    if (!word) continue;
    const re = new RegExp(`\\b${word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
    if (re.test(haystack)) {
      return { reason: `Blocked word detected: "${word}"`, code: 'BANNED_WORD' };
    }
  }

  for (const blocked of unsalable) {
    if (!blocked) continue;
    if (domain === blocked || domain.endsWith('.' + blocked) || domain.startsWith(blocked + '.')) {
      return { reason: 'This domain cannot be sold on AWebShop.', code: 'UNSALABLE_DOMAIN' };
    }
  }

  return null;
}

// ============================================================
// CHECK USER BAN/BLOCK
// ============================================================
function checkUserBlocked(user) {
  if (!user) return null;

  // Permanent ban
  if (user.banned) {
    return {
      code: 'ACCOUNT_BANNED',
      message: 'Your account has been permanently banned.',
      until: null
    };
  }

  // Temporary block
  if (user.blocked && user.blockedUntil) {
    const until = new Date(user.blockedUntil).getTime();
    if (until > Date.now()) {
      return {
        code: 'ACCOUNT_TEMP_BLOCKED',
        message: `Your account is temporarily blocked.`,
        until: user.blockedUntil
      };
    }
  }

  return null;
}

// ============================================================
// LIST
// ============================================================
async function list(req, res, query) {
  try {
    const data = safeReadData();
    const page = Math.max(1, parseInt(query.page || '1', 10) || 1);
    const perPage = Math.min(60, Math.max(1, parseInt(query.perPage || '30', 10) || 30));
    const search = String(query.search || '').toLowerCase();
    const topic = String(query.topic || '');
    const type = String(query.type || '');      // ← YANGI
    const sort = String(query.sort || 'newest');
    const saleType = String(query.saleType || '');

    let items = data.websites.filter(w => w && w.status === 'active');

    if (search) {
      items = items.filter(w =>
        (w.name || '').toLowerCase().includes(search) ||
        (w.description || '').toLowerCase().includes(search) ||
        (w.domain || '').toLowerCase().includes(search)
      );
    }
    if (topic) items = items.filter(w => w.topic === topic);
    if (type) items = items.filter(w => w.type === type);       // ← YANGI
    if (saleType) items = items.filter(w => w.saleType === saleType);

    if (sort === 'price_asc') items.sort((a, b) => (a.priceUZS || 0) - (b.priceUZS || 0));
    else if (sort === 'price_desc') items.sort((a, b) => (b.priceUZS || 0) - (a.priceUZS || 0));
    else if (sort === 'popular') items.sort((a, b) => (b.views || 0) - (a.views || 0));
    else items.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));

    const total = items.length;
    const paged = items.slice((page - 1) * perPage, page * perPage);

    send(res, 200, {
      success: true,
      data: {
        items: paged.map(publicWebsite),
        total, page, perPage,
        totalPages: Math.ceil(total / perPage) || 1
      }
    });
  } catch (e) {
    console.error('[websites:list]', e.stack || e.message);
    send(res, 500, {
      success: false, message: 'Failed to load websites.', code: 'WEBSITES_LIST_ERROR'
    });
  }
}

async function search(req, res, query) { return list(req, res, query); }

// ============================================================
// DETAIL
// ============================================================
async function detail(req, res, webId) {
  try {
    let website = null;

    await update(data => {
      if (!Array.isArray(data.websites)) data.websites = [];
      const w = data.websites.find(x => x && x.webId === webId);
      if (w) { w.views = (w.views || 0) + 1; website = { ...w }; }
      return data;
    });

    if (!website) {
      return send(res, 404, { success: false, message: 'Website not found.', code: 'NOT_FOUND' });
    }

    const data = safeReadData();
    const seller = data.users.find(u => u && u.id === website.sellerId);

    send(res, 200, {
      success: true,
      data: {
        website: publicWebsite(website),
        seller: seller ? {
          id: seller.id,
          nickname: seller.nickname,
          rating: seller.rating || 0,
          verified: seller.verified,
          createdAt: seller.createdAt
        } : null
      }
    });
  } catch (e) {
    console.error('[websites:detail]', e.stack || e.message);
    send(res, 500, { success: false, message: 'Failed.', code: 'WEBSITE_DETAIL_ERROR' });
  }
}

// ============================================================
// CREATE (with strikes + ban)
// ============================================================
async function create(req, res) {
  try {
    const body = await readBody(req);
    const errors = validateWebsite(body);
    if (errors.length) {
      return send(res, 400, {
        success: false, message: errors.join(' '), code: 'VALIDATION_ERROR'
      });
    }

    const dataNow = safeReadData();
    const user = dataNow.users.find(u => u.id === req.user.userId);

    if (!user) {
      return send(res, 404, { success: false, message: 'User not found.', code: 'NOT_FOUND' });
    }

    // ---- Ban tekshiruvi ----
    const block = checkUserBlocked(user);
    if (block) {
      return send(res, 403, {
        success: false, message: block.message, code: block.code,
        data: { blockedUntil: block.until }
      });
    }

    // ---- Moderatsiya ----
    const modResult = moderate(dataNow.settings, body);
    if (modResult) {
      // Strike qo'shish
      let newStrikes = 0;
      let blockedUntil = null;

      await update(data => {
        const u = data.users.find(x => x.id === req.user.userId);
        if (!u) return data;
        u.moderationStrikes = u.moderationStrikes || { count: 0, until: null };
        u.moderationStrikes.count = (u.moderationStrikes.count || 0) + 1;
        u.moderationStrikes.lastReason = modResult.reason;
        u.moderationStrikes.lastCode = modResult.code;
        u.moderationStrikes.lastAt = now();
        newStrikes = u.moderationStrikes.count;

        if (newStrikes >= 3) {
          const until = new Date(Date.now() + 24 * 60 * 60 * 1000);
          u.blocked = true;
          u.blockedUntil = until.toISOString();
          u.moderationStrikes.until = until.toISOString();
          u.moderationStrikes.count = 0;
          blockedUntil = u.blockedUntil;
        }

        return data;
      });

      // Telegram bildirishnoma
      try {
        if (user.telegramId) {
          if (blockedUntil) {
            await notifyUser(user.telegramId,
              `🚫 You have been blocked for 24 hours due to repeated violations.\nUnblock at: ${new Date(blockedUntil).toLocaleString()}`);
          } else {
            await notifyUser(user.telegramId,
              `⚠️ Warning ${newStrikes}/3\nReason: ${modResult.reason}\n3 warnings will result in a 24-hour block.`);
          }
        }
      } catch (_) {}

      if (blockedUntil) {
        return send(res, 403, {
          success: false,
          message: `You have been blocked for 24 hours. Unblock at ${new Date(blockedUntil).toLocaleString()}`,
          code: 'BLOCKED_TEMP',
          data: { blockedUntil, strikes: 3 }
        });
      }

      return send(res, 400, {
        success: false,
        message: `${modResult.reason} (Warning ${newStrikes}/3. 3 warnings = 24h block.)`,
        code: 'MODERATION_REJECTED',
        data: { strikes: newStrikes, remaining: 3 - newStrikes }
      });
    }

    // ---- Website yaratish ----
    const priceUZS = Math.round(Number(body.price));
    const priceUSD = safeUzsToUsd(priceUZS);
    const awcRate = safeGetAwcRate();
    const priceAWC = +(priceUZS / awcRate).toFixed(4);

    let created = null;

    await update(data => {
      if (!Array.isArray(data.websites)) data.websites = [];
      const webId = generateWebId();
      const orderId = generateOrderId();

      const w = {
        webId,
        orderId,
        sellerId: req.user.userId,
        name: sanitizeString(body.name, 100),
        domain: normalizeDomain(body.domain),
        type: ['frontend', 'backend', 'fullstack'].includes(body.type) ? body.type : 'frontend',
        description: sanitizeString(body.description, 500),
        descriptionLength: descriptionLength(body.description),
        topic: sanitizeString(body.topic, 50),
        imageUrl: sanitizeString(body.imageUrl || '', 500),
        priceUZS,
        priceUSD,
        priceAWC,
        saleType: body.saleType,
        status: 'active',
        views: 0,
        rating: 0,
        createdAt: now(),
        updatedAt: now(),
        soldAt: null
      };

      data.websites.push(w);
      created = w;
      return data;
    });

    // Telegram notifications
    try {
      if (user.telegramId) {
        await notifyUser(user.telegramId,
          `🛒 <b>Website listed!</b>\n${created.name} (${created.domain})\nWeb ID: <code>${created.webId}</code>\n\nThank you for using AWebShop!`);
      }
    } catch (_) {}

    send(res, 201, { success: true, data: { website: publicWebsite(created) } });
  } catch (e) {
    console.error('[websites:create]', e.stack || e.message);
    send(res, 500, { success: false, message: 'Failed.', code: 'WEBSITE_CREATE_ERROR' });
  }
}

// ============================================================
// BUY
// ============================================================
async function buy(req, res, webId) {
  try {
    const data1 = safeReadData();
    const buyer = data1.users.find(u => u && u.id === req.user.userId);
    const website = data1.websites.find(w => w && w.webId === webId);

    if (!buyer) return send(res, 404, { success: false, message: 'Buyer not found.', code: 'NOT_FOUND' });

    // Ban tekshiruvi
    const block = checkUserBlocked(buyer);
    if (block) {
      return send(res, 403, {
        success: false, message: block.message, code: block.code,
        data: { blockedUntil: block.until }
      });
    }

    if (!website || website.status !== 'active') {
      return send(res, 404, { success: false, message: 'Website is not available.', code: 'NOT_AVAILABLE' });
    }
    if (website.sellerId === req.user.userId) {
      return send(res, 400, { success: false, message: 'You cannot buy your own listing.', code: 'SELF_PURCHASE' });
    }

    let order = null;

    await update(data => {
      if (!Array.isArray(data.orders)) data.orders = [];
      if (!Array.isArray(data.escrows)) data.escrows = [];
      const orderId = uniqueId('ord', data.orders.map(o => o.id));

      order = {
        id: orderId,
        websiteWebId: webId,
        buyerId: buyer.id,
        sellerId: website.sellerId,
        amountUZS: website.priceUZS,
        amountUSD: website.priceUSD,
        saleType: website.saleType,
        status: 'pending_payment',
        escrowId: null,
        createdAt: now(),
        updatedAt: now()
      };
      data.orders.push(order);

      if (website.saleType === 'safe') {
        const escrowId = uniqueId('esc', data.escrows.map(e => e.id));
        data.escrows.push({
          id: escrowId, websiteId: webId, orderId,
          buyerId: buyer.id, sellerId: website.sellerId,
          amountUZS: website.priceUZS, amountUSD: website.priceUSD,
          status: 'pending', adminNotes: '',
          createdAt: now(), updatedAt: now()
        });
        order.escrowId = escrowId;
      }

      const w = data.websites.find(x => x && x.webId === webId);
      if (w) w.status = 'pending_payment';

      return data;
    });

    // Telegram notifications
    try {
      if (buyer.telegramId) {
        await notifyUser(buyer.telegramId,
          `Hello Dear <b>${buyer.nickname}</b>.\nYou are Purchased New Web Site.\nIf you need help, we are ready to help you.\n\nby: UPDATE Inc.`);
      }
      const seller = data1.users.find(u => u && u.id === website.sellerId);
      if (seller && seller.telegramId) {
        await notifyUser(seller.telegramId,
          `🔔 Someone wants to buy "<b>${website.name}</b>".\nOrder ID: <code>${order.id}</code>`);
      }
    } catch (_) {}

    send(res, 201, { success: true, data: { order } });
  } catch (e) {
    console.error('[websites:buy]', e.stack || e.message);
    send(res, 500, { success: false, message: 'Failed.', code: 'WEBSITE_BUY_ERROR' });
  }
}

module.exports = {
  list, search, detail, create, buy, publicWebsite
};