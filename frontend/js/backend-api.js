// frontend/js/backend-api.js
// AwebShop — external backend klient (myBackend-cf).
// X-Master-Key, API URL, fetch helpers.

(function () {
  'use strict';

  // ============================================================
  // CONFIG (bu yerga yoki config.js dan)
  // ============================================================
  var BACKEND_CONFIG = window.AWEBSHOP_BACKEND || {
    apiUrl: 'https://mybackend-cf.updbackend.workers.dev',
    masterKey: 'XMK_aB3xK9mP2qR7tY8wN4vL6jF1sD2hG5'
  };

  var DEFAULT_TIMEOUT = 15000; // 15 sekund

  // ============================================================
  // XSS HIMOYASI
  // ============================================================
  function escapeHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  // ============================================================
  // FETCH HELPER
  // ============================================================
  async function fetchWithTimeout(url, options, timeoutMs) {
    var controller = new AbortController();
    var timeout = setTimeout(function () { controller.abort(); }, timeoutMs || DEFAULT_TIMEOUT);
    try {
      var res = await fetch(url, Object.assign({}, options, { signal: controller.signal }));
      clearTimeout(timeout);
      return res;
    } catch (e) {
      clearTimeout(timeout);
      throw e;
    }
  }

  /**
   * Umumiy API so'rovi.
   * @param {string} path - '/api/v1/me', '/api/v1/data' va h.k.
   * @param {object} opts - { method, body, auth }
   * @returns {Promise<object>}
   */
  async function apiRequest(path, opts) {
    var o = opts || {};
    var method = o.method || 'GET';
    var body = o.body || null;
    var auth = o.auth !== false;

    var headers = {
      'Content-Type': 'application/json'
    };

    if (auth) {
      headers['x-master-key'] = BACKEND_CONFIG.masterKey;
    }

    var fetchOpts = { method: method, headers: headers };
    if (body) fetchOpts.body = JSON.stringify(body);

    var url = BACKEND_CONFIG.apiUrl + path;

    console.log('[backend-api] ' + method + ' ' + url);

    try {
      var res = await fetchWithTimeout(url, fetchOpts);

      var data = null;
      try { data = await res.json(); }
      catch (_) { data = { success: false, message: 'Invalid JSON', code: 'INVALID_JSON' }; }

      if (!res.ok) {
        console.error('[backend-api] HTTP ' + res.status, data);
        return {
          success: false,
          message: (data && data.message) || ('HTTP ' + res.status),
          code: 'HTTP_' + res.status,
          data: data
        };
      }

      return data;
    } catch (e) {
      console.error('[backend-api] Network error:', e.message);
      return {
        success: false,
        message: 'Network error. Backend ishlayaptimi?',
        code: 'NETWORK_ERROR',
        error: e.message
      };
    }
  }

  // ============================================================
  // API WRAPPERS
  // ============================================================
  var BackendAPI = {
    // ---------- General ----------
    me: function () {
      return apiRequest('/api/v1/me');
    },
    all: function () {
      return apiRequest('/api/v1/all');
    },

    // ---------- Data CRUD ----------
    createData: function (data) {
      return apiRequest('/api/v1/data', { method: 'POST', body: data });
    },
    getData: function (id) {
      return apiRequest('/api/v1/data/' + encodeURIComponent(id));
    },
    updateData: function (id, data) {
      return apiRequest('/api/v1/data/' + encodeURIComponent(id), { method: 'PUT', body: data });
    },
    deleteData: function (id) {
      return apiRequest('/api/v1/data/' + encodeURIComponent(id), { method: 'DELETE' });
    },

    // ---------- Products ----------
    async listProducts() {
      var res = await apiRequest('/api/v1/all');
      if (!res || !res.success) return { success: false, items: [], message: (res && res.message) };

      // /api/v1/all dan products ni ajratib olish
      var all = res.data || res;
      var products = [];

      // Agar data array bo'lsa — type === 'product' ni filtrlaymiz
      if (Array.isArray(all)) {
        products = all.filter(function (x) { return x && x.type === 'product'; });
      }
      // Agar data object bo'lsa — .products yoki .items ni qidiramiz
      else if (typeof all === 'object') {
        if (Array.isArray(all.products)) products = all.products;
        else if (Array.isArray(all.items)) products = all.items.filter(function (x) { return x && x.type === 'product'; });
        else if (Array.isArray(all.data)) products = all.data.filter(function (x) { return x && x.type === 'product'; });
      }

      return { success: true, data: products, items: products };
    },

    // ---------- Users ----------
    async registerUser(userData) {
      var payload = Object.assign({ type: 'user' }, userData);
      return apiRequest('/api/v1/data', { method: 'POST', body: payload });
    },

    async findUserByNickname(nickname) {
      var res = await apiRequest('/api/v1/all');
      if (!res || !res.success) return { success: false, data: [] };
      var all = res.data || res;
      var users = [];
      if (Array.isArray(all)) users = all.filter(function (x) { return x && x.type === 'user'; });
      else if (typeof all === 'object' && Array.isArray(all.users)) users = all.users;
      else if (typeof all === 'object' && Array.isArray(all.items)) users = all.items.filter(function (x) { return x && x.type === 'user'; });
      var filtered = users.filter(function (u) { return u.nickname === nickname; });
      return { success: true, data: filtered };
    },

    // ---------- Orders ----------
    async createOrder(orderData) {
      var payload = Object.assign({ type: 'order' }, orderData);
      return apiRequest('/api/v1/data', { method: 'POST', body: payload });
    },

    // ---------- Promocodes ----------
    async findPromocode(code) {
      var res = await apiRequest('/api/v1/all');
      if (!res || !res.success) return { success: false, data: [] };
      var all = res.data || res;
      var promos = [];
      if (Array.isArray(all)) promos = all.filter(function (x) { return x && x.type === 'promocode'; });
      else if (typeof all === 'object' && Array.isArray(all.promocodes)) promos = all.promocodes;
      else if (typeof all === 'object' && Array.isArray(all.items)) promos = all.items.filter(function (x) { return x && x.type === 'promocode'; });
      var found = promos.filter(function (p) { return p.code === code; });
      return { success: true, data: found };
    },

    // ---------- Custom ----------
    async saveCustom(key, value, userId) {
      return apiRequest('/api/v1/data', {
        method: 'POST',
        body: {
          type: 'custom',
          key: key,
          value: value,
          userId: userId || null
        }
      });
    },

    async loadCustom(key, userId) {
      var res = await apiRequest('/api/v1/all');
      if (!res || !res.success) return { success: false, data: [] };
      var all = res.data || res;
      var customs = [];
      if (Array.isArray(all)) customs = all.filter(function (x) { return x && x.type === 'custom'; });
      else if (typeof all === 'object' && Array.isArray(all.custom)) customs = all.custom;
      else if (typeof all === 'object' && Array.isArray(all.items)) customs = all.items.filter(function (x) { return x && x.type === 'custom'; });
      var filtered = customs.filter(function (c) {
        if (c.key !== key) return false;
        if (userId && c.userId !== userId) return false;
        return true;
      });
      return { success: true, data: filtered };
    }
  };

  // ============================================================
  // HELPERS (XSS, formatting)
  // ============================================================
  function fmtUZS(n) {
    return new Intl.NumberFormat('uz-UZ').format(Math.round(n || 0)) + " so'm";
  }
  function fmtUSD(n) {
    return '$' + Number(n || 0).toFixed(2);
  }
  function showToast(msg, type) {
    var c = document.getElementById('aw-toasts');
    if (!c) {
      c = document.createElement('div');
      c.id = 'aw-toasts';
      c.style.cssText = 'position:fixed;bottom:20px;right:20px;z-index:9999;display:flex;flex-direction:column;gap:8px;';
      document.body.appendChild(c);
    }
    var t = document.createElement('div');
    t.textContent = msg;
    t.style.cssText = 'background:#1a1a1e;color:#f2f2f5;border:1px solid ' +
      (type === 'error' ? '#ff4c4c' : type === 'success' ? '#00c851' : '#7b5cff') +
      ';padding:12px 16px;border-radius:10px;font-size:14px;max-width:320px;box-shadow:0 6px 24px rgba(0,0,0,0.3);';
    c.appendChild(t);
    setTimeout(function () { t.remove(); }, 3500);
  }

  // ============================================================
  // EXPORTS
  // ============================================================
  window.BackendAPI = BackendAPI;
  window.escapeHtml = escapeHtml;
  window.fmtUZS = fmtUZS;
  window.fmtUSD = fmtUSD;
  window.showToast = showToast;
  window.BACKEND_CONFIG = BACKEND_CONFIG;

  console.log('[backend-api] Loaded. API:', BACKEND_CONFIG.apiUrl);
})();