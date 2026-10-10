// frontend/components/header.js
// NAV BAR + TAB BAR — to'liq qayta yozilgan.

'use strict';

console.log('[header] Fayl yuklandi');

(function () {
  'use strict';

  console.log('[header] IIFE ishga tushdi');

  // ============================================================
  // FONT AWESOME
  // ============================================================
  const FA_ID = 'awebshop-fontawesome';
  function ensureFontAwesome() {
    if (document.getElementById(FA_ID)) return;
    console.log('[header] Font Awesome CDN qo\'shilmoqda…');
    const link = document.createElement('link');
    link.id = FA_ID;
    link.rel = 'stylesheet';
    link.href = 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.2/css/all.min.css';
    link.crossOrigin = 'anonymous';
    document.head.appendChild(link);
  }

  // ============================================================
  // SAFE HELPERS
  // ============================================================
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

  function getTheme() { return localStorage.getItem('aw_theme') || 'dark'; }
  function setTheme(theme) {
    localStorage.setItem('aw_theme', theme);
    const isDark = theme === 'dark';
    document.documentElement.classList.toggle('dark', isDark);
    document.documentElement.classList.toggle('light', !isDark);
  }
  function themeIconClass(t) { return t === 'light' ? 'fa-moon' : 'fa-sun'; }

  function currentPage() {
    const p = location.pathname.split('/').pop() || 'main.html';
    return p.toLowerCase();
  }
  function isActive(href) { return currentPage() === href.toLowerCase(); }

  function doSearch(query) {
    const q = String(query || '').trim();
    if (!q) return;
    location.href = '/search/' + encodeURIComponent(q);
  }

  // ============================================================
  // RENDER
  // ============================================================
  async function renderHeader() {
    console.log('[header] Rendering…');

    const host = document.getElementById('aw-header');
    if (!host) {
      console.error('[header] ❌ #aw-header topilmadi!');
      return;
    }

    console.log('[header] ✅ #aw-header topildi');

    ensureFontAwesome();

    // Auth (xavfsiz)
    let user = null;
    try {
      if (window.Auth && typeof window.Auth.load === 'function') {
        await window.Auth.load();
        user = window.Auth.user || null;
        console.log('[header] Auth user:', user ? user.nickname : 'anonymous');
      }
    } catch (e) {
      console.warn('[header] Auth.load xato:', e.message);
    }

    const lang = localStorage.getItem('aw_lang') || 'en';
    const theme = getTheme();
    const themeIcon = themeIconClass(theme);
    const loggedIn = !!user;

    const navLinks = [
      { href: 'main.html',    label: safeT('home'),    icon: 'fa-house' },
      { href: 'store.html',   label: safeT('store'),   icon: 'fa-store' },
      { href: 'sell.html',    label: safeT('sell'),    icon: 'fa-tag' },
      { href: 'wallet.html',  label: safeT('wallet'),  icon: 'fa-wallet' },
      { href: 'profile.html', label: safeT('profile'), icon: 'fa-user' }
    ];

    console.log('[header] HTML yozilmoqda…');

    host.innerHTML = `
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
            <input type="text" id="aw-global-search" placeholder="Search websites…" autocomplete="off"/>
          </div>

          <div class="aw-navbar-right">
            <button class="aw-icon-btn" id="aw-theme-btn" aria-label="Theme">
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
              <button class="aw-icon-btn" id="aw-logout-btn" aria-label="Logout">
                <i class="fa-solid fa-right-from-bracket"></i>
              </button>
            ` : `
              <a class="aw-btn aw-btn-ghost" href="login.html">${safeEsc(safeT('login'))}</a>
              <a class="aw-btn aw-btn-primary" href="register.html">${safeEsc(safeT('register'))}</a>
            `}
          </div>
        </div>
      </header>

      <nav class="aw-tabbar" id="aw-tabbar">
        <a href="main.html" class="${isActive('main.html') ? 'active' : ''}">
          <i class="fa-solid fa-house"></i><span>${safeEsc(safeT('home'))}</span>
        </a>
        <a href="store.html" class="${isActive('store.html') ? 'active' : ''}">
          <i class="fa-solid fa-store"></i><span>${safeEsc(safeT('store'))}</span>
        </a>
        <a href="sell.html" class="aw-tabbar-center ${isActive('sell.html') ? 'active' : ''}">
          <i class="fa-solid fa-plus"></i><span>${safeEsc(safeT('sell'))}</span>
        </a>
        <a href="wallet.html" class="${isActive('wallet.html') ? 'active' : ''}">
          <i class="fa-solid fa-wallet"></i><span>${safeEsc(safeT('wallet'))}</span>
        </a>
        <a href="profile.html" class="${isActive('profile.html') ? 'active' : ''}">
          <i class="fa-solid fa-user"></i><span>${safeEsc(safeT('profile'))}</span>
        </a>
      </nav>
    `;

    console.log('[header] ✅ Rendered successfully');

    // ---- Events ----
    const themeBtn = document.getElementById('aw-theme-btn');
    if (themeBtn) themeBtn.addEventListener('click', () => {
      const next = getTheme() === 'dark' ? 'light' : 'dark';
      setTheme(next);
      const icon = document.getElementById('aw-theme-icon');
      if (icon) icon.className = 'fa-solid ' + themeIconClass(next);
    });

    const langSel = document.getElementById('aw-lang');
    if (langSel) langSel.addEventListener('change', e => safeSetLang(e.target.value));

    const logoutBtn = document.getElementById('aw-logout-btn');
    if (logoutBtn) logoutBtn.addEventListener('click', () => {
      if (window.Auth && typeof window.Auth.logout === 'function') window.Auth.logout();
    });

    const searchInput = document.getElementById('aw-global-search');
    if (searchInput) searchInput.addEventListener('keydown', e => {
      if (e.key === 'Enter') doSearch(searchInput.value);
    });
  }

  // ============================================================
  // START — DARHOL ISHGA TUSHISH
  // ============================================================
  if (document.readyState === 'loading') {
    console.log('[header] DOM yuklanmoqda, DOMContentLoaded kutilmoqda…');
    document.addEventListener('DOMContentLoaded', renderHeader);
  } else {
    console.log('[header] DOM tayyor, renderHeader ishga tushadi');
    renderHeader();
  }

  window.renderHeader = renderHeader;
})();