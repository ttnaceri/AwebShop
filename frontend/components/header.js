// frontend/components/header.js
// Nav bar (desktop) + Tab bar (mobile) + Font Awesome.

(function () {
  'use strict';

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

  // ---- Helpers ----
  function safeEsc(s) {
    if (typeof window.esc === 'function') return window.esc(s);
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function safeT(k) {
    if (window.I18N && typeof window.I18N.t === 'function') return window.I18N.t(k);
    if (typeof window.t === 'function') return window.t(k);
    return k;
  }
  function safeFmtAWC(n) {
    if (typeof window.fmtAWC === 'function') return window.fmtAWC(n);
    return Number(n || 0).toFixed(4).replace(/\.?0+$/, '') + ' AWC';
  }
  function safeSetLang(lang) {
    if (window.I18N && typeof window.I18N.setLang === 'function') return window.I18N.setLang(lang);
    if (typeof window.setLang === 'function') return window.setLang(lang);
    localStorage.setItem('aw_lang', lang);
    location.reload();
  }
  function getAuth() {
    return (typeof window.Auth === 'object' && window.Auth !== null) ? window.Auth : null;
  }
  function getTheme() { return localStorage.getItem('aw_theme') || 'dark'; }
  function setTheme(theme) {
    localStorage.setItem('aw_theme', theme);
    const isDark = theme === 'dark';
    document.documentElement.classList.toggle('dark', isDark);
    document.documentElement.classList.toggle('light', !isDark);
  }
  function themeIconClass(theme) {
    return theme === 'light' ? 'fa-moon' : 'fa-sun';
  }
  function themeTitleText(theme) {
    return theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode';
  }

  function currentPage() {
    const p = location.pathname.split('/').pop() || 'main.html';
    return p.toLowerCase();
  }
  function isActive(href) {
    return currentPage() === href.toLowerCase();
  }

  function doSearch(query) {
    const q = String(query || '').trim();
    if (!q) return;
    location.href = '/search/' + encodeURIComponent(q);
  }

  async function renderHeader() {
    const host = document.getElementById('aw-header');
    if (!host) return;

    ensureFontAwesome();

    const Auth = getAuth();
    if (Auth && typeof Auth.load === 'function') {
      try { await Auth.load(); } catch (e) { console.warn('[header]', e.message); }
    }

    const lang = localStorage.getItem('aw_lang') || 'en';
    const theme = getTheme();
    const user = Auth ? Auth.user : null;
    const themeIcon = themeIconClass(theme);
    const themeTitle = themeTitleText(theme);
    const loggedIn = !!user;

    const navLinks = [
      { href: 'main.html',    label: safeT('home'),    icon: 'fa-house' },
      { href: 'store.html',   label: safeT('store'),   icon: 'fa-store' },
      { href: 'sell.html',    label: safeT('sell'),    icon: 'fa-tag' },
      { href: 'wallet.html',  label: safeT('wallet'),  icon: 'fa-wallet' },
      { href: 'profile.html', label: safeT('profile'), icon: 'fa-user' }
    ];

    host.innerHTML = `
      <!-- ============ DESKTOP NAV BAR ============ -->
      <header class="aw-navbar">
        <div class="aw-navbar-inner">
          <a class="aw-navbar-brand" href="main.html">
            <img src="../assets/image/logo.png" alt="AWebShop" onerror="this.style.display='none'"/>
            <span>AWebShop</span>
          </a>

          <nav class="aw-navbar-links">
            ${navLinks.map(l => `
              <a href="${l.href}" class="${isActive(l.href) ? 'active' : ''}">
                <i class="fa-solid ${l.icon}"></i> ${safeEsc(l.label)}
              </a>
            `).join('')}
          </nav>

          <div class="aw-navbar-search">
            <input type="text" id="aw-global-search"
                   placeholder="Search websites…"
                   autocomplete="off"/>
          </div>

          <div class="aw-navbar-right">
            <button class="aw-icon-btn" id="aw-theme-btn" title="${safeEsc(themeTitle)}" aria-label="Theme">
              <i class="fa-solid ${themeIcon}" id="aw-theme-icon"></i>
            </button>

            <select id="aw-lang" class="aw-lang-select" aria-label="Language">
              <option value="en" ${lang === 'en' ? 'selected' : ''}>EN</option>
              <option value="uz" ${lang === 'uz' ? 'selected' : ''}>UZ</option>
            </select>

            ${loggedIn ? `
              <a class="aw-user-chip" href="profile.html">
                <span class="aw-avatar">${safeEsc((user.nickname || '?')[0].toUpperCase())}</span>
                <span class="aw-user-name">${safeEsc(user.nickname)}</span>
                <span class="aw-balance-mini">${safeEsc(safeFmtAWC(user.balanceAWC))}</span>
              </a>
              <button class="aw-icon-btn" id="aw-logout-btn" title="${safeEsc(safeT('logout'))}" aria-label="Logout">
                <i class="fa-solid fa-right-from-bracket"></i>
              </button>
            ` : `
              <a class="aw-btn aw-btn-ghost" href="login.html">${safeEsc(safeT('login'))}</a>
              <a class="aw-btn" href="register.html">${safeEsc(safeT('register'))}</a>
            `}
          </div>
        </div>
      </header>

      <!-- ============ MOBILE TAB BAR ============ -->
      <nav class="aw-tabbar">
        <a href="main.html" class="${isActive('main.html') ? 'active' : ''}">
          <i class="fa-solid fa-house"></i>
          <span>${safeEsc(safeT('home'))}</span>
        </a>
        <a href="store.html" class="${isActive('store.html') ? 'active' : ''}">
          <i class="fa-solid fa-store"></i>
          <span>${safeEsc(safeT('store'))}</span>
        </a>
        <a href="sell.html" class="aw-tabbar-center ${isActive('sell.html') ? 'active' : ''}">
          <i class="fa-solid fa-plus"></i>
          <span>${safeEsc(safeT('sell'))}</span>
        </a>
        <a href="wallet.html" class="${isActive('wallet.html') ? 'active' : ''}">
          <i class="fa-solid fa-wallet"></i>
          <span>${safeEsc(safeT('wallet'))}</span>
        </a>
        <a href="profile.html" class="${isActive('profile.html') ? 'active' : ''}">
          <i class="fa-solid fa-user"></i>
          <span>${safeEsc(safeT('profile'))}</span>
        </a>
      </nav>
    `;

    // ---- Events ----
    const themeBtn = document.getElementById('aw-theme-btn');
    if (themeBtn) {
      themeBtn.addEventListener('click', () => {
        const next = getTheme() === 'dark' ? 'light' : 'dark';
        setTheme(next);
        const icon = document.getElementById('aw-theme-icon');
        if (icon) icon.className = 'fa-solid ' + themeIconClass(next);
        themeBtn.title = themeTitleText(next);
      });
    }

    const langSel = document.getElementById('aw-lang');
    if (langSel) langSel.addEventListener('change', e => safeSetLang(e.target.value));

    const logoutBtn = document.getElementById('aw-logout-btn');
    if (logoutBtn) logoutBtn.addEventListener('click', () => {
      if (Auth && typeof Auth.logout === 'function') Auth.logout();
    });

    const searchInput = document.getElementById('aw-global-search');
    if (searchInput) {
      searchInput.addEventListener('keydown', e => {
        if (e.key === 'Enter') doSearch(searchInput.value);
      });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', renderHeader);
  } else {
    renderHeader();
  }
})();