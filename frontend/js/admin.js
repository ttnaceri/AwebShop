// frontend/js/admin.js
// Admin panel uchun markaziy helper.
// MUHIM: bu fayl quyidagilardan KEYIN yuklanishi kerak:
//   js/api.js, js/app.js, js/auth.js
// Va modals.js dan OLDIN yoki KEYIN bo'lishi mumkin — lazy wrapper ishlatiladi.

(function () {
  'use strict';

  // ============================================================
  // Xavfsiz lazy wrappers — bu funksiyalar boshqa fayllarda bo'lishi mumkin
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

  function safeToast(msg, type, ms) {
    if (typeof window.toast === 'function') {
      return window.toast(msg, type || 'info', ms || 3000);
    }
    console.log('[toast:' + (type || 'info') + ']', msg);
  }

  function safeOpenModal(opts) {
    if (typeof window.openModal !== 'function') {
      console.error('openModal is not available. Make sure modals.js is loaded.');
      return;
    }
    window.openModal(opts);
  }

  function safeCloseModal() {
    if (typeof window.closeModal === 'function') window.closeModal();
  }

  function safeConfirmModal(title, message) {
    if (typeof window.confirmModal !== 'function') {
      // Fallback: native confirm
      return Promise.resolve(window.confirm(title + '\n\n' + message));
    }
    return window.confirmModal(title, message);
  }

  function getAPI() {
    if (typeof window.API !== 'object' || window.API === null) {
      console.error('API is not available. Make sure api.js is loaded before admin.js.');
      // Bo'sh fallback — xatolarni oldini olish uchun
      return {
        request: async () => ({ success: false, message: 'API not loaded', code: 'NO_API' }),
        getToken: () => null,
        adminGet: async () => ({ success: false, message: 'API not loaded' }),
        adminPost: async () => ({ success: false, message: 'API not loaded' }),
        adminPut: async () => ({ success: false, message: 'API not loaded' }),
        adminDelete: async () => ({ success: false, message: 'API not loaded' })
      };
    }
    return window.API;
  }

  // ============================================================
  // Admin object
  // ============================================================
  const Admin = {
    role: null,
    adminData: null,

    async load() {
      const API = getAPI();

      if (typeof window.Auth === 'undefined' || !window.Auth) {
        console.error('Auth is not available. Load auth.js before admin.js.');
        return false;
      }

      try {
        await window.Auth.load();
      } catch (e) {
        console.error('Auth.load failed:', e.message);
        return false;
      }

      if (!window.Auth.isLoggedIn()) return false;

      const res = await API.adminStats();
      if (!res || !res.success) {
        this.role = null;
        return false;
      }

      const userRole = (window.Auth.user && window.Auth.user.role) || 'user';
      this.role = userRole === 'user' ? 'moderator' : userRole;
      this.adminData = res.data;
      return true;
    },

    async requireAdmin(redirect = '../pages/login.html') {
      const ok = await this.load();
      if (!ok) {
        location.href = redirect;
        return false;
      }
      return true;
    },

    can(action) {
      const level = { super_admin: 3, admin: 2, moderator: 1 };
      const need = {
        read: 1,
        moderate: 1,
        write: 2,
        delete: 2,
        danger: 3
      };
      const me = level[this.role] || 0;
      return me >= (need[action] || 1);
    }
  };

  // ============================================================
  // Sidebar menu definition
  // ============================================================
  const ADMIN_MENU = [
    { section: 'Overview', items: [
      { href: 'dashboard.html', label: 'Dashboard', icon: '▦' },
      { href: 'analytics.html', label: 'Analytics', icon: '📊' },
      { href: 'logs.html', label: 'Logs', icon: '📜' },
      { href: 'console.html', label: 'Admin Console', icon: '⌨' }
    ]},
    { section: 'Users & Access', items: [
      { href: 'users.html', label: 'Users', icon: '👤' },
      { href: 'admins.html', label: 'Admins', icon: '🛡' },
      { href: 'environment.html', label: 'Environment', icon: '🏛' },
      { href: 'security.html', label: 'Security', icon: '🔒' }
    ]},
    { section: 'Marketplace', items: [
      { href: 'websites.html', label: 'Websites', icon: '🌐' },
      { href: 'orders.html', label: 'Orders', icon: '🛒' },
      { href: 'escrow.html', label: 'Escrow', icon: '🔐' },
      { href: 'withdraw.html', label: 'Withdrawals', icon: '💸' },
      { href: 'payments.html', label: 'Payments', icon: '💳' },
      { href: 'cards.html', label: 'Cards', icon: '💠' },
      { href: 'refunds.html', label: 'Refunds', icon: '↩' },
      { href: 'domains.html', label: 'Domains', icon: '🔗' },
      { href: 'stock.html', label: 'Stock', icon: '📦' },
      { href: 'featured.html', label: 'Featured', icon: '⭐' }
    ]},
    { section: 'Marketing', items: [
      { href: 'promocodes.html', label: 'Promocodes', icon: '🎟' },
      { href: 'discounts.html', label: 'Discounts', icon: '％' },
      { href: 'events.html', label: 'Events', icon: '🎉' },
      { href: 'announcements.html', label: 'Announcements', icon: '📣' },
      { href: 'popup.html', label: 'Popups', icon: '🪟' },
      { href: 'ads.html', label: 'Ads', icon: '📢' },
      { href: 'badges.html', label: 'Badges', icon: '🏅' },
      { href: 'reviews.html', label: 'Reviews', icon: '⭐' }
    ]},
    { section: 'Content', items: [
      { href: 'themes.html', label: 'Themes', icon: '🎨' },
      { href: 'words.html', label: 'Banned Words', icon: '🚫' },
      { href: 'messages.html', label: 'Messages', icon: '✉' },
      { href: 'chat.html', label: 'Chat', icon: '💬' },
      { href: 'attachments.html', label: 'Attachments', icon: '📎' },
      { href: 'invoice.html', label: 'Invoice', icon: '🧾' }
    ]},
    { section: 'Premium', items: [
      { href: 'premium.html', label: 'Premium', icon: '💎' },
      { href: 'prices.html', label: 'Prices', icon: '💰' },
      { href: 'force-subscribe.html', label: 'Force Subscribe', icon: '📌' }
    ]},
    { section: 'System', items: [
      { href: 'settings.html', label: 'Settings', icon: '⚙' },
      { href: 'telegram-settings.html', label: 'Telegram', icon: '📨' },
      { href: 'seo-settings.html', label: 'SEO', icon: '🔍' },
      { href: 'notifications.html', label: 'Notifications', icon: '🔔' },
      { href: 'backup.html', label: 'Backup', icon: '💾' },
      { href: 'export-import.html', label: 'Export/Import', icon: '⇅' },
      { href: 'maintenance.html', label: 'Maintenance', icon: '🛠' },
      { href: 'schedule.html', label: 'Schedule', icon: '🗓' },
      { href: 'todo.html', label: 'Todo', icon: '✓' },
      { href: 'help.html', label: 'Help', icon: '❓' }
    ]}
  ];

  // ============================================================
  // Sidebar + topbar
  // ============================================================
  function renderAdminSidebar() {
    const host = document.getElementById('admin-sidebar');
    if (!host) return;
    const current = (location.pathname.split('/').pop() || '').toLowerCase();

    host.innerHTML = `
      <div class="admin-brand">
        <a href="../pages/main.html">← AWebShop</a>
        <div class="admin-badge">ADMIN</div>
      </div>
      <nav class="admin-nav">
        ${ADMIN_MENU.map(sec => `
          <div class="admin-nav-sec">
            <div class="admin-nav-sec-title">${safeEsc(sec.section)}</div>
            ${sec.items.map(it => `
              <a href="${it.href}" class="${current === it.href ? 'active' : ''}">
                <span class="admin-nav-ico">${it.icon}</span>
                <span>${safeEsc(it.label)}</span>
              </a>
            `).join('')}
          </div>
        `).join('')}
      </nav>
    `;
  }

  function renderAdminTopbar(title) {
    const host = document.getElementById('admin-topbar');
    if (!host) return;
    const u = (window.Auth && window.Auth.user) || {};
    host.innerHTML = `
      <div class="admin-top-left">
        <button class="admin-burger" id="admin-burger">☰</button>
        <h1>${safeEsc(title || 'Admin')}</h1>
      </div>
      <div class="admin-top-right">
        <span class="admin-role-pill">${safeEsc((u.role || 'moderator').toUpperCase())}</span>
        <span class="admin-nick">${safeEsc(u.nickname || '')}</span>
        <button class="admin-btn-ghost" id="admin-open-console" title="Open Console (\`)">⌨ Console</button>
        <button class="admin-btn-ghost" id="admin-logout">Logout</button>
      </div>
    `;

    const logoutBtn = document.getElementById('admin-logout');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', () => {
        if (window.Auth) window.Auth.logout();
      });
    }

    const consoleBtn = document.getElementById('admin-open-console');
    if (consoleBtn) {
      consoleBtn.addEventListener('click', () => {
        if (window.AdminConsole && typeof window.AdminConsole.toggle === 'function') {
          window.AdminConsole.toggle();
        }
      });
    }

    const burger = document.getElementById('admin-burger');
    if (burger) {
      burger.addEventListener('click', () => {
        document.body.classList.toggle('admin-sidebar-open');
      });
    }
  }

  function adminPage(title, subtitle = '') {
    document.body.classList.add('admin-body');
    renderAdminSidebar();
    renderAdminTopbar(title);
    const sub = document.getElementById('admin-subtitle');
    if (sub) sub.textContent = subtitle;
  }

  // ============================================================
  // Table renderer
  // ============================================================
  function renderTable(host, columns, rows, opts = {}) {
    if (!host) return;
    if (!rows || !rows.length) {
      host.innerHTML = `<div class="admin-empty">${safeEsc(opts.emptyText || 'No data.')}</div>`;
      return;
    }
    host.innerHTML = `
      <div class="admin-table-wrap">
        <table class="admin-table">
          <thead>
            <tr>${columns.map(c => `<th>${safeEsc(c.label)}</th>`).join('')}</tr>
          </thead>
          <tbody>
            ${rows.map((row, i) => `
              <tr data-row-index="${i}">
                ${columns.map(c => {
                  if (c.render) return `<td>${c.render(row)}</td>`;
                  return `<td>${safeEsc(row[c.key] != null ? row[c.key] : '')}</td>`;
                }).join('')}
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  }

  // ============================================================
  // Formatters
  // ============================================================
  function fmtMoney(n) {
    return new Intl.NumberFormat('uz-UZ').format(Math.round(n || 0)) + " so'm";
  }

  function fmtDateShort(iso) {
    if (!iso) return '—';
    try {
      return new Date(iso).toLocaleString();
    } catch (_) {
      return '—';
    }
  }

  function statusPill(s) {
    const map = {
      active: 'ok',
      completed: 'ok',
      approved: 'ok',
      sold: 'ok',
      pending: 'warn',
      pending_payment: 'warn',
      pending_manual_verification: 'warn',
      refunded: 'warn',
      rejected: 'bad',
      cancelled: 'bad',
      disputed: 'bad',
      blocked: 'bad'
    };
    const cls = map[s] || 'neutral';
    return `<span class="admin-pill admin-pill-${cls}">${safeEsc(s || '—')}</span>`;
  }

  // ============================================================
  // API extension (safe — API mavjud bo'lsa qo'shadi)
  // ============================================================
  function installAdminAPI() {
    if (typeof window.API !== 'object' || window.API === null) return;

    // Allaqachon o'rnatilgan bo'lsa, qayta yozmaymiz
    if (typeof window.API.adminGet === 'function') return;

    window.API.adminFetch = function (path, opts) {
      const o = opts || {};
      return this.request('/api/admin/' + path, {
        method: o.method || 'GET',
        body: o.body || null
      });
    };

    window.API.adminGet = function (path, params) {
      const q = new URLSearchParams(params || {}).toString();
      return this.request('/api/admin/' + path + (q ? '?' + q : ''));
    };

    window.API.adminPost = function (path, body) {
      return this.adminFetch(path, { method: 'POST', body: body });
    };

    window.API.adminPut = function (path, body) {
      return this.adminFetch(path, { method: 'PUT', body: body });
    };

    window.API.adminDelete = function (path, body) {
      return this.adminFetch(path, { method: 'DELETE', body: body });
    };
  }

  // ============================================================
  // Generic CRUD page builder
  // ============================================================
  function buildCrudPage(cfg) {
    const config = cfg || {};
    const title = config.title || 'Items';
    const subtitle = config.subtitle || '';
    const endpoint = config.endpoint;
    const columns = config.columns || [];
    const formFields = config.formFields || [];
    const idField = config.idField || 'id';
    const canCreate = config.canCreate !== false;
    const canEdit = config.canEdit !== false;
    const canDelete = config.canDelete !== false;

    if (!endpoint) {
      console.error('buildCrudPage: endpoint is required.');
      return;
    }

    const API = getAPI();
    adminPage(title, subtitle);

    const content =
      document.querySelector('.admin-content') ||
      document.getElementById('admin-subtitle')?.parentElement ||
      document.body;

    const toolbarId = 'crud-toolbar-' + Math.random().toString(36).slice(2, 8);
    const hostId = 'crud-host-' + Math.random().toString(36).slice(2, 8);
    const searchId = 'crud-search-' + Math.random().toString(36).slice(2, 8);

    content.insertAdjacentHTML('beforeend', `
      <div class="admin-toolbar" id="${toolbarId}">
        ${canCreate ? `<button class="aw-btn aw-btn-primary" id="crud-new-${hostId}">+ New</button>` : ''}
        <input id="${searchId}" placeholder="Search…" />
        <button class="aw-btn aw-btn-ghost" id="crud-refresh-${hostId}">Refresh</button>
      </div>
      <div id="${hostId}"></div>
    `);

    let all = [];
    const host = document.getElementById(hostId);
    const searchEl = document.getElementById(searchId);

    async function load() {
      if (host) host.innerHTML = '<div class="admin-loading">Loading…</div>';
      const r = await API.adminGet(endpoint);
      if (!r || !r.success) {
        if (host) host.innerHTML = '<div class="admin-empty">Failed to load.</div>';
        return;
      }
      all = (r.data && r.data.items) || [];
      render();
    }

    function render() {
      const q = (searchEl && searchEl.value || '').trim().toLowerCase();
      let list = all.slice();
      if (q) {
        list = list.filter(row =>
          Object.values(row || {}).some(v =>
            String(v == null ? '' : v).toLowerCase().includes(q)
          )
        );
      }

      const cols = columns.slice();
      if (canEdit || canDelete) {
        cols.push({
          label: 'Actions',
          render: r => {
            const rid = r[idField];
            return `<div class="admin-actions">
              ${canEdit ? `<button class="admin-btn-sm" data-act="edit" data-id="${safeEsc(rid)}">Edit</button>` : ''}
              ${canDelete ? `<button class="admin-btn-sm bad" data-act="delete" data-id="${safeEsc(rid)}">Delete</button>` : ''}
            </div>`;
          }
        });
      }

      renderTable(host, cols, list, { emptyText: 'No items.' });

      if (!host) return;
      host.querySelectorAll('button[data-act="edit"]').forEach(b => {
        b.addEventListener('click', () => {
          const id = b.dataset.id;
          const item = all.find(x => String(x[idField]) === String(id));
          openForm(item || null);
        });
      });
      host.querySelectorAll('button[data-act="delete"]').forEach(b => {
        b.addEventListener('click', () => removeItem(b.dataset.id));
      });
    }

    function openForm(item) {
      const body = document.createElement('div');
      body.className = 'aw-form';

      formFields.forEach(f => {
        const wrap = document.createElement('label');

        const labelSpan = document.createElement('span');
        labelSpan.textContent = f.label || f.key;
        wrap.appendChild(labelSpan);

        let input;

        if (f.type === 'textarea') {
          input = document.createElement('textarea');
          input.rows = 3;
          input.value = (item && item[f.key] != null)
            ? item[f.key]
            : (f.default != null ? f.default : '');
        } else if (f.type === 'select') {
          input = document.createElement('select');
          (f.options || []).forEach(o => {
            const opt = document.createElement('option');
            opt.value = o.value;
            opt.textContent = o.label;
            const current = (item && item[f.key] != null)
              ? item[f.key]
              : f.default;
            if (String(current) === String(o.value)) opt.selected = true;
            input.appendChild(opt);
          });
        } else if (f.type === 'checkbox') {
          input = document.createElement('input');
          input.type = 'checkbox';
          input.checked = item ? !!item[f.key] : !!f.default;
          wrap.classList.add('aw-checkbox');
          input.style.width = 'auto';
        } else {
          input = document.createElement('input');
          input.type = f.type || 'text';
          input.value = (item && item[f.key] != null)
            ? item[f.key]
            : (f.default != null ? f.default : '');
        }

        input.dataset.field = f.key;
        input.dataset.fieldType = f.type || 'text';
        wrap.appendChild(input);
        body.appendChild(wrap);
      });

      safeOpenModal({
        title: (item ? 'Edit ' : 'New ') + title.toLowerCase(),
        body: body,
        actions: [
          {
            label: 'Cancel',
            className: 'aw-btn-ghost',
            onClick: () => safeCloseModal()
          },
          {
            label: 'Save',
            className: 'aw-btn-primary',
            onClick: async () => {
              const payload = {};
              body.querySelectorAll('[data-field]').forEach(el => {
                const key = el.dataset.field;
                const t = el.dataset.fieldType;
                if (t === 'checkbox') payload[key] = el.checked;
                else if (t === 'number') payload[key] = Number(el.value);
                else payload[key] = el.value;
              });
              if (item && item[idField] != null) payload[idField] = item[idField];

              const r = item
                ? await API.adminPut(endpoint, payload)
                : await API.adminPost(endpoint, payload);

              if (r && r.success) {
                safeToast('Saved.', 'success');
                safeCloseModal();
                load();
              } else {
                safeToast((r && r.message) || 'Save failed.', 'error');
              }
            }
          }
        ]
      });
    }

    async function removeItem(id) {
      const ok = await safeConfirmModal(
        'Delete this item?',
        'This action cannot be undone.'
      );
      if (!ok) return;
      const r = await API.adminDelete(endpoint, { [idField]: id });
      if (r && r.success) {
        safeToast('Deleted.', 'success');
        load();
      } else {
        safeToast((r && r.message) || 'Delete failed.', 'error');
      }
    }

    if (canCreate) {
      const newBtn = document.getElementById('crud-new-' + hostId);
      if (newBtn) newBtn.addEventListener('click', () => openForm(null));
    }
    if (searchEl) searchEl.addEventListener('input', render);

    const refreshBtn = document.getElementById('crud-refresh-' + hostId);
    if (refreshBtn) refreshBtn.addEventListener('click', load);

    load();
  }

  // ============================================================
  // O'rnatish — barcha global funksiyalarni bir marta ulash
  // ============================================================
  function install() {
    installAdminAPI();

    window.Admin = Admin;
    window.renderAdminSidebar = renderAdminSidebar;
    window.renderAdminTopbar = renderAdminTopbar;
    window.adminPage = adminPage;
    window.renderTable = renderTable;
    window.fmtMoney = fmtMoney;
    window.fmtDateShort = fmtDateShort;
    window.statusPill = statusPill;
    window.buildCrudPage = buildCrudPage;

    // Agar sahifa allaqachon DOM tayyor bo'lsa, avtomatik sidebar/topbar chizamiz
    if (document.readyState === 'interactive' || document.readyState === 'complete') {
      // Sidebar faqat element mavjud bo'lsa chiziladi, va faqat admin sahifalarida
      if (document.getElementById('admin-sidebar')) {
        // Sahifa o'zi adminPage() chaqirmasa, bu yerda chizmaymiz — sahifalar o'zi chaqiradi.
      }
    }
  }

  install();
})();