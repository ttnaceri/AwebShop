// config.example.js
// Bu faylni "config.js" deb nusxalab, haqiqiy qiymatlarni kiriting.
// config.js .gitignore ga qo'shilgan — hech qachon GitHub ga chiqmaydi.

module.exports = {
  server: {
    port: process.env.PORT || 3000,
    host: process.env.HOST || '0.0.0.0',
    baseUrl: process.env.BASE_URL || 'http://localhost:3000'
  },

  jwt: {
    // Ishlab chiqarishda: openssl rand -hex 32
    secret: process.env.JWT_SECRET || 'CHANGE_ME_TO_A_LONG_RANDOM_STRING',
    tokenTtlMs: 1000 * 60 * 60 * 24 * 7 // 7 kun
  },

  exchangeRate: {
    enabled: true,
    provider: 'exchangerate-api', // 'exchangerate-api' | 'manual'
    apiKey: process.env.EXCHANGE_RATE_API_KEY || 'YOUR_EXCHANGE_RATE_API_KEY',
    baseCurrency: 'USD',
    endpoint: 'https://v6.exchangerate-api.com/v6',
    fallbackRate: 12650, // 1 USD = 12650 UZS (manual fallback)
    cacheTtlMs: 1000 * 60 * 60 // 1 soat
  },

  awc: {
    // 1 AWC = 10 000 UZS (boshlang'ich)
    priceUZS: 10000,
    symbol: 'AWC',
    name: 'AwebShop Coin'
  },

  paymentApis: {
    payme: {
      enabled: false,
      apiKey: process.env.PAYME_API_KEY || 'YOUR_PAYME_API_KEY',
      merchantId: process.env.PAYME_MERCHANT_ID || 'YOUR_PAYME_MERCHANT_ID',
      endpoint: 'https://checkout.paycom.uz',
      currency: 'UZS',
      callbackUrl: ''
    },
    hamkorbank: {
      enabled: false,
      apiKey: process.env.HAMKORBANK_API_KEY || 'YOUR_HAMKORBANK_API_KEY',
      merchantId: process.env.HAMKORBANK_MERCHANT_ID || 'YOUR_HAMKORBANK_MERCHANT_ID',
      endpoint: '',
      currency: 'UZS',
      callbackUrl: ''
    }
  },

  telegram: {
    enabled: false,
    botToken: process.env.TELEGRAM_BOT_TOKEN || 'YOUR_TELEGRAM_BOT_TOKEN',
    botUsername: process.env.TELEGRAM_BOT_USERNAME || 'YourBotUsername',
    adminChatId: process.env.TELEGRAM_ADMIN_CHAT_ID || '',
    codeTtlMs: 1000 * 60 * 10 // 10 daqiqa
  },

  fees: {
    listingFeeUZS: 10000,
    saleCommissionPercent: 5,
    escrowFeePercent: 0.4,
    cashbackPercent: 1,
    premiumCashbackPercent: 3,
    referralBonusAWC: 1,
    rewardedAdsPerFreeListing: 15
  },

  escrow: {
    sellerTransferDays: 7,
    verificationDays: 3,
    autoReleaseDays: 7,
    disputeResponseDays: 3,
    refundProcessingDays: 5
  },

  security: {
    maxLoginAttempts: 5,
    lockoutMinutes: 15,
    rateLimitWindowMs: 60 * 1000,
    rateLimitMaxRequests: 60,
    passwordMinLength: 8
  }
};

telegram: {
  enabled: false,                                 // true qilganingizda bot ishlaydi
  botToken: process.env.TELEGRAM_BOT_TOKEN || 'YOUR_TELEGRAM_BOT_TOKEN',
  botUsername: process.env.TELEGRAM_BOT_USERNAME || 'YourBotUsername',
  adminChatId: process.env.TELEGRAM_ADMIN_CHAT_ID || '',  // @userinfobot orqali oling
  codeTtlMs: 1000 * 60 * 10,                       // 10 daqiqa
  forceSubscribe: {
    enabled: true
  }
}