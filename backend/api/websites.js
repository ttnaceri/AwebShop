// backend/api/websites.js
// AWebShop — Websites API: list, search, detail, create, buy.
// AWC to'liq integratsiya + 3-strike system + ban checks.

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

// ============================================================
// HELPERS
// ============================================================
function safeUzsToUsd(uzs) {
  try {
    return require('../services/tokenService').uzsToUsd(uzs);
  } catch (_) {
    return +(Number(uzs || 0) / 12650).toFixed(4);
  }
}

function safeGetAwcRate() {
  try {
    const d = readData();
    return (d.settings && d.settings.awcPriceUZS) || 10000;
  } catch (_) { return 10000; }
}

function safeGetListingFee() {
  try {
    const d = readData();
    return (d.settings && d.settings.listingFeeUZS) || 10000;
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
      transactions: Array.isArray(d.transactions) ? d.transactions : [],
      settings: d.settings || {},
      all: d
    };
  } catch (e) {
    console.error('[websites:safeReadData]', e.message);
    return { users: [], websites: [], orders: [], escrows: [], transactions: [], settings: {}, all: {} };
  }
}

// Xavfsiz AWC operatsiyalari (tokenService mavjud bo'lmasa, fallback)
async function adjustUserBalance(userId, deltaAWC) {
  try {
    return await update(data => {
      const u = data.users.find(x => x.id === userId);
      if (!u) return data;
      u.balanceAWC = +(u.balanceAWC + deltaAWC).toFixed(4);
      u.updatedAt = now();
      return data;
    });
  } catch (e) {
    console.error('[websites:adjustBalance]', e.message);
  }
}

async function recordTx(userId, type, meta) {
  try {
    const { recordTransaction } = require('../services/tokenService');
    return await recordTransaction(userId, type, meta);
  } catch (e) {
    console.warn('[websites:recordTx]', e.message);
    // Fallback: to'g'ridan-to'g'ri yozish
    try {
      await update(data => {
        if (!Array.isArray(data.transactions)) data.transactions = [];
        data.transactions.push({
          id: 'tx_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
          userId,
          type,
          amountAWC: meta.amountAWC || 0,
          amountUSD: meta.amountUSD || 0,
          amountUZS: meta.amountUZS || 0,
          status: meta.status || 'completed',
          description: meta.description || '',
          referenceId: meta.referenceId || null,
          paymentMethod: meta.paymentMethod || null,
          adminNotes: '',
          createdAt: now(),
          updatedAt: now()
        });
        return data;
      });
    } catch (_) {}
  }
}

// ============================================================
// PUBLIC WEBSITE (frontendga ko'rinadigan maydonlar)
// ============================================================
function publicWebsite(w) {
  return {
    webId: w.webId || '',
    name: w.name || '',
    domain: w.domain || '',
    type: w.type || 'frontend',
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
// MODERATSIYA
// ============================================================
function moderate(settings, payload) {
  const mod = (settings && settings.moderation) || {};
  const banned = (mod.bannedWords || []).map(w => String(w).toLowerCase());
  const unsalable = (mod.unsalableDomains || []).map(d => String(d).toLowerCase());

  const domain = normalizeDomain(payload.domain || '');
  const haystack = [
    payload.name || '',
    payload.description || '',
    payload.topic || ''
  ].join(' ').toLowerCase();

  // Banned words — so'z chegarasi bilan
  for (const word of banned) {
    if (!word) continue;
    try {
      const re = new RegExp(`\\b${word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
      if (re.test(haystack)) {
        return {
          reason: `Blocked word detected: "${word}"`,
          code: 'BANNED_WORD'
        };
      }
    } catch (_) {}
  }

  // Unsalable domains — aniq mos kelish
  for (const blocked of unsalable) {
    if (!blocked) continue;
    if (domain === blocked ||
        domain.endsWith('.' + blocked) ||
        domain.startsWith(blocked + '.')) {
      return {
        reason: `Domain "${blocked}" cannot be sold on AWebShop.`,
        code: 'UNSALABLE_DOMAIN'
      };
    }
  }

  return null;
}

// ============================================================
// BAN / BLOCK TEKSHIRUVI
// ============================================================
function checkUserBlocked(user) {
  if (!user) return null;

  if (user.banned) {
    return {
      code: 'ACCOUNT_BANNED',
      message: 'Your account has been permanently banned.',
      until: null
    };
  }

  if (user.blocked && user.blockedUntil) {
    const until = new Date(user.blockedUntil).getTime();
    if (until > Date.now()) {
      return {
        code: 'ACCOUNT_TEMP_BLOCKED',
        message: 'Your account is temporarily blocked.',
        until: user.blockedUntil
      };
    }
  }

  return null;
}

// ============================================================
// LIST — Store sahifasi
// ============================================================
async function list(req, res, query) {
  try {
    const data = safeReadData();
    const page = Math.max(1, parseInt(query.page || '1', 10) || 1);
    const perPage = Math.min(60, Math.max(1, parseInt(query.perPage || '30', 10) || 30));
    const search = String(query.search || '').toLowerCase();
    const topic = String(query.topic || '');
    const type = String(query.type || '');
    const sort = String(query.sort || 'newest');
    const saleType = String(query.saleType || '');

    // Faqat active websites
    let items = data.websites.filter(w => w && w.status === 'active');

    if (search) {
      items = items.filter(w =>
        (w.name || '').toLowerCase().includes(search) ||
        (w.description || '').toLowerCase().includes(search) ||
        (w.domain || '').toLowerCase().includes(search)
      );
    }
    if (topic) items = items.filter(w => w.topic === topic);
    if (type) items = items.filter(w => w.type === type);
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
        total,
        page,
        perPage,
        totalPages: Math.ceil(total / perPage) || 1
      }
    });
  } catch (e) {
    console.error('[websites:list]', e.stack || e.message);
    send(res, 500, {
      success: false,
      message: 'Failed to load websites.',
      code: 'WEBSITES_LIST_ERROR'
    });
  }
}

async function search(req, res, query) {
  return list(req, res, query);
}

// ============================================================
// DETAIL — bitta website
// ============================================================
async function detail(req, res, webId) {
  try {
    let website = null;

    await update(data => {
      if (!Array.isArray(data.websites)) data.websites = [];
      const w = data.websites.find(x => x && x.webId === webId);
      if (w) {
        w.views = (w.views || 0) + 1;
        website = { ...w };
      }
      return data;
    });

    if (!website) {
      return send(res, 404, {
        success: false,
        message: 'Website not found.',
        code: 'NOT_FOUND'
      });
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
    send(res, 500, {
      success: false,
      message: 'Failed to load website.',
      code: 'WEBSITE_DETAIL_ERROR'
    });
  }
}

// ============================================================
// CREATE — yangi listing (listing fee AWC yechiladi)
// ============================================================
async function create(req, res) {
  try {
    const body = await readBody(req);

    // 1. Validatsiya
    const errors = validateWebsite(body);
    if (errors.length) {
      return send(res, 400, {
        success: false,
        message: errors.join(' '),
        code: 'VALIDATION_ERROR'
      });
    }

    const dataNow = safeReadData();
    const user = dataNow.users.find(u => u.id === req.user.userId);

    if (!user) {
      return send(res, 404, {
        success: false,
        message: 'User not found.',
        code: 'NOT_FOUND'
      });
    }

    // 2. Ban tekshiruvi
    const block = checkUserBlocked(user);
    if (block) {
      return send(res, 403, {
        success: false,
        message: block.message,
        code: block.code,
        data: { blockedUntil: block.until }
      });
    }

    // 3. Moderatsiya
    const modResult = moderate(dataNow.settings, body);
    if (modResult) {
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

      // Telegram ogohlantirish
      try {
        if (user.telegramId && require('../services/telegramService').enabled()) {
          const { notifyUser } = require('../services/telegramService');
          if (blockedUntil) {
            await notifyUser(user.telegramId,
              `🚫 You have been blocked for 24 hours.\nReason: ${modResult.reason}\nUnblock at: ${new Date(blockedUntil).toLocaleString()}`);
          } else {
            await notifyUser(user.telegramId,
              `⚠️ Warning ${newStrikes}/3\nReason: ${modResult.reason}\n3 warnings = 24h block.`);
          }
        }
      } catch (_) {}

      if (blockedUntil) {
        return send(res, 403, {
          success: false,
          message: `Blocked 24 hours. Unblock at ${new Date(blockedUntil).toLocaleString()}`,
          code: 'BLOCKED_TEMP',
          data: { blockedUntil, strikes: 3 }
        });
      }

      return send(res, 400, {
        success: false,
        message: `${modResult.reason} (Warning ${newStrikes}/3)`,
        code: 'MODERATION_REJECTED',
        data: { strikes: newStrikes, remaining: 3 - newStrikes }
      });
    }

    // 4. AWC balans tekshiruvi (listing fee)
    const listingFee = safeGetListingFee();
    const awcRate = safeGetAwcRate();
    const feeAWC = +(listingFee / awcRate).toFixed(4);

    if (user.balanceAWC < feeAWC) {
      return send(res, 400, {
        success: false,
        message: `Insufficient AWC balance for listing fee. Required: ${feeAWC} AWC (${listingFee} UZS), you have: ${user.balanceAWC} AWC.`,
        code: 'INSUFFICIENT_AWC'
      });
    }

    // 5. Price hisoblash
    const priceUZS = Math.round(Number(body.price));
    const priceUSD = safeUzsToUsd(priceUZS);
    const priceAWC = +(priceUZS / awcRate).toFixed(4);

    // 6. Website yaratish + AWC yechish (atomar)
    let created = null;

    await update(data => {
      if (!Array.isArray(data.websites)) data.websites = [];
      if (!Array.isArray(data.transactions)) data.transactions = [];

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

      // AWC yechish
      const u = data.users.find(x => x.id === req.user.userId);
      if (u) {
        u.balanceAWC = +(u.balanceAWC - feeAWC).toFixed(4);
        u.totalSpent = (u.totalSpent || 0) + listingFee;
        u.updatedAt = now();
      }

      // Transaction yozish
      data.transactions.push({
        id: 'tx_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
        userId: req.user.userId,
        type: 'listing_fee',
        amountAWC: -feeAWC,
        amountUZS: -listingFee,
        amountUSD: 0,
        status: 'completed',
        description: `Listing fee: ${w.name}`,
        referenceId: w.webId,
        paymentMethod: 'AWC',
        adminNotes: '',
        createdAt: now(),
        updatedAt: now()
      });

      return data;
    });

    console.log(`[websites:create] ✅ ${created.webId} (${created.name}) — fee: ${feeAWC} AWC`);

    // Telegram bildirishnoma
    try {
      const { enabled, notifyUser } = require('../services/telegramService');
      if (enabled() && user.telegramId) {
        await notifyUser(user.telegramId,
          `Hello Dear <b>${user.nickname}</b>\nYou Are Selling Web site.\nThank You For Support us!\nIf you need help, we are ready to help you.\n\nby: UPDATE Inc.`);
      }
    } catch (_) {}

    send(res, 201, {
      success: true,
      data: {
        website: publicWebsite(created),
        feeCharged: feeAWC,
        newBalance: (user.balanceAWC - feeAWC).toFixed(4)
      }
    });
  } catch (e) {
    console.error('[websites:create]', e.stack || e.message);
    send(res, 500, {
      success: false,
      message: 'Failed to create website.',
      code: 'WEBSITE_CREATE_ERROR'
    });
  }
}

// ============================================================
// BUY — website sotib olish (AWC transfer)
// ============================================================
async function buy(req, res, webId) {
  try {
    const data1 = safeReadData();
    const buyer = data1.users.find(u => u && u.id === req.user.userId);
    const website = data1.websites.find(w => w && w.webId === webId);

    if (!buyer) {
      return send(res, 404, { success: false, message: 'Buyer not found.', code: 'NOT_FOUND' });
    }

    // 1. Buyer ban tekshiruvi
    const block = checkUserBlocked(buyer);
    if (block) {
      return send(res, 403, {
        success: false,
        message: block.message,
        code: block.code,
        data: { blockedUntil: block.until }
      });
    }

    // 2. Website mavjudligi
    if (!website || website.status !== 'active') {
      return send(res, 404, {
        success: false,
        message: 'Website is not available.',
        code: 'NOT_AVAILABLE'
      });
    }

    // 3. O'zini sotib olishni taqiqlash
    if (website.sellerId === req.user.userId) {
      return send(res, 400, {
        success: false,
        message: 'You cannot buy your own listing.',
        code: 'SELF_PURCHASE'
      });
    }

    // 4. Sotuvchi mavjudligi
    const seller = data1.users.find(u => u && u.id === website.sellerId);
    if (!seller) {
      return send(res, 404, {
        success: false,
        message: 'Seller not found.',
        code: 'SELLER_NOT_FOUND'
      });
    }

    // 5. AWC balans tekshiruvi (buyer)
    const awcRate = safeGetAwcRate();
    const requiredAWC = +(website.priceUZS / awcRate).toFixed(4);

    if (buyer.balanceAWC < requiredAWC) {
      return send(res, 400, {
        success: false,
        message: `Insufficient AWC. Required: ${requiredAWC} AWC (${website.priceUZS} UZS), you have: ${buyer.balanceAWC} AWC. Top up your wallet first.`,
        code: 'INSUFFICIENT_AWC',
        data: { required: requiredAWC, available: buyer.balanceAWC }
      });
    }

    // 6. Order yaratish + AWC transfer (atomar)
    let order = null;

    await update(data => {
      if (!Array.isArray(data.orders)) data.orders = [];
      if (!Array.isArray(data.escrows)) data.escrows = [];
      if (!Array.isArray(data.transactions)) data.transactions = [];

      const orderId = uniqueId('ord', data.orders.map(o => o.id));

      order = {
        id: orderId,
        websiteWebId: webId,
        buyerId: buyer.id,
        sellerId: website.sellerId,
        amountUZS: website.priceUZS,
        amountUSD: website.priceUSD,
        amountAWC: requiredAWC,
        saleType: website.saleType,
        status: 'completed', // Fast to'lov, darhol
        escrowId: null,
        createdAt: now(),
        updatedAt: now()
      };

      // Safe bo'lsa — escrow yaratish
      if (website.saleType === 'safe') {
        const escrowId = uniqueId('esc', data.escrows.map(e => e.id));
        data.escrows.push({
          id: escrowId,
          websiteId: webId,
          orderId,
          buyerId: buyer.id,
          sellerId: website.sellerId,
          amountUZS: website.priceUZS,
          amountUSD: website.priceUSD,
          amountAWC: requiredAWC,
          status: 'pending',
          adminNotes: '',
          createdAt: now(),
          updatedAt: now()
        });
        order.escrowId = escrowId;
        order.status = 'pending_escrow';
      } else {
        // Fast: darhol sotuvchiga o'tkazish
        const b = data.users.find(x => x.id === buyer.id);
        const s = data.users.find(x => x.id === seller.id);

        if (b && s) {
          b.balanceAWC = +(b.balanceAWC - requiredAWC).toFixed(4);
          s.balanceAWC = +(s.balanceAWC + requiredAWC).toFixed(4);
          b.totalSpent = (b.totalSpent || 0) + website.priceUZS;
          s.totalEarned = (s.totalEarned || 0) + website.priceUZS;

          // Buyer transaction
          data.transactions.push({
            id: 'tx_' + Date.now().toString(36) + 'b' + Math.random().toString(36).slice(2, 5),
            userId: b.id,
            type: 'purchase',
            amountAWC: -requiredAWC,
            amountUZS: -website.priceUZS,
            status: 'completed',
            description: `Bought: ${website.name}`,
            referenceId: orderId,
            paymentMethod: 'AWC',
            createdAt: now(),
            updatedAt: now()
          });

          // Seller transaction
          data.transactions.push({
            id: 'tx_' + Date.now().toString(36) + 's' + Math.random().toString(36).slice(2, 5),
            userId: s.id,
            type: 'sale_income',
            amountAWC: requiredAWC,
            amountUZS: website.priceUZS,
            status: 'completed',
            description: `Sold: ${website.name}`,
            referenceId: orderId,
            paymentMethod: 'AWC',
            createdAt: now(),
            updatedAt: now()
          });
        }
      }

      data.orders.push(order);

      // Website'ni sold qilish
      const w = data.websites.find(x => x && x.webId === webId);
      if (w) {
        w.status = 'sold';
        w.soldAt = now();
        w.updatedAt = now();
      }

      return data;
    });

    console.log(`[websites:buy] ✅ Order ${order.id} — ${requiredAWC} AWC`);

    // Telegram bildirishnomalar
    try {
      const { enabled, notifyUser } = require('../services/telegramService');
      if (enabled()) {
        if (buyer.telegramId) {
          await notifyUser(buyer.telegramId,
            `Hello Dear <b>${buyer.nickname}</b>.\nYou are Purchased New Web Site.\nIf you need help, we are ready to help you.\n\nby: UPDATE Inc.`);
        }
        if (seller.telegramId) {
          await notifyUser(seller.telegramId,
            `🔔 Someone bought "<b>${website.name}</b>"!\n+${requiredAWC} AWC added to your balance.\nOrder ID: <code>${order.id}</code>`);
        }
      }
    } catch (_) {}

    send(res, 201, {
      success: true,
      data: {
        order,
        newBalance: (buyer.balanceAWC - requiredAWC).toFixed(4)
      }
    });
  } catch (e) {
    console.error('[websites:buy]', e.stack || e.message);
    send(res, 500, {
      success: false,
      message: 'Failed to create order.',
      code: 'WEBSITE_BUY_ERROR'
    });
  }
}

// ============================================================
// EXPORTS
// ============================================================
module.exports = {
  list,
  search,
  detail,
  create,
  buy,
  publicWebsite
};