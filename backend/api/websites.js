const { readData, update } = require('../utils/db');
const { validateWebsite } = require('../utils/validators');
const { generateWebId, generateOrderId, uniqueId } = require('../utils/idGenerator');
const {
  sanitizeString,
  now,
  normalizeDomain,
  descriptionLength
} = require('../utils/helpers');
const { fees } = require('../../config');
const { notifyUser } = require('../services/telegramService');
const { uzsToUsd } = require('../services/tokenService');

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

function moderate(data, payload) {
  const banned = (data.settings.moderation?.bannedWords || []).map(w => w.toLowerCase());
  const unsalable = (data.settings.moderation?.unsalableDomains || []).map(d => d.toLowerCase());
  const domain = normalizeDomain(payload.domain);

  const haystack = [
    payload.name,
    payload.description,
    payload.topic
  ]
    .join(' ')
    .toLowerCase();

  for (const word of banned) {
    if (!word) continue;
    const re = new RegExp(`\\b${word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
    if (re.test(haystack)) {
      return `Blocked word detected: "${word}"`;
    }
  }

  for (const blocked of unsalable) {
    if (domain === blocked || domain.endsWith('.' + blocked) || domain.startsWith(blocked + '.')) {
      return `This domain cannot be sold on AWebShop.`;
    }
  }
  return null;
}

async function list(req, res, query) {
  const data = readData();
  const page = Math.max(1, parseInt(query.page || '1', 10));
  const perPage = Math.min(60, Math.max(1, parseInt(query.perPage || '30', 10)));
  const search = (query.search || '').toLowerCase();
  const topic = query.topic || '';
  const sort = query.sort || 'newest';
  const saleType = query.saleType || '';

  let items = data.websites.filter(w => w.status === 'active');

  if (search) {
    items = items.filter(
      w =>
        w.name.toLowerCase().includes(search) ||
        w.description.toLowerCase().includes(search) ||
        w.domain.toLowerCase().includes(search)
    );
  }
  if (topic) items = items.filter(w => w.topic === topic);
  if (saleType) items = items.filter(w => w.saleType === saleType);

  if (sort === 'price_asc') items.sort((a, b) => a.priceUZS - b.priceUZS);
  else if (sort === 'price_desc') items.sort((a, b) => b.priceUZS - a.priceUZS);
  else if (sort === 'popular') items.sort((a, b) => (b.views || 0) - (a.views || 0));
  else items.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  const total = items.length;
  const paged = items.slice((page - 1) * perPage, page * perPage);

  send(res, 200, {
    success: true,
    data: {
      items: paged.map(publicWebsite),
      total,
      page,
      perPage,
      totalPages: Math.ceil(total / perPage)
    }
  });
}

function publicWebsite(w) {
  return {
    webId: w.webId,
    name: w.name,
    domain: w.domain,
    description: w.description,
    topic: w.topic,
    imageUrl: w.imageUrl,
    priceUZS: w.priceUZS,
    priceUSD: w.priceUSD,
    priceAWC: w.priceAWC,
    saleType: w.saleType,
    status: w.status,
    views: w.views,
    rating: w.rating || 0,
    createdAt: w.createdAt
  };
}

async function detail(req, res, webId) {
  let website = null;
  update(data => {
    const w = data.websites.find(x => x.webId === webId);
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
  const data = readData();
  const seller = data.users.find(u => u.id === website.sellerId);
  send(res, 200, {
    success: true,
    data: {
      website: publicWebsite(website),
      seller: seller
        ? {
            id: seller.id,
            nickname: seller.nickname,
            rating: seller.rating,
            verified: seller.verified,
            createdAt: seller.createdAt
          }
        : null
    }
  });
}

async function create(req, res) {
  const body = await readBody(req);
  const errors = validateWebsite(body);
  if (errors.length) {
    return send(res, 400, {
      success: false,
      message: errors.join(' '),
      code: 'VALIDATION_ERROR'
    });
  }

  const dataNow = readData();
  const reason = moderate(dataNow, body);
  if (reason) {
    return send(res, 400, {
      success: false,
      message: reason,
      code: 'MODERATION_REJECTED'
    });
  }

  const priceUZS = Math.round(Number(body.price));
  const priceUSD = uzsToUsd(priceUZS);
  const priceAWC = +(priceUZS / (dataNow.settings.awcPriceUZS || 10000)).toFixed(4);

  let created = null;
  await update(data => {
    const webId = generateWebId();
    const orderId = generateOrderId();
    const w = {
      webId,
      orderId,
      sellerId: req.user.userId,
      name: sanitizeString(body.name, 100),
      domain: normalizeDomain(body.domain),
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

  send(res, 201, {
    success: true,
    data: { website: publicWebsite(created) }
  });
}

async function buy(req, res, webId) {
  const body = await readBody(req);
  const buyer = readData().users.find(u => u.id === req.user.userId);
  const website = readData().websites.find(w => w.webId === webId);

  if (!website || website.status !== 'active') {
    return send(res, 404, {
      success: false,
      message: 'Website is not available.',
      code: 'NOT_AVAILABLE'
    });
  }
  if (website.sellerId === req.user.userId) {
    return send(res, 400, {
      success: false,
      message: 'You cannot buy your own listing.',
      code: 'SELF_PURCHASE'
    });
  }

  const orderId = uniqueId('ord', readData().orders.map(o => o.id));
  let order = null;
  await update(data => {
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
        id: escrowId,
        websiteId: webId,
        orderId,
        buyerId: buyer.id,
        sellerId: website.sellerId,
        amountUZS: website.priceUZS,
        amountUSD: website.priceUSD,
        status: 'pending',
        adminNotes: '',
        createdAt: now(),
        updatedAt: now()
      });
      order.escrowId = escrowId;
    }

    website.status = 'pending_payment';
    return data;
  });

  await notifyUser(buyer.telegramId, `🛒 New order: ${website.name} (${website.domain}). Order ID: ${orderId}`);
  const seller = readData().users.find(u => u.id === website.sellerId);
  if (seller) await notifyUser(seller.telegramId, `🔔 Someone wants to buy "${website.name}". Order ID: ${orderId}`);

  send(res, 201, { success: true, data: { order } });
}

async function search(req, res, query) {
  return list(req, res, query);
}

module.exports = { list, detail, create, buy, search, publicWebsite };