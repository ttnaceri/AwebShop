// frontend/js/api.js
// AWebShop — markaziy API klient.

(function () {
  'use strict';

  var API_BASE =
    window.AWEBSHOP_API_BASE ||
    (location.hostname === 'localhost' || location.hostname === '127.0.0.1'
      ? 'http://localhost:3000'
      : 'https://ttnaceri.github.io/AwebShop/55668576');

  var TOKEN_KEY = 'aw_token';

  var API = {
    getToken: function () {
      try { return localStorage.getItem(TOKEN_KEY); }
      catch (_) { return null; }
    },

    setToken: function (t) {
      try {
        if (t) localStorage.setItem(TOKEN_KEY, t);
        else localStorage.removeItem(TOKEN_KEY);
      } catch (_) {}
    },

    clearToken: function () {
      try { localStorage.removeItem(TOKEN_KEY); }
      catch (_) {}
    },

    request: async function (path, opts) {
      var o = opts || {};
      var method = o.method || 'GET';
      var body = o.body || null;
      var auth = o.auth !== false;

      var headers = { 'Content-Type': 'application/json' };
      if (auth) {
        var t = this.getToken();
        if (t) headers['Authorization'] = 'Bearer ' + t;
      }

      var fetchOpts = { method: method, headers: headers, credentials: 'omit' };
      if (body) fetchOpts.body = JSON.stringify(body);

      var res;
      try {
        res = await fetch(API_BASE + path, fetchOpts);
      } catch (e) {
        console.error('[api] Network error:', e.message, 'URL:', API_BASE + path);
        return { success: false, message: 'Network error.', code: 'NETWORK_ERROR' };
      }

      var data = null;
      try { data = await res.json(); }
      catch (_) { data = { success: false, message: 'Invalid response', code: 'INVALID_JSON' }; }

      // 401 — faqat TOKEN MUAMMOSI bo'lsa o'chirish
      // (403 — permission muammosi, tokenni o'chirmaslik!)
      if (res.status === 401) {
        console.warn('[api] 401 Unauthorized — token cleared');
        API.clearToken();
      }

      return data;
    },

    // ---------- AUTH ----------
    requestVerification: function (p) { return this.request('/api/auth/request-verification', { method: 'POST', body: p, auth: false }); },
    register: function (p) { return this.request('/api/auth/register', { method: 'POST', body: p, auth: false }); },
    login: function (p) { return this.request('/api/auth/login', { method: 'POST', body: p, auth: false }); },
    logout: function () { return this.request('/api/auth/logout', { method: 'POST', auth: true }); },
    me: function () { return this.request('/api/auth/me'); },
    forgotPassword: function (p) { return this.request('/api/auth/forgot-password', { method: 'POST', body: p, auth: false }); },
    resetPassword: function (p) { return this.request('/api/auth/reset-password', { method: 'POST', body: p, auth: false }); },

    // ---------- USERS ----------
    profile: function () { return this.request('/api/users/profile'); },
    updateProfile: function (p) { return this.request('/api/users/profile', { method: 'PUT', body: p }); },
    myWebsites: function () { return this.request('/api/users/websites'); },
    myTransactions: function () { return this.request('/api/users/transactions'); },
    myReviews: function () { return this.request('/api/users/reviews'); },

    // ---------- WEBSITES ----------
    listWebsites: function (params) {
      var q = new URLSearchParams(params || {}).toString();
      return this.request('/api/websites' + (q ? '?' + q : ''), { auth: false });
    },
    websiteDetail: function (webId) { return this.request('/api/websites/' + webId, { auth: false }); },
    createWebsite: function (p) { return this.request('/api/websites', { method: 'POST', body: p }); },
    buyWebsite: function (webId, p) { return this.request('/api/websites/' + webId + '/buy', { method: 'POST', body: p || {} }); },

    // ---------- TOKEN ----------
    tokenBalance: function () { return this.request('/api/token/balance'); },
    tokenRate: function () { return this.request('/api/token/rate', { auth: false }); },
    tokenHistory: function () { return this.request('/api/token/history'); },
    tokenTopup: function (p) { return this.request('/api/token/topup', { method: 'POST', body: p }); },
    tokenTransfer: function (p) { return this.request('/api/token/transfer', { method: 'POST', body: p }); },
    tokenWithdraw: function (p) { return this.request('/api/token/withdraw', { method: 'POST', body: p }); },

    // ---------- PREMIUM ----------
    premiumPlans: function () { return this.request('/api/premium/plans', { auth: false }); },
    premiumSubscribe: function (p) { return this.request('/api/premium/subscribe', { method: 'POST', body: p }); },
    premiumStatus: function () { return this.request('/api/premium/status'); },
    premiumCancel: function () { return this.request('/api/premium/cancel', { method: 'POST' }); },
    premiumTrial: function () { return this.request('/api/premium/trial', { method: 'POST' }); },

    // ---------- ADMIN ----------
    adminStats: function () { return this.request('/api/admin/stats'); },
    adminUsers: function () { return this.request('/api/admin/users'); },
    adminBlockUser: function (userId, blocked) { return this.request('/api/admin/users/block', { method: 'POST', body: { userId: userId, blocked: blocked } }); },
    adminWebsites: function () { return this.request('/api/admin/websites'); },
    adminEscrow: function () { return this.request('/api/admin/escrow'); },
    adminEscrowUpdate: function (escrowId, status, adminNotes) {
      return this.request('/api/admin/escrow/update', { method: 'POST', body: { escrowId: escrowId, status: status, adminNotes: adminNotes || '' } });
    },
    adminWithdrawals: function () { return this.request('/api/admin/withdraw'); },
    adminWithdrawDecision: function (withdrawalId, decision) {
      return this.request('/api/admin/withdraw/approve', { method: 'POST', body: { withdrawalId: withdrawalId, decision: decision } });
    },
    adminVerifyPayment: function (transactionId, decision, adminNotes) {
      return this.request('/api/admin/payments/verify', { method: 'POST', body: { transactionId: transactionId, decision: decision, adminNotes: adminNotes || '' } });
    },
    adminLogs: function () { return this.request('/api/admin/logs'); }
  };

  // Admin API helper
  API.adminGet = function (path, params) {
    var q = new URLSearchParams(params || {}).toString();
    return this.request('/api/admin/' + path + (q ? '?' + q : ''));
  };
  API.adminPost   = function (path, body) { return this.request('/api/admin/' + path, { method: 'POST',   body: body }); };
  API.adminPut    = function (path, body) { return this.request('/api/admin/' + path, { method: 'PUT',    body: body }); };
  API.adminDelete = function (path, body) { return this.request('/api/admin/' + path, { method: 'DELETE', body: body }); };

  window.API = API;
  window.API_BASE = API_BASE;

  console.log('[api] Loaded. API_BASE =', API_BASE);
})();