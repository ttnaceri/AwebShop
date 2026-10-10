// config.example.js
// AWebShop — namuna konfiguratsiya fayli.
//
// ⚠️  BU NAMUNA FAYL (GitHub'ga qo'yiladi):
//   1) Hech qanday HAQIQIY kalit YO'Q
//   2) Nusxa oling:  cp config.example.js config.js
//   3) Nusxada haqiqiy qiymatlarni to'ldiring
//   4) config.js .gitignore da — hech qachon GitHub'ga chiqmaydi
//
// Foydalanish:
//   Linux/Mac:  cp config.example.js config.js
//   PowerShell: Copy-Item config.example.js config.js
//   CMD:        copy config.example.js config.js

'use strict';

module.exports = {

  // ============================================================
  // SERVER
  // ============================================================
  server: {
    // Backend qaysi portda ishlaydi
    port: Number(process.env.PORT) || 3000,

    // 0.0.0.0 = barcha interfeyslar (localhost, LAN, internet)
    // 127.0.0.1 = faqat localhost
    host: process.env.HOST || '0.0.0.0',

    // Bazaviy URL (frontend shu manzilga murojaat qiladi)
    baseUrl: process.env.BASE_URL || 'http://localhost:3000'
  },

  // ============================================================
  // JWT / SESSION
  // ============================================================
  jwt: {
    // Bu qiymatni o'zingizga xos uzun tasodifiy satr bilan almashtiring:
    //   Linux/Mac:  openssl rand -hex 32
    //   Node.js:    node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
    secret: process.env.JWT_SECRET || 'YOUR_LONG_RANDOM_JWT_SECRET',

    // Token amal qilish muddati (millisekundlarda)
    // 7 kun = 1000 * 60 * 60 * 24 * 7
    tokenTtlMs: Number(process.env.JWT_TTL_MS) || (1000 * 60 * 60 * 24 * 7)
  },

  // ============================================================
  // EXCHANGE RATE (USD ↔ UZS)
  // ============================================================
  // Provayderdan USD → UZS kursini olib turadi.
  // Agar API ishlamasa, `fallbackRate` ishlatiladi.
  exchangeRate: {
    // Yoqish/o'chirish
    enabled: process.env.EXCHANGE_RATE_ENABLED !== 'false',

    // Provayder nomi: 'exchangerate-api' | 'openexchangerates' | 'manual'
    provider: process.env.EXCHANGE_RATE_PROVIDER || 'manual',

    // API kalit — YOUR_EXCHANGE_RATE_API_KEY bilan almashtiring
    // Bepul kalit: https://app.exchangerate-api.com/sign-up
    apiKey: process.env.EXCHANGE_RATE_API_KEY || 'YOUR_EXCHANGE_RATE_API_KEY',

    // Qaysi valyutadan boshlab hisoblash
    baseCurrency: process.env.EXCHANGE_RATE_BASE || 'USD',

    // Provayderning endpoint manzili (base URL)
    // exchangerate-api:  https://v6.exchangerate-api.com/v6
    // openexchangerates: https://openexchangerates.org/api
    endpoint: process.env.EXCHANGE_RATE_ENDPOINT || 'YOUR_EXCHANGE_RATE_API_URL',

    // Agar API ishlamasa, shu kurs ishlatiladi (1 USD = X UZS)
    fallbackRate: Number(process.env.EXCHANGE_RATE_FALLBACK) || 12650,

    // Necha ms davomida cache saqlansin (1 soat = 3600000)
    cacheTtlMs: Number(process.env.EXCHANGE_RATE_TTL_MS) || (1000 * 60 * 60)
  },

  // ============================================================
  // AWC (AwebShop Coin)
  // ============================================================
  awc: {
    // 1 AWC qancha UZS ga teng
    priceUZS: Number(process.env.AWC_PRICE_UZS) || 10000,

    // Token belgisi va nomi
    symbol: 'AWC',
    name: 'AwebShop Coin'
  },

  // ============================================================
  // PAYMENT PROVIDERS (kelajakda ulanadi)
  // ============================================================
  // Hozircha barcha provayderlar `enabled: false`.
  // Har birining strukturasi to'liq tayyor — faqat kalit va endpoint kerak.
  paymentApis: {
    // ---------- Payme (Uzbekistan) ----------
    payme: {
      enabled: process.env.PAYME_ENABLED === 'true',
      apiKey: process.env.PAYME_API_KEY || 'YOUR_PAYME_API_KEY',
      merchantId: process.env.PAYME_MERCHANT_ID || 'YOUR_PAYME_MERCHANT_ID',
      endpoint: process.env.PAYME_ENDPOINT || 'https://checkout.paycom.uz',
      currency: 'UZS',
      callbackUrl: process.env.PAYME_CALLBACK_URL || 'YOUR_PAYME_CALLBACK_URL'
    },

    // ---------- Hamkorbank (Uzbekistan) ----------
    hamkorbank: {
      enabled: process.env.HAMKORBANK_ENABLED === 'true',
      apiKey: process.env.HAMKORBANK_API_KEY || 'YOUR_HAMKORBANK_API_KEY',
      merchantId: process.env.HAMKORBANK_MERCHANT_ID || 'YOUR_HAMKORBANK_MERCHANT_ID',
      endpoint: process.env.HAMKORBANK_ENDPOINT || 'YOUR_HAMKORBANK_API_URL',
      currency: 'UZS',
      callbackUrl: process.env.HAMKORBANK_CALLBACK_URL || 'YOUR_HAMKORBANK_CALLBACK_URL'
    },

    // ---------- Click (Uzbekistan, kelajakda) ----------
    click: {
      enabled: process.env.CLICK_ENABLED === 'true',
      apiKey: process.env.CLICK_API_KEY || 'YOUR_CLICK_API_KEY',
      merchantId: process.env.CLICK_MERCHANT_ID || 'YOUR_CLICK_MERCHANT_ID',
      endpoint: process.env.CLICK_ENDPOINT || 'https://my.click.uz/services/pay',
      currency: 'UZS',
      callbackUrl: process.env.CLICK_CALLBACK_URL || 'YOUR_CLICK_CALLBACK_URL'
    },

    // ---------- Uzum Bank (kelajakda) ----------
    uzumbank: {
      enabled: process.env.UZUMBANK_ENABLED === 'true',
      apiKey: process.env.UZUMBANK_API_KEY || 'YOUR_UZUMBANK_API_KEY',
      merchantId: process.env.UZUMBANK_MERCHANT_ID || 'YOUR_UZUMBANK_MERCHANT_ID',
      endpoint: process.env.UZUMBANK_ENDPOINT || 'YOUR_UZUMBANK_API_URL',
      currency: 'UZS',
      callbackUrl: process.env.UZUMBANK_CALLBACK_URL || 'YOUR_UZUMBANK_CALLBACK_URL'
    },

    // ---------- Stripe (kelajakda, xalqaro) ----------
    stripe: {
      enabled: process.env.STRIPE_ENABLED === 'true',
      apiKey: process.env.STRIPE_SECRET_KEY || 'YOUR_STRIPE_SECRET_KEY',
      publicKey: process.env.STRIPE_PUBLIC_KEY || 'YOUR_STRIPE_PUBLIC_KEY',
      endpoint: 'https://api.stripe.com/v1',
      currency: 'USD',
      callbackUrl: process.env.STRIPE_CALLBACK_URL || 'YOUR_STRIPE_CALLBACK_URL'
    },

    // ---------- PayPal (kelajakda, xalqaro) ----------
    paypal: {
      enabled: process.env.PAYPAL_ENABLED === 'true',
      clientId: process.env.PAYPAL_CLIENT_ID || 'YOUR_PAYPAL_CLIENT_ID',
      clientSecret: process.env.PAYPAL_CLIENT_SECRET || 'YOUR_PAYPAL_CLIENT_SECRET',
      endpoint: process.env.PAYPAL_ENDPOINT || 'https://api-m.paypal.com',
      currency: 'USD',
      callbackUrl: process.env.PAYPAL_CALLBACK_URL || 'YOUR_PAYPAL_CALLBACK_URL'
    }
  },

  // ============================================================
  // TELEGRAM BOT
  // ============================================================
  telegram: {
    // Botni yoqish (true bo'lsa bot ishlaydi)
    enabled: process.env.TELEGRAM_ENABLED === 'true',

    // @BotFather dan olingan token
    // Format: 123456789:ABCdefGHIjklMNOpqrsTUVwxyz
    botToken: process.env.TELEGRAM_BOT_TOKEN || 'YOUR_TELEGRAM_BOT_TOKEN',

    // Bot username (@ belgisisiz)
    botUsername: process.env.TELEGRAM_BOT_USERNAME || 'YourBotUsername',

    // Admin bildirishnomalar uchun chat ID
    // @userinfobot orqali olish mumkin
    adminChatId: process.env.TELEGRAM_ADMIN_CHAT_ID || '',

    // Verification kodi amal qilish muddati (10 daqiqa)
    codeTtlMs: Number(process.env.TELEGRAM_CODE_TTL_MS) || (1000 * 60 * 10),

    // Force-subscribe
    forceSubscribe: {
      enabled: process.env.TELEGRAM_FORCE_SUBSCRIBE !== 'false'
    }
  },

  // ============================================================
  // SITE / DOMAIN
  // ============================================================
  site: {
    // Asosiy sayt manzili (production da)
    url: process.env.SITE_URL || 'http://localhost:3000',

    // GitHub Pages (agar ishlatilsa)
    githubPages: process.env.GITHUB_PAGES_URL || 'YOUR_GITHUB_PAGES_URL',

    // Backend API manzili (frontend shu yerga murojaat qiladi)
    apiBase: process.env.SITE_API_BASE || 'YOUR_SITE_API_BASE_URL',

    // Brend nomi
    name: process.env.SITE_NAME || 'AWebShop',

    // Aloqa email
    contactEmail: process.env.SITE_CONTACT_EMAIL || 'support@awebshop.example'
  },

  // ============================================================
  // EMAIL (kelajakda — SMTP orqali xat yuborish)
  // ============================================================
  email: {
    enabled: process.env.EMAIL_ENABLED === 'true',
    provider: process.env.EMAIL_PROVIDER || 'smtp',
    host: process.env.EMAIL_HOST || 'YOUR_SMTP_HOST',
    port: Number(process.env.EMAIL_PORT) || 587,
    secure: process.env.EMAIL_SECURE === 'true',
    user: process.env.EMAIL_USER || 'YOUR_SMTP_USER',
    pass: process.env.EMAIL_PASS || 'YOUR_SMTP_PASSWORD',
    from: process.env.EMAIL_FROM || 'AWebShop <noreply@awebshop.example>'
  },

  // ============================================================
  // SMS (kelajakda — Eskiz.uz yoki boshqa)
  // ============================================================
  sms: {
    enabled: process.env.SMS_ENABLED === 'true',
    provider: process.env.SMS_PROVIDER || 'eskiz',
    apiKey: process.env.SMS_API_KEY || 'YOUR_SMS_API_KEY',
    sender: process.env.SMS_SENDER || 'YOUR_SMS_SENDER_NAME'
  },

  // ============================================================
  // GOOGLE (Analytics / Search Console — ixtiyoriy)
  // ============================================================
  google: {
    analyticsId: process.env.GA_ID || 'YOUR_GOOGLE_ANALYTICS_ID',
    searchConsoleId: process.env.GSC_ID || 'YOUR_GOOGLE_SEARCH_CONSOLE_ID',
    mapsApiKey: process.env.GOOGLE_MAPS_API_KEY || 'YOUR_GOOGLE_MAPS_API_KEY'
  },

  // ============================================================
  // FEES / KOMISSIYALAR
  // ============================================================
  fees: {
    // Yangi listing qo'shish narxi (UZS)
    listingFeeUZS: Number(process.env.FEE_LISTING_UZS) || 10000,

    // Sotuvdan komissiya (%)
    saleCommissionPercent: Number(process.env.FEE_SALE_COMMISSION) || 5,

    // Escrow xizmat haqi (%)
    escrowFeePercent: Number(process.env.FEE_ESCROW) || 0.4,

    // Cashback (%)
    cashbackPercent: Number(process.env.FEE_CASHBACK) || 1,
    premiumCashbackPercent: Number(process.env.FEE_CASHBACK_PREMIUM) || 3,

    // Referral bonusi (AWC)
    referralBonusAWC: Number(process.env.FEE_REFERRAL_AWC) || 1,

    // Nechta reklama ko'rish kerak — 1 bepul listing uchun
    rewardedAdsPerFreeListing: Number(process.env.FEE_REWARDED_ADS) || 15
  },

  // ============================================================
  // ESCROW VAQTLARI (kunlarda)
  // ============================================================
  escrow: {
    sellerTransferDays:   Number(process.env.ESCROW_SELLER_DAYS)   || 7,
    verificationDays:     Number(process.env.ESCROW_VERIFY_DAYS)   || 3,
    autoReleaseDays:      Number(process.env.ESCROW_AUTORELEASE)   || 7,
    disputeResponseDays:  Number(process.env.ESCROW_DISPUTE_DAYS)  || 3,
    refundProcessingDays: Number(process.env.ESCROW_REFUND_DAYS)   || 5
  },

  // ============================================================
  // XAVFSIZLIK
  // ============================================================
  security: {
    // Login urinishlari limiti
    maxLoginAttempts: Number(process.env.SEC_MAX_LOGIN) || 5,
    lockoutMinutes:   Number(process.env.SEC_LOCKOUT_MIN) || 15,

    // Rate limiting (API so'rovlar uchun)
    rateLimitWindowMs:    Number(process.env.SEC_RATE_WINDOW_MS) || (60 * 1000),
    rateLimitMaxRequests: Number(process.env.SEC_RATE_MAX) || 120,

    // Parol minimal uzunligi
    passwordMinLength: Number(process.env.SEC_PASSWORD_MIN) || 8,

    // Captcha (kelajakda — reCAPTCHA / hCaptcha)
    captchaEnabled: process.env.SEC_CAPTCHA_ENABLED === 'true',
    captchaSiteKey: process.env.SEC_CAPTCHA_SITE_KEY || 'YOUR_CAPTCHA_SITE_KEY',
    captchaSecret:  process.env.SEC_CAPTCHA_SECRET   || 'YOUR_CAPTCHA_SECRET'
  },

  // ============================================================
  // FORBIDDEN WEBSITES — 3 strike system
  // ============================================================
  forbidden: {
    // 3 marta qoidabuzarlik → 1 kun blok
    maxStrikes: Number(process.env.FORBIDDEN_MAX_STRIKES) || 3,
    blockDurationMs: Number(process.env.FORBIDDEN_BLOCK_MS) || (24 * 60 * 60 * 1000)
  },

  // ============================================================
  // BACKUP
  // ============================================================
  backup: {
    // Avtomatik backup yoqilganmi
    enabled: process.env.BACKUP_ENABLED === 'true',

    // Qayerga saqlash (default: data/backups/)
    directory: process.env.BACKUP_DIR || 'data/backups',

    // Kuniga bir marta | haftada bir marta | oyda bir marta
    schedule: process.env.BACKUP_SCHEDULE || 'daily'
  },

  // ============================================================
  // LOGGING
  // ============================================================
  logging: {
    // Log darajasi: 'debug' | 'info' | 'warn' | 'error'
    level: process.env.LOG_LEVEL || 'info',

    // Konsolga chiqarish
    console: process.env.LOG_CONSOLE !== 'false',

    // Faylga yozish (kelajakda)
    file: process.env.LOG_FILE || 'YOUR_LOG_FILE_PATH'
  },

  // ============================================================
  // ADMIN (bootstrap — faqat birinchi adminni yaratish uchun)
  // ============================================================
  admin: {
    bootstrap: {
      nickname: process.env.ADMIN_NICKNAME || 'YOUR_ADMIN_NICKNAME',
      password: process.env.ADMIN_PASSWORD || 'YOUR_ADMIN_PASSWORD',
      telegramId: process.env.ADMIN_TELEGRAM_ID || 'YOUR_ADMIN_TELEGRAM_ID'
    }
  },

  // ============================================================
  // AUTO-CLEANUP
  // ============================================================
  cleanup: {
    // Avtomatik tozalashni yoqish
    enabled: process.env.CLEANUP_ENABLED !== 'false',

    // Har necha ms da ishga tushsin (1 soat = 3600000)
    intervalMs: Number(process.env.CLEANUP_INTERVAL_MS) || (60 * 60 * 1000),

    // "Sold" website'larni necha ms dan keyin o'chirish (24 soat)
    soldWebsiteTtlMs: Number(process.env.CLEANUP_SOLD_TTL_MS) || (24 * 60 * 60 * 1000),

    // Sessiyalarni necha ms dan keyin o'chirish (7 kun)
    sessionTtlMs: Number(process.env.CLEANUP_SESSION_TTL_MS) || (7 * 24 * 60 * 60 * 1000)
  }

};