// backend/server.js
// AWebShop backend — vanilla Node.js, bitta backend.json.
// Node.js v20 va v24 uchun mos. Top-level await YO'Q.

'use strict';

const http = require('http');
const fs   = require('fs');
const path = require('path');
const url  = require('url');

// ============================================================
// CONFIG (fallback bilan)
// ============================================================
let config;
try {
  config = require('../config');
} catch (e) {
  console.warn('⚠  config.js topilmadi. Default sozlamalar ishlatiladi.');
  console.warn('   → cp config.example.js config.js  va to\'ldiring.');
  config = {};
}

config.server       = config.server || {};
config.jwt          = config.jwt || { secret: 'CHANGE_ME_DEV', tokenTtlMs: 7 * 24 * 60 * 60 * 1000 };
config.exchangeRate = config.exchangeRate || { enabled: false, fallbackRate: 12650, cacheTtlMs: 3600000 };
config.awc          = config.awc || { priceUZS: 10000, symbol: 'AWC', name: 'AwebShop Coin' };
config.paymentApis  = config.paymentApis || {};
config.telegram     = config.telegram || { enabled: false, botToken: '', botUsername: '', adminChatId: '', codeTtlMs: 600000 };
config.fees         = config.fees || { listingFeeUZS: 10000, saleCommissionPercent: 5, escrowFeePercent: 0.4, cashbackPercent: 1, premiumCashbackPercent: 3, referralBonusAWC: 1, rewardedAdsPerFreeListing: 15 };
config.escrow       = config.escrow || { sellerTransferDays: 7, verificationDays: 3, autoReleaseDays: 7, disputeResponseDays: 3, refundProcessingDays: 5 };
config.security     = config.security || { maxLoginAttempts: 5, lockoutMinutes: 15, rateLimitWindowMs: 60000, rateLimitMaxRequests: 120, passwordMinLength: 8 };

const PORT = Number(process.env.PORT) || Number(config.server.port) || 3000;
const HOST = process.env.HOST || config.server.host || '0.0.0.0';

config.server.port = PORT;
config.server.host = HOST;
config.server.baseUrl = config.server.baseUrl || `http://localhost:${PORT}`;

// ============================================================
// MODULES — safeRequire bilan
// ============================================================
function safeRequire(modPath, label) {
  try {
    return require(modPath);
  } catch (e) {
    console.error(`❌ Modul yuklanmadi: ${label || modPath}`);
    console.error(`   Sabab: ${e.message}`);
    if (e.code === 'ERR_REQUIRE_ASYNC_MODULE') {
      console.error(`   → ${modPath} da top-level await bor. Uni funksiya ichiga ko'chiring.`);
    }
    throw e;
  }
}

const { readData }        = safeRequire('./utils/db', 'utils/db.js');
const { rateLimiter }     = safeRequire('./middleware/rateLimiter', 'middleware/rateLimiter.js');
const { securityHeaders } = safeRequire('./middleware/security', 'middleware/security.js');
const { authRequired }    = safeRequire('./middleware/auth', 'middleware/auth.js');
const { adminRequired }   = safeRequire('./middleware/admin', 'middleware/admin.js');

const authApi     = safeRequire('./api/auth', 'api/auth.js');
const websitesApi = safeRequire('./api/websites', 'api/websites.js');
const usersApi    = safeRequire('./api/users', 'api/users.js');
const tokenApi    = safeRequire('./api/token', 'api/token.js');
const adminApi    = safeRequire('./api/admin', 'api/admin.js');
const premiumApi  = safeRequire('./api/premium', 'api/premium.js');

// Yangi modullar (mavjud bo'lmasa, null bo'ladi)
let uploadApi = null;
try { uploadApi = require('./api/upload'); } catch (_) { console.warn('ℹ  api/upload.js yo\'q — /api/upload o\'chirilgan'); }

let settingsApi = null;
try { settingsApi = require('./api/settings'); } catch (_) { console.warn('ℹ  api/settings.js yo\'q — /api/settings/public o\'chirilgan'); }

let webhooksApi = null;
try { webhooksApi = require('./api/webhooks'); } catch (_) { console.warn('ℹ  api/webhooks.js yo\'q — /api/admin/webhooks o\'chirilgan'); }

let eventsApi = null;
try { eventsApi = require('./api/events'); } catch (_) { console.warn('ℹ  api/events.js yo\'q — /api/events o\'chirilgan'); }

let forbiddenTgApi = null;
try { forbiddenTgApi = require('./api/forbidden-telegram'); } catch (_) { /* optional */ }

const ROOT = path.resolve(__dirname, '..');

// ============================================================
// CORS — localhost, 127.0.0.1, Vercel, GitHub Pages
// ============================================================
const EXPLICIT_ORIGINS = new Set([
  'https://ttnaceri.github.io',
  'https://aweb-shop.vercel.app',
  'https://awebshop.vercel.app'
]);

function isLocalOrigin(origin) {
  return /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin || '');
}

function corsHeaders(req) {
  const origin = req.headers.origin || '';
  const allow = (isLocalOrigin(origin) || EXPLICIT_ORIGINS.has(origin)) ? origin : '*';
  return {
    'Access-Control-Allow-Origin': allow,
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin'
  };
}

// ============================================================
// HELPERS
// ============================================================
function sendJson(req, res, status, body) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    ...corsHeaders(req)
  });
  res.end(JSON.stringify(body));
}

function notFound(req, res) {
  sendJson(req, res, 404, {
    success: false,
    message: 'Route not found.',
    code: 'NOT_FOUND'
  });
}

// ============================================================
// STATIC FILE SERVING
// ============================================================
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css' : 'text/css; charset=utf-8',
  '.js'  : 'application/javascript; charset=utf-8',
  '.mjs' : 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png' : 'image/png',
  '.jpg' : 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif' : 'image/gif',
  '.svg' : 'image/svg+xml',
  '.webp': 'image/webp',
  '.ico' : 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2':'font/woff2',
  '.ttf' : 'font/ttf',
  '.otf' : 'font/otf',
  '.txt' : 'text/plain; charset=utf-8',
  '.xml' : 'application/xml; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.map' : 'application/json; charset=utf-8',
  '.pdf' : 'application/pdf'
};

function streamFile(req, res, filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const type = MIME[ext] || 'application/octet-stream';

  let stat;
  try { stat = fs.statSync(filePath); }
  catch { return notFound(req, res); }

  res.writeHead(200, {
    'Content-Type': type,
    'Content-Length': stat.size,
    'Cache-Control': ext === '.html' ? 'no-cache' : 'public, max-age=3600'
  });
  fs.createReadStream(filePath).pipe(res);
}

function serveStatic(req, res, pathname) {
  // Favicon
  if (pathname === '/favicon.ico') {
    const fav = path.join(ROOT, 'frontend', 'assets', 'image', 'favicon.png');
    if (fs.existsSync(fav)) return streamFile(req, res, fav);
    const logo = path.join(ROOT, 'frontend', 'assets', 'image', 'logo.png');
    if (fs.existsSync(logo)) return streamFile(req, res, logo);
    res.writeHead(204);
    return res.end();
  }

  // Root → index.html
  if (pathname === '/' || pathname === '') {
    const rootIndex = path.join(ROOT, 'index.html');
    if (fs.existsSync(rootIndex)) return streamFile(req, res, rootIndex);
    const mainHtml = path.join(ROOT, 'frontend', 'pages', 'main.html');
    if (fs.existsSync(mainHtml)) {
      res.writeHead(302, { Location: '/frontend/pages/main.html' });
      return res.end();
    }
    return notFound(req, res);
  }

  // Decode
  let decoded;
  try { decoded = decodeURIComponent(pathname); }
  catch { return notFound(req, res); }

  // Path traversal himoyasi
  const filePath = path.resolve(path.join(ROOT, decoded));
  if (!filePath.startsWith(ROOT + path.sep) && filePath !== ROOT) {
    return notFound(req, res);
  }

  fs.stat(filePath, (err, stat) => {
    if (err) return notFound(req, res);

    if (stat.isDirectory()) {
      const idx = path.join(filePath, 'index.html');
      if (fs.existsSync(idx)) return streamFile(req, res, idx);
      return notFound(req, res);
    }
    if (!stat.isFile()) return notFound(req, res);
    return streamFile(req, res, filePath);
  });
}

// ============================================================
// GUARD
// ============================================================
function guard(min) {
  return adminRequired(min || 'moderator');
}

// ============================================================
// SERVER
// ============================================================
const server = http.createServer(async (req, res) => {
  const parsed = url.parse(req.url, true);
  const pathname = parsed.pathname || '/';
  const query = parsed.query || {};

  // Security headers
  try { securityHeaders(req, res, () => {}); } catch (_) {}

  // CORS preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, corsHeaders(req));
    return res.end();
  }

  // Static (API emas)
  if (!pathname.startsWith('/api/')) {
    return serveStatic(req, res, pathname);
  }

  // ---- Health check ----
  if (pathname === '/api/health' && req.method === 'GET') {
    return sendJson(req, res, 200, {
      success: true,
      data: {
        status: 'ok',
        uptime: process.uptime(),
        ts: new Date().toISOString(),
        port: PORT,
        node: process.version
      }
    });
  }

  // ---- Maintenance ----
  try {
    const data = readData();
    if (data && data.settings && data.settings.maintenanceMode &&
        !pathname.startsWith('/api/admin')) {
      return sendJson(req, res, 503, {
        success: false,
        message: data.settings.maintenanceMessage || 'Maintenance mode',
        code: 'MAINTENANCE'
      });
    }
  } catch (_) {}

  // ---- Rate limit ----
  let passed = false;
  try { rateLimiter(req, res, () => { passed = true; }); }
  catch (_) { passed = true; }
  if (!passed) return;

  // ==================== API ROUTES ====================
  try {
    // ---------- AUTH ----------
    if (pathname === '/api/auth/request-verification' && req.method === 'POST') return await authApi.requestVerification(req, res);
    if (pathname === '/api/auth/register'             && req.method === 'POST') return await authApi.register(req, res);
    if (pathname === '/api/auth/login'                && req.method === 'POST') return await authApi.login(req, res);
    if (pathname === '/api/auth/logout'               && req.method === 'POST') return await authApi.logout(req, res);
    if (pathname === '/api/auth/forgot-password'      && req.method === 'POST') return await authApi.forgotPassword(req, res);
    if (pathname === '/api/auth/reset-password'       && req.method === 'POST') return await authApi.resetPassword(req, res);
    if (pathname === '/api/auth/me'                   && req.method === 'GET')  return authRequired(req, res, () => authApi.me(req, res));

    // ---------- PUBLIC SETTINGS ----------
    if (pathname === '/api/settings/public' && req.method === 'GET' && settingsApi) {
      return settingsApi.publicSettings(req, res);
    }

    // ---------- PUBLIC EVENTS ----------
    if (pathname === '/api/events' && req.method === 'GET' && eventsApi) {
      return eventsApi.list(req, res);
    }

    // ---------- UPLOAD ----------
    if (pathname === '/api/upload' && req.method === 'POST' && uploadApi) {
      return authRequired(req, res, () => uploadApi.uploadFile(req, res));
    }

    // ---------- USERS ----------
    if (pathname === '/api/users/profile'      && req.method === 'GET') return authRequired(req, res, () => usersApi.profile(req, res));
    if (pathname === '/api/users/profile'      && req.method === 'PUT') return authRequired(req, res, () => usersApi.updateProfile(req, res));
    if (pathname === '/api/users/websites'     && req.method === 'GET') return authRequired(req, res, () => usersApi.myWebsites(req, res));
    if (pathname === '/api/users/transactions' && req.method === 'GET') return authRequired(req, res, () => usersApi.myTransactions(req, res));
    if (pathname === '/api/users/reviews'      && req.method === 'GET') return authRequired(req, res, () => usersApi.myReviews(req, res));

    // ---------- WEBSITES ----------
    if (pathname === '/api/websites'        && req.method === 'GET')  return await websitesApi.list(req, res, query);
    if (pathname === '/api/websites/search' && req.method === 'GET')  return await websitesApi.search(req, res, query);
    if (pathname === '/api/websites'        && req.method === 'POST') return authRequired(req, res, () => websitesApi.create(req, res));
    {
      const m = pathname.match(/^\/api\/websites\/([A-Z0-9]+)\/buy$/);
      if (m && req.method === 'POST') return authRequired(req, res, () => websitesApi.buy(req, res, m[1]));
    }
    {
      const m = pathname.match(/^\/api\/websites\/([A-Z0-9]+)$/);
      if (m && req.method === 'GET') return await websitesApi.detail(req, res, m[1]);
    }

    // ---------- TOKEN ----------
    if (pathname === '/api/token/balance'  && req.method === 'GET')  return authRequired(req, res, () => tokenApi.balance(req, res));
    if (pathname === '/api/token/rate'     && req.method === 'GET')  return tokenApi.rate(req, res);
    if (pathname === '/api/token/history'  && req.method === 'GET')  return authRequired(req, res, () => tokenApi.history(req, res));
    if (pathname === '/api/token/topup'    && req.method === 'POST') return authRequired(req, res, () => tokenApi.topup(req, res));
    if (pathname === '/api/token/transfer' && req.method === 'POST') return authRequired(req, res, () => tokenApi.transfer(req, res));
    if (pathname === '/api/token/withdraw' && req.method === 'POST') return authRequired(req, res, () => tokenApi.withdraw(req, res));

    // ---------- PREMIUM (public/user) ----------
    if (pathname === '/api/premium/plans'     && req.method === 'GET')  return await premiumApi.plans(req, res);
    if (pathname === '/api/premium/subscribe' && req.method === 'POST') return authRequired(req, res, () => premiumApi.subscribe(req, res));
    if (pathname === '/api/premium/status'    && req.method === 'GET')  return authRequired(req, res, () => premiumApi.status(req, res));
    if (pathname === '/api/premium/cancel'    && req.method === 'POST') return authRequired(req, res, () => premiumApi.cancel(req, res));
    if (pathname === '/api/premium/trial'     && req.method === 'POST') return authRequired(req, res, () => premiumApi.trial(req, res));

    // ==================== ADMIN: CORE ====================
    if (pathname === '/api/admin/stats'     && req.method === 'GET') return guard('moderator')(req, res, () => adminApi.stats(req, res));
    if (pathname === '/api/admin/logs'      && req.method === 'GET') return guard('moderator')(req, res, () => adminApi.logs(req, res));
    if (pathname === '/api/admin/analytics' && req.method === 'GET') return guard('moderator')(req, res, () => adminApi.analytics(req, res));

    // ==================== ADMIN: USERS ====================
    if (pathname === '/api/admin/users'                && req.method === 'GET')  return guard('moderator')(req, res, () => adminApi.usersList(req, res));
    if (pathname === '/api/admin/users/create'         && req.method === 'POST') return guard('super_admin')(req, res, () => adminApi.usersCreate(req, res));
    if (pathname === '/api/admin/users/block'          && req.method === 'POST') return guard('admin')(req, res, () => adminApi.blockUser(req, res));
    if (pathname === '/api/admin/users/delete'         && req.method === 'POST') return guard('admin')(req, res, () => adminApi.softDeleteUser(req, res));
    if (pathname === '/api/admin/users/restore'        && req.method === 'POST') return guard('admin')(req, res, () => adminApi.restoreUser(req, res));
    if (pathname === '/api/admin/users/badge/assign'   && req.method === 'POST') return guard('admin')(req, res, () => adminApi.assignBadge(req, res));
    if (pathname === '/api/admin/users/badge/unassign' && req.method === 'POST') return guard('admin')(req, res, () => adminApi.unassignBadge(req, res));

    // ==================== ADMIN: ADMINS ====================
    if (pathname === '/api/admin/admins' && req.method === 'GET')    return guard('admin')(req, res, () => adminApi.adminsList(req, res));
    if (pathname === '/api/admin/admins' && req.method === 'POST')   return guard('super_admin')(req, res, () => adminApi.adminsCreate(req, res));
    if (pathname === '/api/admin/admins' && req.method === 'PUT')    return guard('super_admin')(req, res, () => adminApi.adminsUpdate(req, res));
    if (pathname === '/api/admin/admins' && req.method === 'DELETE') return guard('super_admin')(req, res, () => adminApi.adminsDelete(req, res));

    // ==================== ADMIN: WEBSITES ====================
    if (pathname === '/api/admin/websites' && req.method === 'GET')    return guard('moderator')(req, res, () => adminApi.websitesList(req, res));
    if (pathname === '/api/admin/websites' && req.method === 'PUT')    return guard('admin')(req, res, () => adminApi.websiteUpdate(req, res));
    if (pathname === '/api/admin/websites' && req.method === 'DELETE') return guard('admin')(req, res, () => adminApi.websiteDelete(req, res));

    // ==================== ADMIN: ESCROW ====================
    if (pathname === '/api/admin/escrow'        && req.method === 'GET')  return guard('moderator')(req, res, () => adminApi.escrowList(req, res));
    if (pathname === '/api/admin/escrow/update' && req.method === 'POST') return guard('admin')(req, res, () => adminApi.escrowUpdate(req, res));

    // ==================== ADMIN: WITHDRAW ====================
    if (pathname === '/api/admin/withdraw'         && req.method === 'GET')  return guard('moderator')(req, res, () => adminApi.withdrawList(req, res));
    if (pathname === '/api/admin/withdraw/approve' && req.method === 'POST') return guard('admin')(req, res, () => adminApi.withdrawApprove(req, res));

    // ==================== ADMIN: PAYMENTS ====================
    if (pathname === '/api/admin/transactions'    && req.method === 'GET')  return guard('moderator')(req, res, () => adminApi.transactionsList(req, res));
    if (pathname === '/api/admin/payments/verify' && req.method === 'POST') return guard('admin')(req, res, () => adminApi.verifyPayment(req, res));

    // ==================== ADMIN: CARDS ====================
    if (pathname === '/api/admin/cards' && req.method === 'GET')    return guard('moderator')(req, res, () => adminApi.cardsList(req, res));
    if (pathname === '/api/admin/cards' && req.method === 'POST')   return guard('admin')(req, res, () => adminApi.cardsCreate(req, res));
    if (pathname === '/api/admin/cards' && req.method === 'PUT')    return guard('admin')(req, res, () => adminApi.cardsUpdate(req, res));
    if (pathname === '/api/admin/cards' && req.method === 'DELETE') return guard('admin')(req, res, () => adminApi.cardsDelete(req, res));

    // ==================== ADMIN: PROMOCODES ====================
    if (pathname === '/api/admin/promocodes' && req.method === 'GET')    return guard('moderator')(req, res, () => adminApi.promocodesList(req, res));
    if (pathname === '/api/admin/promocodes' && req.method === 'POST')   return guard('admin')(req, res, () => adminApi.promocodesCreate(req, res));
    if (pathname === '/api/admin/promocodes' && req.method === 'PUT')    return guard('admin')(req, res, () => adminApi.promocodesUpdate(req, res));
    if (pathname === '/api/admin/promocodes' && req.method === 'DELETE') return guard('admin')(req, res, () => adminApi.promocodesDelete(req, res));

    // ==================== ADMIN: DISCOUNTS ====================
    if (pathname === '/api/admin/discounts' && req.method === 'GET')    return guard('moderator')(req, res, () => adminApi.discountsList(req, res));
    if (pathname === '/api/admin/discounts' && req.method === 'POST')   return guard('admin')(req, res, () => adminApi.discountsCreate(req, res));
    if (pathname === '/api/admin/discounts' && req.method === 'PUT')    return guard('admin')(req, res, () => adminApi.discountsUpdate(req, res));
    if (pathname === '/api/admin/discounts' && req.method === 'DELETE') return guard('admin')(req, res, () => adminApi.discountsDelete(req, res));

    // ==================== ADMIN: EVENTS ====================
    if (pathname === '/api/admin/events' && req.method === 'GET')    return guard('moderator')(req, res, () => adminApi.eventsList(req, res));
    if (pathname === '/api/admin/events' && req.method === 'POST')   return guard('admin')(req, res, () => adminApi.eventsCreate(req, res));
    if (pathname === '/api/admin/events' && req.method === 'PUT')    return guard('admin')(req, res, () => adminApi.eventsUpdate(req, res));
    if (pathname === '/api/admin/events' && req.method === 'DELETE') return guard('admin')(req, res, () => adminApi.eventsDelete(req, res));

    // ==================== ADMIN: ANNOUNCEMENTS ====================
    if (pathname === '/api/admin/announcements' && req.method === 'GET')    return guard('moderator')(req, res, () => adminApi.announcementsList(req, res));
    if (pathname === '/api/admin/announcements' && req.method === 'POST')   return guard('admin')(req, res, () => adminApi.announcementsCreate(req, res));
    if (pathname === '/api/admin/announcements' && req.method === 'DELETE') return guard('admin')(req, res, () => adminApi.announcementsDelete(req, res));

    // ==================== ADMIN: REVIEWS ====================
    if (pathname === '/api/admin/reviews' && req.method === 'GET')    return guard('moderator')(req, res, () => adminApi.reviewsList(req, res));
    if (pathname === '/api/admin/reviews' && req.method === 'PUT')    return guard('admin')(req, res, () => adminApi.reviewsUpdate(req, res));
    if (pathname === '/api/admin/reviews' && req.method === 'DELETE') return guard('admin')(req, res, () => adminApi.reviewsDelete(req, res));

    // ==================== ADMIN: FEATURED ====================
    if (pathname === '/api/admin/featured'        && req.method === 'GET')  return guard('moderator')(req, res, () => adminApi.featuredList(req, res));
    if (pathname === '/api/admin/featured/toggle' && req.method === 'POST') return guard('admin')(req, res, () => adminApi.featuredToggle(req, res));

    // ==================== ADMIN: BADGES ====================
    if (pathname === '/api/admin/badges' && req.method === 'GET')    return guard('moderator')(req, res, () => adminApi.badgesList(req, res));
    if (pathname === '/api/admin/badges' && req.method === 'POST')   return guard('admin')(req, res, () => adminApi.badgesCreate(req, res));
    if (pathname === '/api/admin/badges' && req.method === 'PUT')    return guard('admin')(req, res, () => adminApi.badgesUpdate(req, res));
    if (pathname === '/api/admin/badges' && req.method === 'DELETE') return guard('admin')(req, res, () => adminApi.badgesDelete(req, res));

    // ==================== ADMIN: MODERATION ====================
    if (pathname === '/api/admin/words' && req.method === 'GET') return guard('moderator')(req, res, () => adminApi.wordsList(req, res));
    if (pathname === '/api/admin/words' && req.method === 'PUT') return guard('admin')(req, res, () => adminApi.wordsUpdate(req, res));

    // ==================== ADMIN: SETTINGS ====================
    if (pathname === '/api/admin/settings' && req.method === 'GET') return guard('moderator')(req, res, () => adminApi.settingsGet(req, res));
    if (pathname === '/api/admin/settings' && req.method === 'PUT') return guard('admin')(req, res, () => adminApi.settingsUpdate(req, res));

    // ==================== ADMIN: PRICES ====================
    if (pathname === '/api/admin/prices' && req.method === 'GET') return guard('moderator')(req, res, () => adminApi.pricesGet(req, res));
    if (pathname === '/api/admin/prices' && req.method === 'PUT') return guard('admin')(req, res, () => adminApi.pricesUpdate(req, res));

    // ==================== ADMIN: PREMIUM ====================
    if (pathname === '/api/admin/premium/plans'         && req.method === 'GET') return guard('moderator')(req, res, () => adminApi.premiumPlansList(req, res));
    if (pathname === '/api/admin/premium/plans'         && req.method === 'PUT') return guard('admin')(req, res, () => adminApi.premiumPlansUpdate(req, res));
    if (pathname === '/api/admin/premium/subscriptions' && req.method === 'GET') return guard('moderator')(req, res, () => adminApi.premiumSubscriptionsList(req, res));
    if (pathname === '/api/admin/premium/subscriptions' && req.method === 'PUT') return guard('admin')(req, res, () => adminApi.premiumSubscriptionUpdate(req, res));

    // ==================== ADMIN: FORCE SUBSCRIBE ====================
    if (pathname === '/api/admin/force-subscribe' && req.method === 'GET')    return guard('moderator')(req, res, () => adminApi.forceSubList(req, res));
    if (pathname === '/api/admin/force-subscribe' && req.method === 'POST')   return guard('admin')(req, res, () => adminApi.forceSubCreate(req, res));
    if (pathname === '/api/admin/force-subscribe' && req.method === 'PUT')    return guard('admin')(req, res, () => adminApi.forceSubUpdate(req, res));
    if (pathname === '/api/admin/force-subscribe' && req.method === 'DELETE') return guard('admin')(req, res, () => adminApi.forceSubDelete(req, res));

    // ==================== ADMIN: ENVIRONMENT ====================
    if (pathname === '/api/admin/environment' && req.method === 'GET')    return guard('admin')(req, res, () => adminApi.envList(req, res));
    if (pathname === '/api/admin/environment' && req.method === 'POST')   return guard('super_admin')(req, res, () => adminApi.envCreate(req, res));
    if (pathname === '/api/admin/environment' && req.method === 'DELETE') return guard('super_admin')(req, res, () => adminApi.envDelete(req, res));

    // ==================== ADMIN: MESSAGES ====================
    if (pathname === '/api/admin/messages' && req.method === 'GET')    return guard('moderator')(req, res, () => adminApi.messagesList(req, res));
    if (pathname === '/api/admin/messages' && req.method === 'PUT')    return guard('moderator')(req, res, () => adminApi.messagesUpdate(req, res));
    if (pathname === '/api/admin/messages' && req.method === 'DELETE') return guard('admin')(req, res, () => adminApi.messagesDelete(req, res));

    // ==================== ADMIN: TODO ====================
    if (pathname === '/api/admin/todo' && req.method === 'GET')    return guard('moderator')(req, res, () => adminApi.todoList(req, res));
    if (pathname === '/api/admin/todo' && req.method === 'POST')   return guard('moderator')(req, res, () => adminApi.todoCreate(req, res));
    if (pathname === '/api/admin/todo' && req.method === 'PUT')    return guard('moderator')(req, res, () => adminApi.todoUpdate(req, res));
    if (pathname === '/api/admin/todo' && req.method === 'DELETE') return guard('moderator')(req, res, () => adminApi.todoDelete(req, res));

    // ==================== ADMIN: SCHEDULE ====================
    if (pathname === '/api/admin/schedule' && req.method === 'GET')    return guard('moderator')(req, res, () => adminApi.scheduleList(req, res));
    if (pathname === '/api/admin/schedule' && req.method === 'POST')   return guard('admin')(req, res, () => adminApi.scheduleCreate(req, res));
    if (pathname === '/api/admin/schedule' && req.method === 'DELETE') return guard('admin')(req, res, () => adminApi.scheduleDelete(req, res));

    // ==================== ADMIN: POPUP ====================
    if (pathname === '/api/admin/popups' && req.method === 'GET')    return guard('moderator')(req, res, () => adminApi.popupList(req, res));
    if (pathname === '/api/admin/popups' && req.method === 'POST')   return guard('admin')(req, res, () => adminApi.popupCreate(req, res));
    if (pathname === '/api/admin/popups' && req.method === 'PUT')    return guard('admin')(req, res, () => adminApi.popupUpdate(req, res));
    if (pathname === '/api/admin/popups' && req.method === 'DELETE') return guard('admin')(req, res, () => adminApi.popupDelete(req, res));

    // ==================== ADMIN: NOTIFICATIONS ====================
    if (pathname === '/api/admin/notifications' && req.method === 'GET')    return guard('moderator')(req, res, () => adminApi.notificationsList(req, res));
    if (pathname === '/api/admin/notifications' && req.method === 'POST')   return guard('admin')(req, res, () => adminApi.notificationsCreate(req, res));
    if (pathname === '/api/admin/notifications' && req.method === 'DELETE') return guard('admin')(req, res, () => adminApi.notificationsDelete(req, res));

    // ==================== ADMIN: BACKUP ====================
    if (pathname === '/api/admin/backup'         && req.method === 'POST') return guard('admin')(req, res, () => adminApi.backup(req, res));
    if (pathname === '/api/admin/backup'         && req.method === 'GET')  return guard('moderator')(req, res, () => adminApi.backupList(req, res));
    if (pathname === '/api/admin/backup/restore' && req.method === 'POST') return guard('super_admin')(req, res, () => adminApi.backupRestore(req, res));

    // ==================== ADMIN: EXPORT / IMPORT ====================
    if (pathname === '/api/admin/export' && req.method === 'GET')  return guard('admin')(req, res, () => adminApi.exportData(req, res, query));
    if (pathname === '/api/admin/import' && req.method === 'POST') return guard('super_admin')(req, res, () => adminApi.importData(req, res));

    // ==================== ADMIN: SECURITY ====================
    if (pathname === '/api/admin/security'     && req.method === 'GET')  return guard('admin')(req, res, () => adminApi.securityList(req, res));
    if (pathname === '/api/admin/security'     && req.method === 'PUT')  return guard('super_admin')(req, res, () => adminApi.securityUpdate(req, res));
    if (pathname === '/api/admin/security/log' && req.method === 'POST') return guard('admin')(req, res, () => adminApi.securityLogAdd(req, res));

    // ==================== ADMIN: SEO ====================
    if (pathname === '/api/admin/seo' && req.method === 'GET') return guard('moderator')(req, res, () => adminApi.seoGet(req, res));
    if (pathname === '/api/admin/seo' && req.method === 'PUT') return guard('admin')(req, res, () => adminApi.seoUpdate(req, res));

    // ==================== ADMIN: TELEGRAM ====================
    if (pathname === '/api/admin/telegram'      && req.method === 'GET')  return guard('admin')(req, res, () => adminApi.telegramGet(req, res));
    if (pathname === '/api/admin/telegram'      && req.method === 'PUT')  return guard('admin')(req, res, () => adminApi.telegramUpdate(req, res));
    if (pathname === '/api/admin/telegram/test' && req.method === 'POST') return guard('admin')(req, res, () => adminApi.telegramTest(req, res));

    // ==================== ADMIN: MAINTENANCE ====================
    if (pathname === '/api/admin/maintenance' && req.method === 'GET') return guard('moderator')(req, res, () => adminApi.maintenanceGet(req, res));
    if (pathname === '/api/admin/maintenance' && req.method === 'PUT') return guard('super_admin')(req, res, () => adminApi.maintenanceUpdate(req, res));

    // ==================== ADMIN: WEBHOOKS (optional) ====================
    if (webhooksApi) {
      if (pathname === '/api/admin/webhooks' && req.method === 'GET')    return guard('moderator')(req, res, () => webhooksApi.list(req, res));
      if (pathname === '/api/admin/webhooks' && req.method === 'POST')   return guard('admin')(req, res, () => webhooksApi.create(req, res));
      if (pathname === '/api/admin/webhooks' && req.method === 'PUT')    return guard('admin')(req, res, () => webhooksApi.update(req, res));
      if (pathname === '/api/admin/webhooks' && req.method === 'DELETE') return guard('admin')(req, res, () => webhooksApi.remove(req, res));
    }

    // ==================== ADMIN: FORBIDDEN TELEGRAM IDS (optional) ====================
    if (forbiddenTgApi) {
      if (pathname === '/api/admin/forbidden-telegram' && req.method === 'GET')    return guard('moderator')(req, res, () => forbiddenTgApi.list(req, res));
      if (pathname === '/api/admin/forbidden-telegram' && req.method === 'POST')   return guard('admin')(req, res, () => forbiddenTgApi.create(req, res));
      if (pathname === '/api/admin/forbidden-telegram' && req.method === 'DELETE') return guard('admin')(req, res, () => forbiddenTgApi.remove(req, res));
    }

    // ---------- 404 ----------
    return notFound(req, res);

  } catch (err) {
    console.error('[server:error]', err && err.stack ? err.stack : err);
    return sendJson(req, res, 500, {
      success: false,
      message: 'Something went wrong.',
      code: 'SERVER_ERROR'
    });
  }
});

// ============================================================
// LISTEN
// ============================================================
server.listen(PORT, HOST, () => {
  const line = '─'.repeat(56);
  console.log('');
  console.log('  ✅  AWebShop backend ishga tushdi');
  console.log('  ' + line);
  console.log(`  Node.js:     ${process.version}`);
  console.log(`  Port:        ${PORT}`);
  console.log(`  Host:        ${HOST}`);
  console.log(`  URL:         http://localhost:${PORT}`);
  console.log('  ' + line);
  console.log(`  🏠 Main:      http://localhost:${PORT}/frontend/pages/main.html`);
  console.log(`  🔑 Login:     http://localhost:${PORT}/frontend/pages/login.html`);
  console.log(`  📝 Register:  http://localhost:${PORT}/frontend/pages/register.html`);
  console.log(`  🛒 Store:     http://localhost:${PORT}/frontend/pages/store.html`);
  console.log(`  💰 Sell:      http://localhost:${PORT}/frontend/pages/sell.html`);
  console.log(`  👤 Profile:   http://localhost:${PORT}/frontend/pages/profile.html`);
  console.log(`  🛠  Admin:     http://localhost:${PORT}/frontend/admin/dashboard.html`);
  console.log(`  ❤️  Health:    http://localhost:${PORT}/api/health`);
  console.log('  ' + line);
  try {
    console.log(`  📁 Data:      ${require('./utils/db').DATA_PATH}`);
  } catch (_) {}
  console.log('  ' + line);
  console.log('  🌐 Live Server bilan ham ishlaydi:');
  console.log('     http://127.0.0.1:5500/frontend/pages/main.html');
  console.log('  ' + line);
  console.log('  To\'xtatish: Ctrl + C');
  console.log('');
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error('');
    console.error(`❌ Port ${PORT} band.`);
    console.error('');
    console.error('   Yechim 1 — eski jarayonni to\'xtatish:');
    console.error(`     netstat -ano | findstr :${PORT}`);
    console.error(`     taskkill /PID <PID> /F`);
    console.error('');
    console.error('   Yechim 2 — boshqa portda ishga tushirish:');
    console.error(`     PowerShell:  $env:PORT=3001; node backend/server.js`);
    console.error(`     CMD:         set PORT=3001 && node backend/server.js`);
    console.error('');
  } else {
    console.error('[server:listen:error]', err);
  }
  process.exit(1);
});

// ============================================================
// GRACEFUL SHUTDOWN
// ============================================================
function shutdown(signal) {
  console.log(`\n⏹  ${signal} — server to'xtatilmoqda…`);
  server.close(() => {
    console.log('✅ Server toza yopildi.');
    process.exit(0);
  });
  setTimeout(() => process.exit(0), 5000);
}

process.on('SIGINT',  () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

// ============================================================
// XATO USHLASH — server crash bo'lmasin
// ============================================================
process.on('uncaughtException', (err) => {
  console.error('[uncaughtException]', err && err.stack ? err.stack : err);
});

process.on('unhandledRejection', (reason) => {
  console.error('[unhandledRejection]', reason);
});

// Vercel uchun eksport
module.exports = server;