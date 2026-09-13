// frontend/components/header.js
// Header har bir sahifaga avtomatik joylanadi.
// Foydalanish:
//   <div id="aw-header"></div>
//   <script src="../components/header.js"></script>
//
// Yuklash tartibi:
//   js/api.js → js/app.js → js/auth.js → components/header.js
//
// Font Awesome 6 ikonkalari cdnjs dan avtomatik ulanadi.

(function () {
  'use strict';

  // ============================================================
  // Font Awesome CDN ni bir marta yuklash
  // ============================================================
  const FA_CDN_ID = 'awebshop-fontawesome';
  function ensureFontAwesome() {
    if (document.getElementById(FA_CDN_ID)) return;
    const link = document.createElement('link');
    link.id = FA_CDN_ID;
    link.rel = 'stylesheet';
    link.href = 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.2/css/all.min.css';
    link.crossOrigin = 'anonymous';
    link.referrerPolicy = 'no-referrer';
    document.head.appendChild(link);
  }

  // ============================================================
  // Lazy wrappers
  // ============================================================
  function safeEsc(s) {
    if (typeof window.esc === 'function') return window.esc(s);
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function safeT(key) {
    if (typeof window.t === 'function') return window.t(key);
    return key;
  }

  function safeFmtAWC(n) {
    if (typeof window.fmtAWC === 'function') return window.fmtAWC(n);
    return Number(n || 0).toFixed(4).replace(/\.?0+$/, '') + ' AWC';
  }

  function safeSetLang(lang) {
    if (typeof window.setLang === 'function') return window.setLang(lang);
    localStorage.setItem('aw_lang', lang);
    location.reload();
  }

  function getAuth() {
    return (typeof window.Auth === 'object' && window.Auth !== null) ? window.Auth : null;
  }

  // ============================================================
  // Theme: holatni o'qish va qo'llash
  // ============================================================
  function getTheme() {
    return localStorage.getItem('aw_theme') || 'dark';
  }

  function setTheme(theme) {
    localStorage.setItem('aw_theme', theme);
    // body/html ga klass qo'llash (app.js bilan bir xil mantiq)
    const isDark = theme === 'dark';
    document.documentElement.classList.toggle('dark', isDark);
    document.documentElement.classList.toggle('light', !isDark);
  }

  /**
   * Theme'ga mos ikonka klassini qaytaradi.
   * Dark mode'da  → quyosh (light'ga o'tkazish uchun)
   * Light mode'da → oy (dark'ga o'tkazish uchun)
   */
  function themeIconClass(theme) {
    return theme === 'light' ? 'fa-moon' : 'fa-sun';
  }

  /**
   * Theme'ga mos tooltip matnini qaytaradi.
   */
  function themeTitleText(theme) {
    return theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode';
  }

  // ============================================================
  // Header render
  // ============================================================
  async function renderHeader() {
    const host = document.getElementById('aw-header');
    if (!host) return;

    ensureFontAwesome();

    const Auth = getAuth();
    if (Auth && typeof Auth.load === 'function') {
      try {
        await Auth.load();
      } catch (e) {
        console.warn('[header] Auth.load failed:', e && e.message);
      }
    }

    const lang = localStorage.getItem('aw_lang') || 'en';
    const theme = getTheme();
    const user = Auth ? Auth.user : null;

    // Dark mode'da → quyosh, Light mode'da → oy
    const themeIcon = themeIconClass(theme);
    const themeTitle = themeTitleText(theme);

    host.innerHTML = `
      <header class="aw-header">
        <div class="aw-header-inner">
          <a class="aw-brand" href="main.html">
            <img src="../assets/image/logo.png" alt="AWebShop" onerror="this.style.display='none'"/>
            <span>AWebShop</span>
          </a>

          <nav class="aw-nav">
            <a href="main.html">${safeEsc(safeT('home'))}</a>
            <a href="store.html">${safeEsc(safeT('store'))}</a>
            <a href="sell.html">${safeEsc(safeT('sell'))}</a>
            <a href="wallet.html">${safeEsc(safeT('wallet'))}</a>
            <a href="about.html">${safeEsc(safeT('about'))}</a>
          </nav>

          <div class="aw-header-actions">
            <button class="aw-icon-btn" id="aw-theme-btn" title="${safeEsc(themeTitle)}" aria-label="Toggle theme">
              <i class="fa-solid ${themeIcon}" id="aw-theme-icon" aria-hidden="true"></i>
            </button>

            <select id="aw-lang" class="aw-lang-select" aria-label="Language">
              <option value="en" ${lang === 'en' ? 'selected' : ''}>EN</option>
              <option value="uz" ${lang === 'uz' ? 'selected' : ''}>UZ</option>
            </select>

            ${user ? `
              <a class="aw-user-chip" href="profile.html">
                <span class="aw-avatar">${safeEsc((user.nickname || '?')[0].toUpperCase())}</span>
                <span class="aw-user-name">${safeEsc(user.nickname)}</span>
                <span class="aw-balance-mini">${safeEsc(safeFmtAWC(user.balanceAWC))}</span>
              </a>
              <button class="aw-icon-btn" id="aw-logout-btn" title="${safeEsc(safeT('logout'))}" aria-label="Logout">
                <i class="fa-solid fa-right-from-bracket" aria-hidden="true"></i>
              </button>
            ` : `
              <a class="aw-btn aw-btn-ghost" href="login.html">${safeEsc(safeT('login'))}</a>
              <a class="aw-btn" href="register.html">${safeEsc(safeT('register'))}</a>
            `}

            <button class="aw-burger" id="aw-burger-btn" aria-label="Menu">
              <i class="fa-solid fa-bars" aria-hidden="true"></i>
            </button>
          </div>
        </div>

        <div class="aw-mobile-nav" id="aw-mobile-nav">
          <a href="main.html"><i class="fa-solid fa-house" aria-hidden="true"></i> ${safeEsc(safeT('home'))}</a>
          <a href="store.html"><i class="fa-solid fa-store" aria-hidden="true"></i> ${safeEsc(safeT('store'))}</a>
          <a href="sell.html"><i class="fa-solid fa-tag" aria-hidden="true"></i> ${safeEsc(safeT('sell'))}</a>
          <a href="wallet.html"><i class="fa-solid fa-wallet" aria-hidden="true"></i> ${safeEsc(safeT('wallet'))}</a>
          <a href="profile.html"><i class="fa-solid fa-user" aria-hidden="true"></i> ${safeEsc(safeT('profile'))}</a>
          <a href="about.html"><i class="fa-solid fa-circle-info" aria-hidden="true"></i> ${safeEsc(safeT('about'))}</a>
        </div>
      </header>
    `;

    // ---- Theme toggle (ikonkani DARHOL almashtiradi) ----
    const themeBtn = document.getElementById('aw-theme-btn');
    if (themeBtn) {
      themeBtn.addEventListener('click', () => {
        const current = getTheme();
        const next = current === 'dark' ? 'light' : 'dark';
        setTheme(next);

        // Ikonkani yangilash
        const iconEl = document.getElementById('aw-theme-icon');
        if (iconEl) {
          iconEl.className = 'fa-solid ' + themeIconClass(next);
        }
        // Tooltip ni yangilash
        themeBtn.title = themeTitleText(next);
      });
    }

    // ---- Language ----
    const langSel = document.getElementById('aw-lang');
    if (langSel) langSel.addEventListener('change', e => safeSetLang(e.target.value));

    // ---- Burger ----
    const burger = document.getElementById('aw-burger-btn');
    if (burger) {
      burger.addEventListener('click', () => {
        const nav = document.getElementById('aw-mobile-nav');
        if (nav) nav.classList.toggle('open');
      });
    }

    // ---- Logout ----
    const logoutBtn = document.getElementById('aw-logout-btn');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', () => {
        if (Auth && typeof Auth.logout === 'function') Auth.logout();
      });
    }
  }

  // ============================================================
  // Ishga tushirish
  // ============================================================
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', renderHeader);
  } else {
    renderHeader();
  }
})();