// frontend/js/app.js
// Global utilitlar: toast, currency formatting, sana, theme, i18n.

const I18N = {
  en: {
    home: 'Home', store: 'Store', sell: 'Sell', wallet: 'Wallet', profile: 'Profile', about: 'About',
    login: 'Login', register: 'Register', logout: 'Logout',
    search: 'Search', buy: 'Buy', cancel: 'Cancel', save: 'Save',
    loading: 'Loading…', noResults: 'No results.',
    price: 'Price', topic: 'Topic', seller: 'Seller', domain: 'Domain',
    safe: 'Safe (escrow)', fast: 'Fast (direct)', saleType: 'Sale Type',
    sale_safe_hint: 'Escrow-protected transaction. Admin holds funds until you confirm.',
    sale_fast_hint: 'Direct seller-to-buyer. Fewer protections.',
    balance: 'Balance', topup: 'Top up', transfer: 'Transfer', withdraw: 'Withdraw',
    history: 'History', amount: 'Amount', status: 'Status', date: 'Date',
    monthly: 'Monthly', yearly: 'Yearly', subscribe: 'Subscribe', startTrial: 'Start Free Trial',
    plans: 'Premium Plans', recommended: 'Recommended', latestEvents: 'Latest Events',
    notifications: 'Notifications', dark: 'Dark', light: 'Light',
    webId: 'Web ID', orderId: 'Order ID'
  },
  uz: {
    home: 'Bosh sahifa', store: "Do'kon", sell: 'Sotish', wallet: 'Hamyon', profile: 'Profil', about: 'Haqida',
    login: 'Kirish', register: "Ro'yxatdan o'tish", logout: 'Chiqish',
    search: 'Qidirish', buy: 'Sotib olish', cancel: 'Bekor qilish', save: 'Saqlash',
    loading: 'Yuklanmoqda…', noResults: 'Natija topilmadi.',
    price: 'Narx', topic: 'Mavzu', seller: 'Sotuvchi', domain: 'Domen',
    safe: 'Xavfsiz (escrow)', fast: 'Tez (to\'g\'ridan)', saleType: 'Sotuv turi',
    sale_safe_hint: 'Escrow himoyasi. Admin to\'lovni siz tasdiqlamaguningizcha ushlab turadi.',
    sale_fast_hint: 'To\'g\'ridan-to\'g\'ri. Himoya kamroq.',
    balance: 'Balans', topup: "To'ldirish", transfer: 'O\'tkazma', withdraw: 'Yechib olish',
    history: 'Tarix', amount: 'Miqdor', status: 'Holat', date: 'Sana',
    monthly: 'Oylik', yearly: 'Yillik', subscribe: 'Obuna', startTrial: 'Bepul sinov',
    plans: 'Premium Rejalar', recommended: 'Tavsiya etilgan', latestEvents: 'So\'nggi Voqealar',
    notifications: 'Bildirishnomalar', dark: 'Qorong\'i', light: 'Yorug\'',
    webId: 'Web ID', orderId: 'Buyurtma ID'
  }
};

function t(key) {
  const lang = localStorage.getItem('aw_lang') || 'en';
  return (I18N[lang] && I18N[lang][key]) || I18N.en[key] || key;
}

function setLang(lang) {
  localStorage.setItem('aw_lang', lang);
  location.reload();
}

// -------- Theme --------
function applyTheme() {
  const dark = localStorage.getItem('aw_theme') !== 'light';
  document.documentElement.classList.toggle('light', !dark);
  document.documentElement.classList.toggle('dark', dark);
}
function toggleTheme() {
  const dark = localStorage.getItem('aw_theme') !== 'light';
  localStorage.setItem('aw_theme', dark ? 'light' : 'dark');
  applyTheme();
}
applyTheme();

// -------- Currency --------
let RATES = { awcPriceUZS: 10000, usdRate: 12650 };
async function loadRates() {
  const res = await API.tokenRate();
  if (res.success) {
    RATES.awcPriceUZS = res.data.awcPriceUZS;
    RATES.usdRate = res.data.usdRate;
  }
}
function fmtUZS(n) {
  return new Intl.NumberFormat('uz-UZ').format(Math.round(n || 0)) + " so'm";
}
function fmtUSD(n) {
  return '$' + Number(n || 0).toFixed(2);
}
function fmtAWC(n) {
  return Number(n || 0).toFixed(4).replace(/\.?0+$/, '') + ' AWC';
}
function fmtDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleString();
}

// -------- Toast --------
function ensureToastContainer() {
  let c = document.getElementById('aw-toasts');
  if (!c) {
    c = document.createElement('div');
    c.id = 'aw-toasts';
    document.body.appendChild(c);
  }
  return c;
}
function toast(message, type = 'info', ms = 3000) {
  const c = ensureToastContainer();
  const el = document.createElement('div');
  el.className = 'aw-toast aw-toast-' + type;
  el.textContent = message;
  c.appendChild(el);
  requestAnimationFrame(() => el.classList.add('show'));
  setTimeout(() => {
    el.classList.remove('show');
    setTimeout(() => el.remove(), 250);
  }, ms);
}

// -------- Escaping --------
function esc(str) {
  return String(str == null ? '' : str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// -------- Loading state --------
function showLoading(container, text) {
  container.innerHTML = `<div class="aw-loading">${esc(text || t('loading'))}</div>`;
}

window.t = t;
window.setLang = setLang;
window.toggleTheme = toggleTheme;
window.applyTheme = applyTheme;
window.loadRates = loadRates;
window.fmtUZS = fmtUZS;
window.fmtUSD = fmtUSD;
window.fmtAWC = fmtAWC;
window.fmtDate = fmtDate;
window.toast = toast;
window.esc = esc;
window.showLoading = showLoading;
window.RATES = RATES;