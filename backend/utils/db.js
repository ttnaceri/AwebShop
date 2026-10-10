// backend/utils/db.js
// backend.json ni o'qish/yozish uchun xavfsiz qatlam.
// RAM kesh bilan tezlashtirilgan.

'use strict';

const fs = require('fs');
const path = require('path');

const DATA_PATH = path.join(__dirname, '..', '..', 'data', 'backend.json');
const DATA_DIR  = path.dirname(DATA_PATH);

// RAM kesh
let cachedData = null;
let cachedMtime = 0;

// Yozishni navbatga qo'yish
let writeQueue = Promise.resolve();

// ============================================================
// DEFAULT STRUKTURA
// ============================================================
function defaultData() {
  return {
    users: [],
    admins: [],
    websites: [],
    orders: [],
    transactions: [],
    escrows: [],
    withdrawals: [],
    refunds: [],
    premiumSubscriptions: [],
    premiumPlans: [
      {
        id: 'plan_plus',
        name: 'Plus',
        monthlyPriceUZS: 20000,
        monthlyPriceAWC: 2,
        yearlyPriceUZS: 180000,
        yearlyPriceAWC: 18,
        commission: 3,
        websitesPerMonth: 10,
        badge: false,
        enabled: true,
        features: ['10 websites / month', '3% commission', 'Priority support']
      },
      {
        id: 'plan_prime',
        name: 'Prime',
        monthlyPriceUZS: 40000,
        monthlyPriceAWC: 4,
        yearlyPriceUZS: 360000,
        yearlyPriceAWC: 36,
        commission: 1,
        websitesPerMonth: 20,
        badge: false,
        enabled: true,
        features: ['20 websites / month', '1% commission', 'Priority support']
      },
      {
        id: 'plan_pro',
        name: 'Pro',
        monthlyPriceUZS: 60000,
        monthlyPriceAWC: 6,
        yearlyPriceUZS: 540000,
        yearlyPriceAWC: 54,
        commission: 0.5,
        websitesPerMonth: 30,
        badge: false,
        enabled: true,
        features: ['30 websites / month', '0.5% commission', 'Priority support']
      },
      {
        id: 'plan_enterprise',
        name: 'Enterprise',
        monthlyPriceUZS: 100000,
        monthlyPriceAWC: 10,
        yearlyPriceUZS: 900000,
        yearlyPriceAWC: 90,
        commission: 0,
        websitesPerMonth: 50,
        badge: true,
        enabled: true,
        features: ['50 websites / month', '0% commission', 'Premium badge', 'Dedicated support']
      }
    ],
    promocodes: [],
    discounts: [],
    events: [],
    announcements: [],
    reviews: [],
    messages: [],
    notifications: [],
    paymentCards: [],
    paymentMethods: [
      {
        id: 'pm_manual_card',
        name: 'Manual Card Payment',
        type: 'manual',
        enabled: true,
        provider: null,
        config: {}
      }
    ],
    forceSubscribeChannels: [],
    environmentUsers: [],
    badges: [],
    featuredWebsites: [],
    popupNotifications: [],
    scheduledTasks: [],
    adminLogs: [],
    securityLogs: [],
    verificationCodes: [],
    sessions: [],
    loginAttempts: [],
    userLogs: [],
    webhooks: [],
    forbiddenTelegramIds: [],
    settings: {
      siteName: 'AWebShop',
      logo: 'frontend/assets/image/logo.png',
      favicon: 'frontend/assets/image/favicon.png',
      contactEmail: 'support@awebshop.example',
      footerText: '© 2026 UPDATE Inc. All Rights Reserved.',
      defaultLanguage: 'en',
      defaultCurrency: 'UZS',
      maintenanceMode: false,
      maintenanceMessage: "We'll be back soon.",
      awcPriceUZS: 10000,
      listingFeeUZS: 10000,
      saleCommissionPercent: 5,
      escrowFeePercent: 0.4,
      cashbackPercent: 1,
      premiumCashbackPercent: 3,
      referralBonusAWC: 1,
      rewardedAdsPerFreeListing: 15,
      topics: ['AI', 'Online Shop', '3D Game', 'Other'],
      social: {},
      moderation: {
        bannedWords: ['porn', 'porno', 'bet', '1x', 'xx'],
        unsalableDomains: ['google', 'github', 'chatgpt', 'deepseek']
      },
      seo: {},
      analytics: {},
      telegramSettings: {}
    },
    apiConfig: {
      exchangeRate: {
        lastRate: 12650,
        lastUpdated: null,
        autoUpdate: true
      }
    }
  };
}

// ============================================================
// DIRECTORY
// ============================================================
function ensureDir() {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
      console.log('[db] data/ papkasi yaratildi:', DATA_DIR);
    }
  } catch (e) {
    console.error('[db] data/ papkasini yaratib bo\'lmadi:', e.message);
  }
}

function writeFresh(data) {
  try {
    fs.writeFileSync(DATA_PATH, JSON.stringify(data, null, 2), 'utf8');
    console.log('[db] ✅ backend.json yaratildi/yangilandi:', DATA_PATH);
  } catch (e) {
    console.error('[db] ❌ Yozib bo\'lmadi:', e.message);
  }
}

// ============================================================
// XAVFSIZ O'QISH (RAM kesh bilan)
// ============================================================
function readData() {
  ensureDir();

  // Fayl mavjud emas
  if (!fs.existsSync(DATA_PATH)) {
    console.warn('[db] backend.json topilmadi. Yangi fayl yaratilmoqda…');
    const fresh = defaultData();
    writeFresh(fresh);
    cachedData = fresh;
    cachedMtime = 0;
    return fresh;
  }

  // Fayl stat (mtime tekshiruvi uchun)
  let stat;
  try { stat = fs.statSync(DATA_PATH); }
  catch (e) {
    console.error('[db] stat xato:', e.message);
    return cachedData || defaultData();
  }

  // Kesh tekshiruvi — agar fayl o'zgarmagan bo'lsa, RAM dan qaytaramiz
  if (cachedData && cachedMtime === stat.mtimeMs) {
    return cachedData;
  }

  // Faylni o'qish
  let raw = '';
  try {
    raw = fs.readFileSync(DATA_PATH, 'utf8');
  } catch (e) {
    console.error('[db] Faylni o\'qib bo\'lmadi:', e.message);
    return cachedData || defaultData();
  }

  // Bo'sh fayl
  if (!raw || !raw.trim()) {
    console.warn('[db] backend.json bo\'sh. Default bilan to\'ldirilmoqda…');
    const fresh = defaultData();
    writeFresh(fresh);
    cachedData = fresh;
    cachedMtime = 0;
    return fresh;
  }

  // JSON parse
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    console.error('[db] ❌ backend.json buzilgan (JSON xato):', e.message);
    console.error('[db] Eski fayl `.broken` ga ko\'chirilyapti va yangi yaratilyapti…');

    try {
      const brokenPath = DATA_PATH + '.broken.' + Date.now();
      fs.copyFileSync(DATA_PATH, brokenPath);
      console.error('[db] Eski fayl saqlandi:', brokenPath);
    } catch (_) {}

    const fresh = defaultData();
    writeFresh(fresh);
    cachedData = fresh;
    cachedMtime = 0;
    return fresh;
  }

  // Obyekt emas
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    console.warn('[db] backend.json obyekt emas. Default bilan almashtirilyapti…');
    const fresh = defaultData();
    writeFresh(fresh);
    cachedData = fresh;
    cachedMtime = 0;
    return fresh;
  }

  // Kerakli massivlarni tekshirish
  const requiredArrays = [
    'users', 'admins', 'websites', 'orders', 'transactions', 'escrows',
    'withdrawals', 'refunds', 'premiumSubscriptions', 'premiumPlans',
    'promocodes', 'discounts', 'events', 'announcements', 'reviews',
    'messages', 'notifications', 'paymentCards', 'paymentMethods',
    'forceSubscribeChannels', 'environmentUsers', 'badges',
    'featuredWebsites', 'popupNotifications', 'scheduledTasks',
    'adminLogs', 'securityLogs', 'verificationCodes', 'sessions', 'loginAttempts',
    'userLogs', 'webhooks', 'forbiddenTelegramIds'
  ];

  let dirty = false;

  for (const key of requiredArrays) {
    if (!Array.isArray(parsed[key])) {
      console.warn(`[db] "${key}" massiv emas — [] ga o'zgartirildi`);
      parsed[key] = [];
      dirty = true;
    }
  }

  // Settings
  if (!parsed.settings || typeof parsed.settings !== 'object' || Array.isArray(parsed.settings)) {
    console.warn('[db] settings yo\'q — default qo\'shildi');
    parsed.settings = defaultData().settings;
    dirty = true;
  } else {
    const s = parsed.settings;
    const defaults = defaultData().settings;

    if (typeof s.awcPriceUZS !== 'number') { s.awcPriceUZS = defaults.awcPriceUZS; dirty = true; }
    if (typeof s.listingFeeUZS !== 'number') { s.listingFeeUZS = defaults.listingFeeUZS; dirty = true; }

    if (!s.moderation || typeof s.moderation !== 'object') {
      s.moderation = defaults.moderation;
      dirty = true;
    } else {
      if (!Array.isArray(s.moderation.bannedWords)) { s.moderation.bannedWords = defaults.moderation.bannedWords; dirty = true; }
      if (!Array.isArray(s.moderation.unsalableDomains)) { s.moderation.unsalableDomains = defaults.moderation.unsalableDomains; dirty = true; }
    }

    if (!Array.isArray(s.topics)) { s.topics = defaults.topics; dirty = true; }
    if (!s.social || typeof s.social !== 'object') { s.social = defaults.social; dirty = true; }
  }

  // API config
  if (!parsed.apiConfig || typeof parsed.apiConfig !== 'object') {
    parsed.apiConfig = defaultData().apiConfig;
    dirty = true;
  }

  // Agar tuzatish kerak bo'lsa, saqlash
  if (dirty) {
    try {
      fs.writeFileSync(DATA_PATH, JSON.stringify(parsed, null, 2), 'utf8');
      console.log('[db] ✅ backend.json avtomatik tuzatildi');
    } catch (e) {
      console.error('[db] Yozib bo\'lmadi:', e.message);
    }
  }

  // Keshni yangilash
  cachedData = parsed;
  cachedMtime = stat.mtimeMs;

  return parsed;
}

// ============================================================
// XAVFSIZ YOZISH
// ============================================================
function writeDataSync(data) {
  ensureDir();
  const tmp = DATA_PATH + '.tmp';
  try {
    fs.writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf8');
    fs.renameSync(tmp, DATA_PATH);
    // Keshni yangilash
    try {
      const stat = fs.statSync(DATA_PATH);
      cachedMtime = stat.mtimeMs;
    } catch (_) {}
  } catch (e) {
    console.error('[db] writeDataSync xato:', e.message);
    try { if (fs.existsSync(tmp)) fs.unlinkSync(tmp); } catch (_) {}
    throw e;
  }
}

/**
 * Navbatli yangilash — bir vaqtda bir nechta yozuvni oldini oladi.
 * @param {function} mutate - (data) => updated data
 * @returns {Promise<object>}
 */
function update(mutate) {
  writeQueue = writeQueue.then(() => {
    const current = readData();
    const updated = (typeof mutate === 'function' ? mutate(current) : current) || current;
    writeDataSync(updated);
    // Keshni darhol yangilash
    cachedData = updated;
    return updated;
  }).catch(err => {
    console.error('[db:update]', err.message);
    writeQueue = Promise.resolve();
    throw err;
  });
  return writeQueue;
}

module.exports = {
  readData,
  update,
  DATA_PATH,
  defaultData
};