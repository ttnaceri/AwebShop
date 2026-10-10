// frontend/js/app.js
// AWebShop — global utilitlar: toast, currency, theme, i18n.

(function () {
  'use strict';

  // ============================================================
  // THEME
  // ============================================================
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

  // ============================================================
  // RATES
  // ============================================================
  window.RATES = { awcPriceUZS: 10000, usdRate: 12650 };

  async function loadRates() {
    try {
      if (window.API && typeof window.API.tokenRate === 'function') {
        const res = await window.API.tokenRate();
        if (res && res.success && res.data) {
          window.RATES.awcPriceUZS = res.data.awcPriceUZS || 10000;
          window.RATES.usdRate = res.data.usdRate || 12650;
        }
      }
    } catch (e) {
      console.warn('[app] loadRates:', e.message);
    }
  }

  // ============================================================
  // FORMATTERS
  // ============================================================
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
    try { return new Date(iso).toLocaleString(); } catch (_) { return '—'; }
  }

  // ============================================================
  // ESCAPE
  // ============================================================
  function esc(str) {
    return String(str == null ? '' : str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  // ============================================================
  // TOAST
  // ============================================================
  function ensureToastContainer() {
    let c = document.getElementById('aw-toasts');
    if (!c) {
      c = document.createElement('div');
      c.id = 'aw-toasts';
      document.body.appendChild(c);
    }
    return c;
  }

  function toast(message, type, ms) {
    try {
      const c = ensureToastContainer();
      const el = document.createElement('div');
      el.className = 'aw-toast aw-toast-' + (type || 'info');
      el.textContent = message;
      c.appendChild(el);
      requestAnimationFrame(() => el.classList.add('show'));
      setTimeout(() => {
        el.classList.remove('show');
        setTimeout(() => el.remove(), 250);
      }, ms || 3000);
    } catch (_) {
      console.log('[toast]', message);
    }
  }

  // ============================================================
  // LOADING
  // ============================================================
  function showLoading(container, text) {
    if (container) {
      container.innerHTML = '<div class="aw-loading">' + (text || 'Loading…') + '</div>';
    }
  }

  // ============================================================
  // GLOBAL EXPORTS
  // ============================================================
  window.applyTheme = applyTheme;
  window.toggleTheme = toggleTheme;
  window.loadRates = loadRates;
  window.fmtUZS = fmtUZS;
  window.fmtUSD = fmtUSD;
  window.fmtAWC = fmtAWC;
  window.fmtDate = fmtDate;
  window.esc = esc;
  window.toast = toast;
  window.showLoading = showLoading;

  console.log('[app] Loaded');
})();