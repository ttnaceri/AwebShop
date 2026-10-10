// frontend/js/admin.js
// AWebShop — Admin helper: sidebar, guard, CRUD, table.

(function () {
  'use strict';

  // ============================================================
  // HELPERS
  // ============================================================
  function safeEsc(s) {
    if (typeof window.esc === 'function') return window.esc(s);
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function safeToast(m, t, ms) {
    if (typeof window.toast === 'function') return window.toast(m, t, ms);
    console.log('[toast]', m);
  }
  function safeOpenModal(o) {
    if (typeof window.openModal === 'function') return window.openModal(o);
    console.error('openModal missing');
  }
  function safeCloseModal() {
    if (typeof window.closeModal === 'function') window.closeModal();
  }
  function safeConfirm(t, m) {
    if (typeof window.confirmModal === 'function') return window.confirmModal(t, m);
    return Promise.resolve(window.confirm(t + '\n\n' + m));
  }

  // ============================================================
  // ADMIN
  // ============================================================
  var Admin = {
    role: null,
    adminData: null,
    lastError: null,

    load: async function () {
      console.log('[admin] load() chaqirildi');
      this.lastError = null;

      if (!window.API) { this.lastError = 'API yoq'; return false; }
      if (!window.Auth) { this.lastError = 'Auth yoq'; return false; }

      try { await window.Auth.load(); }
      catch (e) { this.lastError = e.message; }

      if (!window.Auth.isLoggedIn()) {
        this.lastError = 'Not logged in';
        return false;
      }

      console.log('[admin] User:', window.Auth.user.nickname);

      var res = null;
      try { res = await window.API.adminStats(); }
      catch (e) { this.lastError = e.message; }

      if (!res) {
        // Network xatosi — user bor, admin deb hisoblaymiz
        this.role = (window.Auth.user && window.Auth.user.role) || 'moderator';
        this.adminData = { warning: 'Server xato' };
        return true;
      }

      if (res.success) {
        var uRole = (window.Auth.user && window.Auth.user.role) || 'user';
        this.role = uRole === 'user' ? 'moderator' : uRole;
        this.adminData = res.data;
        console.log('[admin] ✅ Admin tasdiqlandi. Role:', this.role);
        return true;
      }

      // 500 — server xatosi, lekin user admin bo'lishi mumkin
      var code = res.code || '';
      if (code === 'SERVER_ERROR' || code === 'INTERNAL_ERROR') {
        console.warn('[admin] ⚠️ Server xatosi, lekin admin deb hisoblaymiz');
        this.role = (window.Auth.user && window.Auth.user.role) || 'moderator';
        this.adminData = { error: res.message };
        return true;
      }

      // 403 — haqiqiy admin emas
      if (code === 'FORBIDDEN') {
        this.lastError = 'Forbidden';
        this.role = null;
        return false;
      }

      // 401 — token yo'q
      if (code === 'UNAUTHORIZED') {
        this.lastError = 'Unauthorized';
        this.role = null;
        return false;
      }

      // Boshqa xato — admin deb hisoblaymiz
      this.role = (window.Auth.user && window.Auth.user.role) || 'moderator';
      this.lastError = res.message || code;
      return true;
    },

    requireAdmin: async function (customRedirect) {
      console.log('[admin] requireAdmin');
      var ok = await this.load();
      if (ok) return true;

      var hasToken = API.getToken();
      var code = this.lastError || '';

      if (!hasToken) {
        console.warn('[admin] Token yoq → login');
        var next = encodeURIComponent('../admin/dashboard.html');
        location.href = customRedirect || ('../pages/login.html?next=' + next);
        return false;
      }

      if (code === 'Forbidden') {
        console.warn('[admin] Admin emas → main');
        location.href = '../pages/main.html';
        return false;
      }

      // Boshqa xato — davom etamiz (yumshoq)
      return true;
    },

    can: function (action) {
      var level = { super_admin: 3, admin: 2, moderator: 1 };
      var need = { read: 1, moderate: 1, write: 2, delete: 2, danger: 3 };
      return (level[this.role] || 0) >= (need[action] || 1);
    }
  };

  // ============================================================
  // MENYU
  // ============================================================
  var ADMIN_MENU = [
    { section: 'Overview', items: [
      { href: 'dashboard.html',    label: 'Dashboard',    icon: '▦' },
      { href: 'analytics.html',    label: 'Analytics',    icon: '📊' },
      { href: 'logs.html',         label: 'Logs',         icon: '📜' }
    ]},
    { section: 'Users & Access', items: [
      { href: 'users.html',        label: 'Users',        icon: '👤' },
      { href: 'admins.html',       label: 'Admins',       icon: '🛡' },
      { href: 'security.html',     label: 'Security',     icon: '🔒' }
    ]},
    { section: 'Marketplace', items: [
      { href: 'websites.html',     label: 'Websites',     icon: '🌐' },
      { href: 'orders.html',       label: 'Orders',       icon: '🛒' },
      { href: 'escrow.html',       label: 'Escrow',       icon: '🔐' },
      { href: 'withdraw.html',     label: 'Withdrawals',  icon: '💸' },
      { href: 'payments.html',     label: 'Payments',     icon: '💳' },
      { href: 'cards.html',        label: 'Cards',        icon: '💠' },
      { href: 'refunds.html',      label: 'Refunds',      icon: '↩' },
      { href: 'featured.html',     label: 'Featured',     icon: '⭐' }
    ]},
    { section: 'Marketing', items: [
      { href: 'promocodes.html',   label: 'Promocodes',   icon: '🎟' },
      { href: 'discounts.html',    label: 'Discounts',    icon: '％' },
      { href: 'events.html',       label: 'Events',       icon: '🎉' },
      { href: 'announcements.html', label: 'Announcements', icon: '📣' },
      { href: 'badges.html',       label: 'Badges',       icon: '🏅' },
      { href: 'reviews.html',      label: 'Reviews',      icon: '⭐' }
    ]},
    { section: 'Content', items: [
      { href: 'themes.html',       label: 'Themes',       icon: '🎨' },
      { href: 'words.html',        label: 'Banned Words', icon: '🚫' },
      { href: 'messages.html',     label: 'Messages',     icon: '✉' },
      { href: 'help.html',         label: 'Help Center',  icon: '❓' }
    ]},
    { section: 'Premium', items: [
      { href: 'premium.html',      label: 'Premium',      icon: '💎' },
      { href: 'prices.html',       label: 'Prices',       icon: '💰' },
      { href: 'force-subscribe.html', label: 'Force Sub', icon: '📌' }
    ]},
    { section: 'System', items: [
      { href: 'settings.html',     label: 'Settings',     icon: '⚙' },
      { href: 'telegram-settings.html', label: 'Telegram', icon: '📨' },
      { href: 'seo-settings.html', label: 'SEO',          icon: '🔍' },
      { href: 'backup.html',       label: 'Backup',       icon: '💾' },
      { href: 'export-import.html', label: 'Export/Import', icon: '⇅' },
      { href: 'maintenance.html',  label: 'Maintenance',  icon: '🛠' },
      { href: 'todo.html',         label: 'Todo',         icon: '✓' }
    ]}
  ];

  function renderAdminSidebar() {
    var host = document.getElementById('admin-sidebar');
    if (!host) return;
    var current = (location.pathname.split('/').pop() || '').toLowerCase();

    var html = '<div class="admin-brand">' +
      '<a href="../pages/main.html">← AWebShop</a>' +
      '<div class="admin-badge">ADMIN</div>' +
      '</div>' +
      '<nav class="admin-nav">';

    ADMIN_MENU.forEach(function (sec) {
      html += '<div class="admin-nav-sec">' +
        '<div class="admin-nav-sec-title">' + safeEsc(sec.section) + '</div>';
      sec.items.forEach(function (it) {
        html += '<a href="' + it.href + '" class="' + (current === it.href ? 'active' : '') + '">' +
          '<span class="admin-nav-ico">' + it.icon + '</span>' +
          '<span>' + safeEsc(it.label) + '</span>' +
          '</a>';
      });
      html += '</div>';
    });

    html += '</nav>';
    host.innerHTML = html;
  }

  function renderAdminTopbar(title) {
    var host = document.getElementById('admin-topbar');
    if (!host) return;
    var u = (window.Auth && window.Auth.user) || {};

    host.innerHTML =
      '<div class="admin-top-left">' +
      '<button class="admin-burger" id="admin-burger">☰</button>' +
      '<h1>' + safeEsc(title || 'Admin') + '</h1>' +
      '</div>' +
      '<div class="admin-top-right">' +
      '<span class="admin-role-pill">' + safeEsc((u.role || 'moderator').toUpperCase()) + '</span>' +
      '<span class="admin-nick">' + safeEsc(u.nickname || '') + '</span>' +
      '<button class="admin-btn-ghost" id="admin-logout">Logout</button>' +
      '</div>';

    var lo = document.getElementById('admin-logout');
    if (lo) lo.addEventListener('click', function () { window.Auth.logout(); });

    var b = document.getElementById('admin-burger');
    if (b) b.addEventListener('click', function () {
      document.body.classList.toggle('admin-sidebar-open');
    });
  }

  function adminPage(title, subtitle) {
    document.body.classList.add('admin-body');
    renderAdminSidebar();
    renderAdminTopbar(title);
    var sub = document.getElementById('admin-subtitle');
    if (sub) sub.textContent = subtitle || '';
  }

  function renderTable(host, columns, rows, opts) {
    if (!host) return;
    var o = opts || {};
    if (!rows || !rows.length) {
      host.innerHTML = '<div class="admin-empty">' + safeEsc(o.emptyText || 'No data.') + '</div>';
      return;
    }
    var html = '<div class="admin-table-wrap"><table class="admin-table"><thead><tr>';
    columns.forEach(function (c) { html += '<th>' + safeEsc(c.label) + '</th>'; });
    html += '</tr></thead><tbody>';
    rows.forEach(function (row, i) {
      html += '<tr>';
      columns.forEach(function (c) {
        if (c.render) html += '<td>' + c.render(row) + '</td>';
        else html += '<td>' + safeEsc(row[c.key] != null ? row[c.key] : '') + '</td>';
      });
      html += '</tr>';
    });
    html += '</tbody></table></div>';
    host.innerHTML = html;
  }

  function fmtMoney(n) { return new Intl.NumberFormat('uz-UZ').format(Math.round(n || 0)) + " so'm"; }
  function fmtDateShort(iso) {
    if (!iso) return '—';
    try { return new Date(iso).toLocaleString(); } catch (_) { return '—'; }
  }
  function statusPill(s) {
    var map = {
      active: 'ok', completed: 'ok', approved: 'ok', sold: 'ok',
      pending: 'warn', pending_payment: 'warn', pending_manual_verification: 'warn', refunded: 'warn',
      rejected: 'bad', cancelled: 'bad', disputed: 'bad', blocked: 'bad', banned: 'bad'
    };
    return '<span class="admin-pill admin-pill-' + (map[s] || 'neutral') + '">' + safeEsc(s || '—') + '</span>';
  }

  // API helperlar
  function installAdminAPI() {
    if (!window.API) return;
    if (typeof window.API.adminGet === 'function') return;

    window.API.adminFetch = function (path, opts) {
      var o = opts || {};
      return this.request('/api/admin/' + path, { method: o.method || 'GET', body: o.body || null });
    };
    window.API.adminGet = function (path, params) {
      var q = new URLSearchParams(params || {}).toString();
      return this.request('/api/admin/' + path + (q ? '?' + q : ''));
    };
    window.API.adminPost   = function (path, body) { return this.adminFetch(path, { method: 'POST',   body: body }); };
    window.API.adminPut    = function (path, body) { return this.adminFetch(path, { method: 'PUT',    body: body }); };
    window.API.adminDelete = function (path, body) { return this.adminFetch(path, { method: 'DELETE', body: body }); };
  }

  installAdminAPI();

  // Global
  window.Admin = Admin;
  window.renderAdminSidebar = renderAdminSidebar;
  window.renderAdminTopbar = renderAdminTopbar;
  window.adminPage = adminPage;
  window.renderTable = renderTable;
  window.fmtMoney = fmtMoney;
  window.fmtDateShort = fmtDateShort;
  window.statusPill = statusPill;

  console.log('[admin] Loaded');
})();