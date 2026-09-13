// frontend/js/api.js
// Backend bilan bog'lanish uchun markaziy API klient.
// Deploymentda API_BASE ni backend manziliga o'zgartiring.

const API_BASE =
  window.AWEBSHOP_API_BASE ||
  (location.hostname === 'localhost' || location.hostname === '127.0.0.1'
    ? 'http://localhost:3000'
    : 'https://ttnaceri.github.io/AwebShop/55668576'); // placeholder

const TOKEN_KEY = 'aw_token';

const API = {
  getToken() {
    return localStorage.getItem(TOKEN_KEY);
  },
  setToken(t) {
    if (t) localStorage.setItem(TOKEN_KEY, t);
    else localStorage.removeItem(TOKEN_KEY);
  },
  clearToken() {
    localStorage.removeItem(TOKEN_KEY);
  },

  async request(path, { method = 'GET', body = null, auth = true } = {}) {
    const headers = { 'Content-Type': 'application/json' };
    if (auth) {
      const t = this.getToken();
      if (t) headers['Authorization'] = 'Bearer ' + t;
    }
    const opts = { method, headers };
    if (body) opts.body = JSON.stringify(body);

    let res;
    try {
      res = await fetch(API_BASE + path, opts);
    } catch (e) {
      return { success: false, message: 'Network error. Backend ishlayaptimi?', code: 'NETWORK_ERROR' };
    }

    let data = null;
    try { data = await res.json(); } catch { data = { success: false, message: 'Invalid response' }; }

    if (res.status === 401) {
      API.clearToken();
    }
    return data;
  },

  // ---------- AUTH ----------
  requestVerification(payload) {
    return this.request('/api/auth/request-verification', { method: 'POST', body: payload, auth: false });
  },
  register(payload) {
    return this.request('/api/auth/register', { method: 'POST', body: payload, auth: false });
  },
  login(payload) {
    return this.request('/api/auth/login', { method: 'POST', body: payload, auth: false });
  },
  logout() {
    return this.request('/api/auth/logout', { method: 'POST', auth: true });
  },
  me() {
    return this.request('/api/auth/me');
  },
  forgotPassword(payload) {
    return this.request('/api/auth/forgot-password', { method: 'POST', body: payload, auth: false });
  },
  resetPassword(payload) {
    return this.request('/api/auth/reset-password', { method: 'POST', body: payload, auth: false });
  },

  // ---------- USERS ----------
  profile() { return this.request('/api/users/profile'); },
  updateProfile(payload) { return this.request('/api/users/profile', { method: 'PUT', body: payload }); },
  myWebsites() { return this.request('/api/users/websites'); },
  myTransactions() { return this.request('/api/users/transactions'); },
  myReviews() { return this.request('/api/users/reviews'); },

  // ---------- WEBSITES ----------
  listWebsites(params = {}) {
    const q = new URLSearchParams(params).toString();
    return this.request('/api/websites' + (q ? '?' + q : ''), { auth: false });
  },
  websiteDetail(webId) {
    return this.request('/api/websites/' + webId, { auth: false });
  },
  createWebsite(payload) {
    return this.request('/api/websites', { method: 'POST', body: payload });
  },
  buyWebsite(webId, payload = {}) {
    return this.request('/api/websites/' + webId + '/buy', { method: 'POST', body: payload });
  },

  // ---------- TOKEN ----------
  tokenBalance() { return this.request('/api/token/balance'); },
  tokenRate() { return this.request('/api/token/rate', { auth: false }); },
  tokenHistory() { return this.request('/api/token/history'); },
  tokenTopup(payload) { return this.request('/api/token/topup', { method: 'POST', body: payload }); },
  tokenTransfer(payload) { return this.request('/api/token/transfer', { method: 'POST', body: payload }); },
  tokenWithdraw(payload) { return this.request('/api/token/withdraw', { method: 'POST', body: payload }); },

  // ---------- PREMIUM ----------
  premiumPlans() { return this.request('/api/premium/plans', { auth: false }); },
  premiumSubscribe(payload) { return this.request('/api/premium/subscribe', { method: 'POST', body: payload }); },
  premiumStatus() { return this.request('/api/premium/status'); },
  premiumCancel() { return this.request('/api/premium/cancel', { method: 'POST' }); },
  premiumTrial() { return this.request('/api/premium/trial', { method: 'POST' }); },

  // ---------- ADMIN ----------
  adminStats() { return this.request('/api/admin/stats'); },
  adminUsers() { return this.request('/api/admin/users'); },
  adminBlockUser(userId, blocked) {
    return this.request('/api/admin/users/block', { method: 'POST', body: { userId, blocked } });
  },
  adminWebsites() { return this.request('/api/admin/websites'); },
  adminEscrow() { return this.request('/api/admin/escrow'); },
  adminEscrowUpdate(escrowId, status, adminNotes = '') {
    return this.request('/api/admin/escrow/update', { method: 'POST', body: { escrowId, status, adminNotes } });
  },
  adminWithdrawals() { return this.request('/api/admin/withdraw'); },
  adminWithdrawDecision(withdrawalId, decision) {
    return this.request('/api/admin/withdraw/approve', { method: 'POST', body: { withdrawalId, decision } });
  },
  adminVerifyPayment(transactionId, decision, adminNotes = '') {
    return this.request('/api/admin/payments/verify', { method: 'POST', body: { transactionId, decision, adminNotes } });
  },
  adminLogs() { return this.request('/api/admin/logs'); }
};

window.API = API;
window.API_BASE = API_BASE;