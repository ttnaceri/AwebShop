// frontend/js/auth.js
// AWebShop — Auth: session, ban check, ban overlay with timer.

const Auth = {
  user: null,
  banTimer: null,

  // ============================================================
  // LOAD SESSION
  // ============================================================
  async load() {
    const t = API.getToken();
    if (!t) { this.user = null; return null; }

    const res = await API.me();

    if (res.success) {
      this.user = res.data.user;
      // Local ban check
      if (this.user.banned) {
        this.showBanScreen(this.user.banReason, null, 'permanent');
      } else if (this.user.blocked && this.user.blockedUntil) {
        const until = new Date(this.user.blockedUntil).getTime();
        if (until > Date.now()) {
          this.showBanScreen(this.user.banReason, this.user.blockedUntil, 'temporary');
        } else {
          // Block expired
          this.clearBanScreen();
        }
      }
      return this.user;
    }

    // API returned ban error
    if (res.code === 'ACCOUNT_BANNED') {
      API.clearToken();
      this.user = null;
      this.showBanScreen(res.data && res.data.reason, null, 'permanent');
      return null;
    }
    if (res.code === 'ACCOUNT_TEMP_BLOCKED') {
      API.clearToken();
      this.user = null;
      this.showBanScreen(res.data && res.data.reason, res.data && res.data.blockedUntil, 'temporary');
      return null;
    }

    this.user = null;
    API.clearToken();
    return null;
  },

  // ============================================================
  // BAN SCREEN (Overlay with timer)
  // ============================================================
  showBanScreen(reason, until, type) {
    // Existing overlay?
    if (document.getElementById('aw-ban-overlay')) return;

    const overlay = document.createElement('div');
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

    const reasonEl = document.getElementById('aw-ban-reason');
    reasonEl.textContent = reason ? `Reason: ${reason}` : '';

    // Permanent — no timer
    if (type === 'permanent' || !until) {
      document.getElementById('aw-ban-timer').textContent = '∞';
      return;
    }

    // Temporary — start timer
    const target = new Date(until).getTime();
    const timerEl = document.getElementById('aw-ban-timer');

    const tick = () => {
      const diff = target - Date.now();
      if (diff <= 0) {
        if (this.banTimer) clearInterval(this.banTimer);
        this.clearBanScreen();
        location.reload();
        return;
      }
      const totalSec = Math.floor(diff / 1000);
      const days = Math.floor(totalSec / 86400);
      const hours = Math.floor((totalSec % 86400) / 3600);
      const mins = Math.floor((totalSec % 3600) / 60);
      const secs = totalSec % 60;

      let text = '';
      if (days > 0) text += `${days}d `;
      text += `${String(hours).padStart(2,'0')}:${String(mins).padStart(2,'0')}:${String(secs).padStart(2,'0')}`;
      timerEl.textContent = text;
    };

    tick();
    this.banTimer = setInterval(tick, 1000);
  },

  clearBanScreen() {
    if (this.banTimer) { clearInterval(this.banTimer); this.banTimer = null; }
    const overlay = document.getElementById('aw-ban-overlay');
    if (overlay) overlay.remove();
  },

  // ============================================================
  // HELPERS
  // ============================================================
  isLoggedIn() {
    return !!this.user;
  },

  isBanned() {
    if (!this.user) return false;
    if (this.user.banned) return true;
    if (this.user.blocked && this.user.blockedUntil) {
      return new Date(this.user.blockedUntil).getTime() > Date.now();
    }
    return false;
  },

  requireLogin(redirect = null) {
    if (!this.isLoggedIn()) {
      const target = redirect || (location.pathname.split('/').pop() || 'main.html');
      location.href = 'login.html?next=' + encodeURIComponent(target);
      return false;
    }
    if (this.isBanned()) return false;
    return true;
  },

  // ============================================================
  // LOGIN / LOGOUT
  // ============================================================
  async login(nickname, password) {
    const res = await API.login({ nickname, password });
    if (res.success) {
      API.setToken(res.data.token);
      this.user = res.data.user;
      // Immediate ban check
      if (this.user.banned) {
        this.showBanScreen(this.user.banReason, null, 'permanent');
      } else if (this.user.blocked && this.user.blockedUntil) {
        const until = new Date(this.user.blockedUntil).getTime();
        if (until > Date.now()) {
          this.showBanScreen(this.user.banReason, this.user.blockedUntil, 'temporary');
        }
      }
    }
    return res;
  },

  async logout() {
    try { await API.logout(); } catch (_) {}
    API.clearToken();
    this.user = null;
    this.clearBanScreen();
    location.href = 'main.html';
  }
};

// ============================================================
// BAN OVERLAY CSS (avtomatik inject)
// ============================================================
(function injectBanStyles() {
  if (document.getElementById('aw-ban-styles')) return;
  const style = document.createElement('style');
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
      font-family: ui-monospace, 'JetBrains Mono', monospace;
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

window.Auth = Auth;