// frontend/js/auth.js
// AWebShop — Auth: session kesh, ban check, ban overlay.

(function () {
  'use strict';

  var CACHE_KEY = 'aw_user_cache';
  var CACHE_TTL = 5 * 60 * 1000; // 5 daqiqa

  var Auth = {
    user: null,
    banTimer: null,

    // ============================================================
    // LOAD (kesh bilan)
    // ============================================================
    load: async function (force) {
      var t = API.getToken();
      if (!t) {
        this.user = null;
        return null;
      }

      // Kesh tekshiruvi
      if (!force) {
        try {
          var cached = localStorage.getItem(CACHE_KEY);
          if (cached) {
            var obj = JSON.parse(cached);
            if (obj.ts && (Date.now() - obj.ts) < CACHE_TTL && obj.token === t) {
              this.user = obj.user;
              // Ban tekshiruvi
              if (this.user.banned) {
                this.showBanScreen(this.user.banReason, null, 'permanent');
              } else if (this.user.blocked && this.user.blockedUntil) {
                var untilC = new Date(this.user.blockedUntil).getTime();
                if (untilC > Date.now()) {
                  this.showBanScreen(this.user.banReason, this.user.blockedUntil, 'temporary');
                }
              }
              return this.user;
            }
          }
        } catch (_) {}
      }

      // API dan yuklash
      var res = await API.me();

      if (res && res.success) {
        this.user = res.data.user;

        // Keshga yozish
        try {
          localStorage.setItem(CACHE_KEY, JSON.stringify({
            ts: Date.now(),
            token: t,
            user: this.user
          }));
        } catch (_) {}

        // Ban tekshiruvi
        if (this.user.banned) {
          this.showBanScreen(this.user.banReason, null, 'permanent');
        } else if (this.user.blocked && this.user.blockedUntil) {
          var until = new Date(this.user.blockedUntil).getTime();
          if (until > Date.now()) {
            this.showBanScreen(this.user.banReason, this.user.blockedUntil, 'temporary');
          }
        }
        return this.user;
      }

      // 401 → token o'chirilgan
      if (res && res.code === 'UNAUTHORIZED') {
        this.user = null;
        API.clearToken();
        try { localStorage.removeItem(CACHE_KEY); } catch (_) {}
        return null;
      }

      // Ban response
      if (res && res.code === 'ACCOUNT_BANNED') {
        API.clearToken();
        this.user = null;
        try { localStorage.removeItem(CACHE_KEY); } catch (_) {}
        this.showBanScreen(res.data && res.data.reason, null, 'permanent');
        return null;
      }
      if (res && res.code === 'ACCOUNT_TEMP_BLOCKED') {
        API.clearToken();
        this.user = null;
        try { localStorage.removeItem(CACHE_KEY); } catch (_) {}
        this.showBanScreen(res.data && res.data.reason, res.data && res.data.blockedUntil, 'temporary');
        return null;
      }

      return this.user;
    },

    // ============================================================
    // CACHE
    // ============================================================
    clearCache: function () {
      try { localStorage.removeItem(CACHE_KEY); } catch (_) {}
    },

    // ============================================================
    // BAN OVERLAY
    // ============================================================
    showBanScreen: function (reason, until, type) {
      if (document.getElementById('aw-ban-overlay')) return;

      var overlay = document.createElement('div');
      overlay.id = 'aw-ban-overlay';
      overlay.className = 'aw-ban-overlay';
      overlay.innerHTML = `
        <div class="aw-ban-card">
          <h2>🚫 Account ${type === 'permanent' ? 'Permanently Banned' : 'Blocked'}</h2>
          <p class="aw-muted" id="aw-ban-msg">${
            type === 'permanent'
              ? 'Your account has been permanently banned.'
              : 'Your account is temporarily blocked.'
          }</p>
          <div class="aw-ban-timer" id="aw-ban-timer">—</div>
          <p class="aw-muted" id="aw-ban-note">${
            type === 'permanent'
              ? 'Contact support if you believe this is a mistake.'
              : 'You will regain access automatically.'
          }</p>
          <p class="aw-ban-reason" id="aw-ban-reason"></p>
        </div>
      `;
      document.body.appendChild(overlay);

      var reasonEl = document.getElementById('aw-ban-reason');
      reasonEl.textContent = reason ? 'Reason: ' + reason : '';

      if (type === 'permanent' || !until) {
        document.getElementById('aw-ban-timer').textContent = '∞';
        return;
      }

      var target = new Date(until).getTime();
      var timerEl = document.getElementById('aw-ban-timer');
      var self = this;

      function tick() {
        var diff = target - Date.now();
        if (diff <= 0) {
          if (self.banTimer) clearInterval(self.banTimer);
          self.clearBanScreen();
          location.reload();
          return;
        }
        var s = Math.floor(diff / 1000);
        var h = String(Math.floor(s / 3600)).padStart(2, '0');
        var m = String(Math.floor((s % 3600) / 60)).padStart(2, '0');
        var sec = String(s % 60).padStart(2, '0');
        timerEl.textContent = h + ':' + m + ':' + sec;
      }

      tick();
      this.banTimer = setInterval(tick, 1000);
    },

    clearBanScreen: function () {
      if (this.banTimer) {
        clearInterval(this.banTimer);
        this.banTimer = null;
      }
      var el = document.getElementById('aw-ban-overlay');
      if (el) el.remove();
    },

    // ============================================================
    // HELPERS
    // ============================================================
    isLoggedIn: function () {
      return !!this.user;
    },

    isBanned: function () {
      if (!this.user) return false;
      if (this.user.banned) return true;
      if (this.user.blocked && this.user.blockedUntil) {
        return new Date(this.user.blockedUntil).getTime() > Date.now();
      }
      return false;
    },

    requireLogin: function (redirect) {
      if (!this.isLoggedIn()) {
        var target = redirect || (location.pathname.split('/').pop() || 'main.html');
        location.href = 'login.html?next=' + encodeURIComponent(target);
        return false;
      }
      if (this.isBanned()) return false;
      return true;
    },

    // ============================================================
    // LOGIN / LOGOUT
    // ============================================================
    login: async function (nickname, password) {
      var res = await API.login({ nickname: nickname, password: password });
      if (res.success) {
        API.setToken(res.data.token);
        this.user = res.data.user;

        // Keshga yozish
        try {
          localStorage.setItem(CACHE_KEY, JSON.stringify({
            ts: Date.now(),
            token: res.data.token,
            user: this.user
          }));
        } catch (_) {}

        // Ban tekshiruvi
        if (this.user.banned) {
          this.showBanScreen(this.user.banReason, null, 'permanent');
        } else if (this.user.blocked && this.user.blockedUntil) {
          var until = new Date(this.user.blockedUntil).getTime();
          if (until > Date.now()) {
            this.showBanScreen(this.user.banReason, this.user.blockedUntil, 'temporary');
          }
        }
      }
      return res;
    },

    logout: async function () {
      try { await API.logout(); } catch (_) {}
      API.clearToken();
      this.clearCache();
      this.user = null;
      this.clearBanScreen();
      location.href = 'main.html';
    }
  };

  window.Auth = Auth;

  // ============================================================
  // BAN OVERLAY CSS (avtomatik inject)
  // ============================================================
  (function injectBanStyles() {
    if (document.getElementById('aw-ban-styles')) return;
    var style = document.createElement('style');
    style.id = 'aw-ban-styles';
    style.textContent = `
      .aw-ban-overlay {
        position: fixed; inset: 0; z-index: 99999;
        background: rgba(0,0,0,0.9);
        backdrop-filter: blur(8px);
        -webkit-backdrop-filter: blur(8px);
        display: flex; align-items: center; justify-content: center; padding: 20px;
      }
      .aw-ban-card {
        max-width: 480px; width: 100%; text-align: center;
        background: var(--bg-elev, #1a1a1e);
        border: 1px solid var(--border, rgba(255,255,255,0.09));
        border-radius: 18px; padding: 32px 24px;
      }
      .aw-ban-card h2 {
        color: var(--danger, #ff4c4c); margin-bottom: 12px; font-size: 24px;
      }
      .aw-ban-timer {
        font-family: ui-monospace, monospace;
        font-size: 36px; font-weight: 800;
        color: var(--warn, #ffbb33); margin: 20px 0;
        letter-spacing: 3px;
      }
      .aw-ban-reason {
        color: var(--muted, #9a9aa5); font-size: 13px; margin-top: 12px;
        background: rgba(255,76,76,0.08); padding: 8px 12px; border-radius: 8px;
        display: inline-block;
      }
      .aw-ban-reason:empty { display: none; }
    `;
    document.head.appendChild(style);
  })();

  console.log('[auth] Loaded');
})();