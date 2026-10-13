// config.example.js
// Nusxa oling: cp config.example.js config.js

'use strict';

module.exports = {
  server: { port: 3000, host: '0.0.0.0', baseUrl: 'http://localhost:3000' },
  jwt: { secret: 'YOUR_JWT_SECRET', tokenTtlMs: 604800000 },
  admin: { email: 'YOUR_ADMIN_EMAIL', password: 'YOUR_ADMIN_PASSWORD', pin: 'YOUR_PIN', telegramId: 'YOUR_TG_ID' },
  exchangeRate: { enabled: true, provider: 'exchangerate-api', apiKey: 'YOUR_RATE_KEY', apiUrl: 'YOUR_RATE_URL', fallbackRate: 12650 },
  awc: { priceUZS: 10000, symbol: 'AWC', name: 'AwebShop Coin' },
  google: { enabled: false, clientId: 'YOUR_GOOGLE_CLIENT_ID', serviceAccountEmail: 'YOUR_SA_EMAIL' },
  telegram: { enabled: false, botToken: 'YOUR_BOT_TOKEN', botUsername: 'YOUR_BOT_USERNAME', adminChatId: 'YOUR_CHAT_ID' },
  site: { url: 'YOUR_SITE_URL', githubPages: 'YOUR_GH_URL', vercel: 'YOUR_VERCEL_URL', apiBase: 'YOUR_API_BASE', name: 'AwebShop' },
  externalBackend: { enabled: false, apiUrl: 'YOUR_BACKEND_URL', masterKey: 'YOUR_MASTER_KEY' },
  paymentApis: { payme: { enabled: false }, hamkorbank: { enabled: false } },
  fees: { listingFeeUZS: 10000, saleCommissionPercent: 5, escrowFeePercent: 0.4 },
  escrow: { sellerTransferDays: 7, verificationDays: 3, autoReleaseDays: 7, disputeResponseDays: 3, refundProcessingDays: 5 },
  security: { maxLoginAttempts: 5, lockoutMinutes: 15, rateLimitWindowMs: 60000, rateLimitMaxRequests: 120, passwordMinLength: 8 },
  cleanup: { enabled: true, intervalMs: 3600000, soldWebsiteTtlMs: 86400000, sessionTtlMs: 604800000 }
};