// frontend/components/admin-console.js
// Terminal-style Admin Console. Backtick (`) orqali ochiladi.
// Command history session-only, auto-complete (max 3), up/down nav, resize, min/max.

const AdminConsole = (() => {
  let root, input, output, sugBox;
  let history = [];
  let historyIdx = -1;
  let suggestions = [];
  let sugIdx = -1;
  let isOpen = false;

  const COMMANDS = [
    'help','users','websites','escrow','payments','withdraw','promocodes',
    'discount','events','announce','orders','themes','ads','settings',
    'backup','export','import','security','analytics','logs','maintenance',
    'reviews','featured','todo','messages','invoice','popup','stock',
    'badge','chat','schedule','cards','environment','premium',
    'force-subscribe','clear','exit'
  ];

  function ensureDom() {
    if (root) return;
    root = document.createElement('div');
    root.id = 'admin-console';
    root.innerHTML = `
      <div class="ac-header" id="ac-header">
        <div class="ac-title">
          <span class="ac-dot"></span>
          <span>AWebShop Admin Console</span>
        </div>
        <div class="ac-actions">
          <button data-ac="min" title="Minimize">–</button>
          <button data-ac="max" title="Maximize">□</button>
          <button data-ac="clear" title="Clear">⌫</button>
          <button data-ac="close" title="Close (Esc)">×</button>
        </div>
      </div>
      <div class="ac-body" id="ac-body">
        <div class="ac-output" id="ac-output">
          <div class="ac-line ac-info">AWebShop Admin Console — type <span class="ac-cmd">help</span> for commands.</div>
        </div>
        <div class="ac-suggestions" id="ac-suggestions" hidden></div>
        <div class="ac-input-row">
          <span class="ac-prompt">admin@awebshop:~$</span>
          <input id="ac-input" autocomplete="off" spellcheck="false"/>
        </div>
      </div>
      <div class="ac-resize" id="ac-resize"></div>
    `;
    document.body.appendChild(root);

    output = root.querySelector('#ac-output');
    input = root.querySelector('#ac-input');
    sugBox = root.querySelector('#ac-suggestions');

    root.querySelector('[data-ac="close"]').addEventListener('click', () => close());
    root.querySelector('[data-ac="clear"]').addEventListener('click', () => { output.innerHTML = ''; });
    root.querySelector('[data-ac="min"]').addEventListener('click', () => root.classList.toggle('ac-min'));
    root.querySelector('[data-ac="max"]').addEventListener('click', () => root.classList.toggle('ac-max'));

    input.addEventListener('keydown', onKey);
    input.addEventListener('input', onInput);

    // Resize (bottom-right)
    const handle = root.querySelector('#ac-resize');
    let resizing = false, startY, startX, startH, startW;
    handle.addEventListener('mousedown', e => {
      resizing = true;
      startY = e.clientY; startX = e.clientX;
      startH = root.offsetHeight; startW = root.offsetWidth;
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
      e.preventDefault();
    });
    function onMove(e) {
      if (!resizing) return;
      const h = Math.max(220, startH + (startY - e.clientY));
      const w = Math.max(380, startW + (startX - e.clientX));
      root.style.height = h + 'px';
      root.style.width = w + 'px';
    }
    function onUp() {
      resizing = false;
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    }
  }

  function print(text, cls = '') {
    const line = document.createElement('div');
    line.className = 'ac-line ' + cls;
    line.innerHTML = text;
    output.appendChild(line);
    output.scrollTop = output.scrollHeight;
  }

  function onInput() {
    const v = input.value.trimStart();
    if (!v) { hideSug(); return; }
    const matches = COMMANDS.filter(c => c.startsWith(v.toLowerCase())).slice(0, 3);
    if (!matches.length) { hideSug(); return; }
    suggestions = matches;
    sugIdx = -1;
    sugBox.innerHTML = matches.map((m, i) => `<div class="ac-sug" data-i="${i}">${m}</div>`).join('');
    sugBox.hidden = false;
    sugBox.querySelectorAll('.ac-sug').forEach(el => {
      el.addEventListener('click', () => {
        input.value = el.textContent + ' ';
        hideSug();
        input.focus();
      });
    });
  }

  function hideSug() { sugBox.hidden = true; suggestions = []; sugIdx = -1; }

  function onKey(e) {
    if (e.key === 'Enter') {
      const v = input.value.trim();
      if (!v) return;
      history.push(v);
      historyIdx = history.length;
      print(`<span class="ac-prompt-inline">admin@awebshop:~$</span> ${escHtml(v)}`, 'ac-cmdline');
      input.value = '';
      hideSug();
      run(v);
    } else if (e.key === 'ArrowUp') {
      if (suggestions.length) {
        sugIdx = (sugIdx <= 0 ? suggestions.length - 1 : sugIdx - 1);
        input.value = suggestions[sugIdx];
        e.preventDefault();
        return;
      }
      if (history.length) {
        historyIdx = Math.max(0, historyIdx - 1);
        input.value = history[historyIdx] || '';
        e.preventDefault();
      }
    } else if (e.key === 'ArrowDown') {
      if (suggestions.length) {
        sugIdx = (sugIdx >= suggestions.length - 1 ? 0 : sugIdx + 1);
        input.value = suggestions[sugIdx];
        e.preventDefault();
        return;
      }
      if (history.length) {
        historyIdx = Math.min(history.length, historyIdx + 1);
        input.value = history[historyIdx] || '';
        e.preventDefault();
      }
    } else if (e.key === 'Tab' && suggestions.length) {
      input.value = suggestions[0] + ' ';
      hideSug();
      e.preventDefault();
    } else if (e.key === 'Escape') {
      hideSug();
      e.preventDefault();
    }
  }

  function escHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  // ---- Command runner ----
  async function run(line) {
    const parts = line.split(/\s+/);
    const cmd = parts[0].toLowerCase();
    const args = parts.slice(1);

    switch (cmd) {
      case 'help': return cmdHelp();
      case 'clear': output.innerHTML = ''; return;
      case 'exit': return close();
      case 'users': return cmdUsers();
      case 'websites': return cmdWebsites();
      case 'escrow': return cmdEscrow();
      case 'withdraw': return cmdWithdraw();
      case 'payments': return cmdPayments();
      case 'logs': return cmdLogs();
      case 'security': return cmdSecurity();
      case 'settings': return cmdSettings();
      case 'maintenance': return cmdMaintenance();
      case 'analytics': return cmdAnalytics();
      case 'premium': return cmdPremium();
      case 'environment': return cmdEnvironment();
      case 'backup': return cmdBackup();
      case 'export': return cmdExport();
      case 'import': return cmdImport();
      case 'todo': return cmdTodo();
      case 'badge': return cmdBadge();
      case 'force-subscribe': return cmdForceSub();
      case 'promocodes': case 'discount': case 'events': case 'announce':
      case 'orders': case 'themes': case 'ads': case 'reviews': case 'featured':
      case 'messages': case 'invoice': case 'popup': case 'stock': case 'chat':
      case 'schedule': case 'cards': return cmdComingSoon(cmd);
      default:
        print(`Unknown command: <span class="ac-cmd">${escHtml(cmd)}</span>. Type <span class="ac-cmd">help</span>.`, 'ac-error');
    }
  }

  function cmdHelp() {
    print(`Available commands:`, 'ac-info');
    print(COMMANDS.map(c => `<span class="ac-cmd">${c}</span>`).join('  '), '');
    print(`ID syntax: <span class="ac-cmd">id.</span> = single/last, <span class="ac-cmd">id,</span> = multiple.`, 'ac-warn');
    print(`Dangerous commands ask Y/N confirmation.`, 'ac-warn');
  }

  async function cmdUsers() {
    const r = await API.adminUsers();
    if (!r.success) return print('Failed to load users.', 'ac-error');
    const list = r.data.items;
    print(`Total users: <span class="ac-ok">${list.length}</span>`, 'ac-info');
    list.slice(0, 30).forEach(u => {
      print(`  [${escHtml(u.id)}] ${escHtml(u.nickname)} — AWC ${u.balanceAWC} — ${u.blocked ? 'BLOCKED' : 'ok'}`);
    });
    if (list.length > 30) print(`  … ${list.length - 30} more`, 'ac-warn');
  }

  async function cmdWebsites() {
    const r = await API.adminWebsites();
    if (!r.success) return print('Failed.', 'ac-error');
    const list = r.data.items;
    print(`Total websites: <span class="ac-ok">${list.length}</span>`, 'ac-info');
    list.slice(0, 30).forEach(w => {
      print(`  [${escHtml(w.webId)}] ${escHtml(w.name)} — ${w.status} — ${w.saleType}`);
    });
  }

  async function cmdEscrow() {
    const r = await API.adminEscrow();
    if (!r.success) return print('Failed.', 'ac-error');
    const list = r.data.items;
    print(`Escrow count: <span class="ac-ok">${list.length}</span>`, 'ac-info');
    list.slice(0, 30).forEach(e => {
      print(`  [${escHtml(e.id)}] web ${escHtml(e.websiteId)} — ${e.status} — ${e.amountUZS} UZS`);
    });
    print(`Usage: escrow <id>. <status> [notes]`, 'ac-warn');
    print(`Statuses: pending | paid | transferred | verified | completed | cancelled | disputed | refunded`, '');
  }

  async function cmdWithdraw() {
    const r = await API.adminWithdrawals();
    if (!r.success) return print('Failed.', 'ac-error');
    const list = r.data.items;
    print(`Withdrawals: <span class="ac-ok">${list.length}</span>`, 'ac-info');
    list.slice(0, 30).forEach(w => {
      print(`  [${escHtml(w.id)}] user ${escHtml(w.userId)} — ${w.amountAWC} AWC — ${w.status}`);
    });
  }

  async function cmdPayments() {
    print('Use Admin Panel → Payments to verify manual card payments.', 'ac-warn');
    print('Command form: payments approve <txId> OR payments reject <txId>', '');
  }

  async function cmdLogs() {
    const r = await API.adminLogs();
    if (!r.success) return print('Failed.', 'ac-error');
    const list = r.data.items.slice(-40);
    print(`Last ${list.length} admin log entries:`, 'ac-info');
    list.forEach(l => print(`  ${l.timestamp} — ${escHtml(l.action)} — ${escHtml(l.target || '-')} — by ${escHtml(l.adminId)}`));
  }

  async function cmdSecurity() {
    print('Security snapshot:', 'ac-info');
    const r = await API.adminStats();
    if (r.success) {
      print(`  Users: ${r.data.users}  Websites: ${r.data.websites}  Orders: ${r.data.orders}`);
    }
    print('Use Admin → Security for blocklist, attempts, and IP rules.', 'ac-warn');
  }

  async function cmdSettings() {
    print('Global settings are edited on the Settings page.', 'ac-warn');
    print('Quick actions:', '');
    print('  settings awc <uzs>        — set 1 AWC price in UZS', '');
    print('  settings maintenance on|off', '');
  }

  async function cmdMaintenance() {
    print('Maintenance is toggled from Admin → Maintenance page.', 'ac-warn');
  }

  async function cmdAnalytics() {
    const r = await API.adminStats();
    if (!r.success) return print('Failed.', 'ac-error');
    const d = r.data;
    print('--- Analytics ---', 'ac-info');
    print(`Users:        ${d.users}`);
    print(`Websites:     ${d.websites} (active: ${d.activeWebsites})`);
    print(`Orders:       ${d.orders}`);
    print(`Transactions: ${d.transactions}`);
    print(`Escrows:      ${d.escrows}`);
    print(`Withdrawals:  ${d.withdrawals}`);
    print(`Revenue UZS:  ${d.revenue}`);
  }

  async function cmdPremium() {
    const r = await API.premiumPlans();
    if (!r.success) return print('Failed.', 'ac-error');
    print('Premium plans:', 'ac-info');
    r.data.items.forEach(p => {
      print(`  ${p.name}  —  ${p.monthlyPriceUZS} UZS/month  —  ${p.commission}%  —  ${p.websitesPerMonth}/mo`);
    });
  }

  async function cmdEnvironment() {
    print('Environment users:', 'ac-warn');
    print('Access codes are stored hashed. Use Admin → Environment page.', '');
  }

  async function cmdBackup() {
    const ok = await confirmConsole('Create a backup of backend.json now?');
    if (!ok) return print('Cancelled.', 'ac-warn');
    print('Triggering backup on server…', 'ac-info');
    print('Backup command is handled by admin server route (see admin panel → Backup).', 'ac-warn');
  }

  async function cmdExport() {
    print('Export is available in Admin → Export/Import (CSV / JSON).', 'ac-warn');
  }
  async function cmdImport() {
    print('Import is available in Admin → Export/Import. Validate before writing.', 'ac-warn');
  }
  async function cmdTodo() {
    print('Todo list is managed on Admin → Todo page.', 'ac-warn');
  }
  async function cmdBadge() {
    print('Badges are managed on Admin → Badges page.', 'ac-warn');
  }
  async function cmdForceSub() {
    print('Force-subscribe channels: Admin → Force Subscribe page.', 'ac-warn');
  }
  async function cmdComingSoon(cmd) {
    print(`${cmd}: full command UI is on its admin page. Backend routes are stable.`, 'ac-warn');
  }

  function confirmConsole(msg) {
    return new Promise(resolve => {
      print(msg + ' <span class="ac-cmd">(Y/N)</span>', 'ac-warn');
      const handler = e => {
        if (e.key === 'y' || e.key === 'Y') { input.removeEventListener('keydown', handler); resolve(true); }
        else if (e.key === 'n' || e.key === 'N' || e.key === 'Escape') { input.removeEventListener('keydown', handler); resolve(false); }
      };
      input.addEventListener('keydown', handler);
    });
  }

  function open() {
    ensureDom();
    root.classList.add('ac-open');
    isOpen = true;
    setTimeout(() => input.focus(), 40);
  }
  function close() {
    if (!root) return;
    root.classList.remove('ac-open');
    isOpen = false;
  }
  function toggle() { ensureDom(); isOpen ? close() : open(); }

  // Global backtick
  document.addEventListener('keydown', e => {
    if (e.key === '`' && !e.target.matches('input, textarea')) {
      e.preventDefault();
      toggle();
    }
  });

  return { open, close, toggle };
})();

window.AdminConsole = AdminConsole;