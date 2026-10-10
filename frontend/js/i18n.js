// frontend/js/i18n.js
// AWebShop — barcha matnlar va tarjimalar. Yagona fayl.

(function () {
  'use strict';

  const TRANSLATIONS = {
    en: {
      // ---------- Umumiy ----------
      appName: 'AWebShop',
      home: 'Home', store: 'Store', sell: 'Sell', wallet: 'Wallet',
      profile: 'Profile', about: 'About', admin: 'Admin',
      login: 'Login', register: 'Register', logout: 'Logout',
      search: 'Search', buy: 'Buy', sell_: 'Sell', cancel: 'Cancel', save: 'Save',
      edit: 'Edit', delete: 'Delete', add: 'Add', create: 'Create', update: 'Update',
      close: 'Close', confirm: 'Confirm', yes: 'Yes', no: 'No',
      loading: 'Loading…', noResults: 'No results.',
      price: 'Price', topic: 'Topic', seller: 'Seller', domain: 'Domain',
      status: 'Status', actions: 'Actions', created: 'Created',
      save_: 'Save', refresh: 'Refresh', filter: 'Filter',
      all: 'All', enabled: 'Enabled', disabled: 'Disabled',
      name: 'Name', id: 'ID', amount: 'Amount', date: 'Date',
      description: 'Description', image: 'Image', type: 'Type',

      // ---------- Theme ----------
      dark: 'Dark', light: 'Light',
      switchToDark: 'Switch to dark mode',
      switchToLight: 'Switch to light mode',

      // ---------- Auth ----------
      welcomeBack: 'Welcome back',
      createAccount: 'Create your account',
      nickname: 'Nickname', password: 'Password', phone: 'Phone',
      telegramUsername: 'Telegram username', telegramId: 'Telegram ID',
      verificationCode: 'Verification code',
      sendCode: 'Send code', recoverAccount: 'Recover account',
      invalidCredentials: 'Invalid credentials.',

      // ---------- Store ----------
      exploreStore: 'Explore Store',
      sellAWebsite: 'Sell a Website',
      recommendedWebsites: 'Recommended Websites',
      latestEvents: 'Latest Events',
      premiumPlans: 'Premium Plans',
      seeAll: 'See all',
      safe: 'Safe (escrow)', fast: 'Fast (direct)',
      saleType: 'Sale Type',
      sale_safe_hint: 'Escrow-protected. Admin holds funds until you confirm.',
      sale_fast_hint: 'Direct seller-to-buyer. Fewer protections.',

      // ---------- Wallet ----------
      balance: 'Balance', topup: 'Top up', transfer: 'Transfer',
      withdraw: 'Withdraw', history: 'History', transactions: 'Transactions',
      awcBalance: 'AWC Balance', recentTransactions: 'Recent transactions',

      // ---------- Premium ----------
      monthly: 'Monthly', yearly: 'Yearly',
      subscribe: 'Subscribe', startTrial: 'Start Free Trial',
      commission: 'commission',

      // ---------- Admin ----------
      adminPanel: 'Admin Panel',
      dashboard: 'Dashboard', analytics: 'Analytics', logs: 'Logs', console: 'Console',
      users: 'Users', admins: 'Admins', environment: 'Environment', security: 'Security',
      websites: 'Websites', orders: 'Orders', escrow: 'Escrow',
      withdrawals: 'Withdrawals', payments: 'Payments', cards: 'Cards',
      refunds: 'Refunds', domains: 'Domains', stock: 'Stock', featured: 'Featured',
      promocodes: 'Promocodes', discounts: 'Discounts', events: 'Events',
      announcements: 'Announcements', popups: 'Popups', ads: 'Ads',
      badges: 'Badges', reviews: 'Reviews',
      themes: 'Themes', bannedWords: 'Banned Words', messages: 'Messages',
      chat: 'Chat', attachments: 'Attachments', invoice: 'Invoice',
      premium: 'Premium', prices: 'Prices', forceSubscribe: 'Force Subscribe',
      settings: 'Settings', telegram: 'Telegram', seo: 'SEO',
      notifications: 'Notifications', backup: 'Backup',
      exportImport: 'Export/Import', maintenance: 'Maintenance',
      schedule: 'Schedule', todo: 'Todo', help: 'Help',
      webhooks: 'Webhooks', forbiddenTelegramIds: 'Forbidden Telegram IDs',

      // ---------- Admin actions ----------
      newItem: 'New', editItem: 'Edit', deleteItem: 'Delete',
      block: 'Block', unblock: 'Unblock',
      approve: 'Approve', reject: 'Reject',
      view: 'View', manage: 'Manage',
      saveSettings: 'Save settings',
      confirmDelete: 'Delete this item?',
      confirmDeleteMsg: 'This action cannot be undone.',
      savedSuccess: 'Saved.',
      deletedSuccess: 'Deleted.',
      failedToLoad: 'Failed to load.',

      // ---------- Users admin ----------
      createUser: 'Create user',
      userId: 'User ID',
      userIdCustom: 'Custom User ID (SuperAdmin only)',
      assignBadge: 'Assign badge',

      // ---------- Webhooks ----------
      webhooksDescription: 'Webhooks for external integrations',
      webhookUrl: 'URL', webhookEvent: 'Event',
      webhookSecret: 'Secret', webhookActive: 'Active',
      eventUserRegistered: 'user.registered',
      eventWebsiteCreated: 'website.created',
      eventOrderCreated: 'order.created',
      eventEscrowUpdated: 'escrow.updated',
      eventPaymentVerified: 'payment.verified',

      // ---------- File uploader ----------
      uploadFile: 'Upload file',
      chooseFile: 'Choose file',
      uploading: 'Uploading…',
      uploadSuccess: 'Uploaded.',
      uploadFailed: 'Upload failed.',
      orPasteUrl: 'or paste URL',

      // ---------- Forbidden Telegram ----------
      forbiddenTelegramDescription: 'Telegram IDs that cannot register',
      addForbiddenId: 'Add forbidden ID',
      reason: 'Reason',

      // ---------- Cards ----------
      addCard: 'Add card',
      cardNumber: 'Card number', cardOwner: 'Owner', cardBank: 'Bank',
      cardExpiry: 'Expiry', cardDefault: 'Default',

      // ---------- Todo ----------
      todoDescription: 'Admin task list',
      open: 'Open', done: 'Done',
      taskTitle: 'Task title',

      // ---------- Toasts ----------
      copied: 'Copied to clipboard.',
      networkError: 'Network error.'
    },

    uz: {
      // ---------- Umumiy ----------
      appName: 'AWebShop',
      home: 'Bosh sahifa', store: "Do'kon", sell: 'Sotish', wallet: 'Hamyon',
      profile: 'Profil', about: 'Haqida', admin: 'Admin',
      login: 'Kirish', register: "Ro'yxatdan o'tish", logout: 'Chiqish',
      search: 'Qidirish', buy: 'Sotib olish', sell_: 'Sotish', cancel: 'Bekor qilish', save: 'Saqlash',
      edit: 'Tahrirlash', delete: "O'chirish", add: "Qo'shish", create: 'Yaratish', update: 'Yangilash',
      close: 'Yopish', confirm: 'Tasdiqlash', yes: 'Ha', no: "Yo'q",
      loading: 'Yuklanmoqda…', noResults: 'Natija topilmadi.',
      price: 'Narx', topic: 'Mavzu', seller: 'Sotuvchi', domain: 'Domen',
      status: 'Holat', actions: 'Harakatlar', created: 'Yaratilgan',
      refresh: 'Yangilash', filter: 'Filtr',
      all: 'Barchasi', enabled: 'Yoqilgan', disabled: "O'chirilgan",
      name: 'Nomi', id: 'ID', amount: 'Miqdor', date: 'Sana',
      description: 'Tavsif', image: 'Rasm', type: 'Turi',

      // ---------- Theme ----------
      dark: "Qorong'i", light: "Yorug'",
      switchToDark: "Qorong'i rejimga o'tish",
      switchToLight: "Yorug' rejimga o'tish",

      // ---------- Auth ----------
      welcomeBack: 'Xush kelibsiz',
      createAccount: 'Hisob yaratish',
      nickname: 'Taxallus', password: 'Parol', phone: 'Telefon',
      telegramUsername: 'Telegram username', telegramId: 'Telegram ID',
      verificationCode: 'Tasdiqlash kodi',
      sendCode: 'Kod yuborish', recoverAccount: 'Hisobni tiklash',
      invalidCredentials: "Noto'g'ri ma'lumotlar.",

      // ---------- Store ----------
      exploreStore: "Do'konni ko'rish",
      sellAWebsite: 'Sayt sotish',
      recommendedWebsites: 'Tavsiya etilgan saytlar',
      latestEvents: "So'nggi voqealar",
      premiumPlans: 'Premium rejalar',
      seeAll: 'Barchasini ko\'rish',
      safe: "Xavfsiz (escrow)", fast: "Tez (to'g'ridan)",
      saleType: 'Sotuv turi',
      sale_safe_hint: "Escrow himoyasi. Admin siz tasdiqlamaguningizcha pulni ushlab turadi.",
      sale_fast_hint: "To'g'ridan-to'g'ri. Himoya kamroq.",

      // ---------- Wallet ----------
      balance: 'Balans', topup: "To'ldirish", transfer: "O'tkazma",
      withdraw: 'Yechib olish', history: 'Tarix', transactions: 'Tranzaksiyalar',
      awcBalance: 'AWC balans', recentTransactions: "So'nggi tranzaksiyalar",

      // ---------- Premium ----------
      monthly: 'Oylik', yearly: 'Yillik',
      subscribe: 'Obuna', startTrial: 'Bepul sinov',
      commission: 'komissiya',

      // ---------- Admin ----------
      adminPanel: 'Admin panel',
      dashboard: 'Boshqaruv paneli', analytics: 'Analitika', logs: 'Loglar', console: 'Konsol',
      users: 'Foydalanuvchilar', admins: 'Adminlar', environment: 'Muhit', security: 'Xavfsizlik',
      websites: 'Saytlar', orders: 'Buyurtmalar', escrow: 'Escrow',
      withdrawals: 'Yechib olishlar', payments: "To'lovlar", cards: 'Kartalar',
      refunds: 'Qaytarishlar', domains: 'Domenlar', stock: 'Ombor', featured: 'Tanlangan',
      promocodes: 'Promokodlar', discounts: 'Chegirmalar', events: 'Voqealar',
      announcements: "E'lonlar", popups: 'Popup', ads: 'Reklamalar',
      badges: 'Nishonlar', reviews: 'Sharhlar',
      themes: 'Mavzular', bannedWords: "Taqiqlangan so'zlar", messages: 'Xabarlar',
      chat: 'Chat', attachments: 'Ilovalar', invoice: 'Hisob-faktura',
      premium: 'Premium', prices: 'Narxlar', forceSubscribe: 'Majburiy obuna',
      settings: 'Sozlamalar', telegram: 'Telegram', seo: 'SEO',
      notifications: 'Bildirishnomalar', backup: 'Zahira nusxa',
      exportImport: 'Eksport/Import', maintenance: 'Texnik xizmat',
      schedule: 'Jadval', todo: 'Vazifalar', help: 'Yordam',
      webhooks: 'Webhooks', forbiddenTelegramIds: "Taqiqlangan Telegram ID'lar",

      // ---------- Admin actions ----------
      newItem: 'Yangi', editItem: 'Tahrirlash', deleteItem: "O'chirish",
      block: 'Bloklash', unblock: 'Blokdan chiqarish',
      approve: 'Tasdiqlash', reject: 'Rad etish',
      view: "Ko'rish", manage: 'Boshqarish',
      saveSettings: 'Sozlamalarni saqlash',
      confirmDelete: "O'chirishni tasdiqlaysizmi?",
      confirmDeleteMsg: "Bu amalni qaytarib bo'lmaydi.",
      savedSuccess: 'Saqlandi.',
      deletedSuccess: "O'chirildi.",
      failedToLoad: 'Yuklab bo\'lmadi.',

      // ---------- Users admin ----------
      createUser: 'Foydalanuvchi yaratish',
      userId: 'Foydalanuvchi ID',
      userIdCustom: 'Maxsus ID (faqat SuperAdmin)',
      assignBadge: 'Nishon berish',

      // ---------- Webhooks ----------
      webhooksDescription: 'Tashqi integratsiyalar uchun webhooks',
      webhookUrl: 'URL', webhookEvent: 'Hodisa',
      webhookSecret: 'Maxfiy kalit', webhookActive: 'Faol',
      eventUserRegistered: 'user.registered',
      eventWebsiteCreated: 'website.created',
      eventOrderCreated: 'order.created',
      eventEscrowUpdated: 'escrow.updated',
      eventPaymentVerified: 'payment.verified',

      // ---------- File uploader ----------
      uploadFile: 'Fayl yuklash',
      chooseFile: 'Faylni tanlash',
      uploading: 'Yuklanmoqda…',
      uploadSuccess: 'Yuklandi.',
      uploadFailed: 'Yuklab bo\'lmadi.',
      orPasteUrl: 'yoki URL kiriting',

      // ---------- Forbidden Telegram ----------
      forbiddenTelegramDescription: "Ro'yxatdan o'ta olmaydigan Telegram ID'lar",
      addForbiddenId: "Taqiqlangan ID qo'shish",
      reason: 'Sabab',

      // ---------- Cards ----------
      addCard: "Karta qo'shish",
      cardNumber: 'Karta raqami', cardOwner: 'Egasi', cardBank: 'Bank',
      cardExpiry: 'Amal muddati', cardDefault: 'Asosiy',

      // ---------- Todo ----------
      todoDescription: 'Admin vazifalari',
      open: 'Ochiq', done: 'Bajarilgan',
      taskTitle: 'Vazifa nomi',

      // ---------- Toasts ----------
      copied: 'Nusxa olindi.',
      networkError: 'Tarmoq xatosi.'
    }
  };

  function getLang() {
    return localStorage.getItem('aw_lang') || 'en';
  }

  function setLang(lang) {
    if (!TRANSLATIONS[lang]) lang = 'en';
    localStorage.setItem('aw_lang', lang);
    // Sahifani yangilash kerak emas — matnlarni qayta chizish uchun event
    window.dispatchEvent(new CustomEvent('aw:lang-changed', { detail: { lang } }));
  }

  function t(key, fallback) {
    const lang = getLang();
    const dict = TRANSLATIONS[lang] || TRANSLATIONS.en;
    if (dict[key] != null) return dict[key];
    if (TRANSLATIONS.en[key] != null) return TRANSLATIONS.en[key];
    return fallback != null ? fallback : key;
  }

  function getAll(lang) {
    return TRANSLATIONS[lang || getLang()] || TRANSLATIONS.en;
  }

  window.I18N = {
    t,
    setLang,
    getLang,
    getAll,
    TRANSLATIONS
  };

  // Eski `t()` funksiyasini ham qo'llab-quvvatlash
  window.t = t;
  window.setLang = setLang;
})();