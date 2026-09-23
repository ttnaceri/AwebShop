// frontend/components/admin-console.js
// Terminal-style Admin Console with ban/unban/AWC commands.
// Backtick (`) opens/closes.

const AdminConsole = (() => {
  let root, input, output, sugBox;
  let history = [];
  let historyIdx = -1;
  let suggestions = [];
  let sugIdx = -1;
  let isOpen = false;

  const COMMANDS = [
    'help',
    'users', 'websites', 'escrow', 'payments', 'withdraw', 'logs',
    'settings', 'maintenance', 'security', 'analytics', 'premium',
    'cards', 'environment', 'backup', 'export', 'import',
    // Ban / Unban / AWC
    'ban', 'unban', 'addawc', 'remawc',
    // Placeholders
    'promocodes', 'discount', 'events', 'announce', 'orders', 'themes',
    'ads', 'reviews', 'featured', 'todo', 'messages', 'invoice', 'popup',
    'stock', 'badge', 'chat', 'schedule', 'force-subscribe',
    'clear', 'exit'
  ];

  // ============================================================
  // DOM SETUP
  // ============================================================
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

    // Resize
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
      const w = Math.max(420, startW + (startX - e.clientX));
      root.style.height = h + 'px';
      root.style.width = w + 'px';
    }
    function onUp() {
      resizing = false;
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    }
  }

  // ============================================================
  // OUTPUT
  // ============================================================
  function print(text, cls = '') {
    const line = document.createElement('div');
    line.className = 'ac-line ' + cls;
    line.innerHTML = text;
    output.appendChild(line);
    output.scrollTop = output.scrollHeight;
  }

  function escHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  // ============================================================
  // AUTOCOMPLETE
  // ============================================================
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

  // ============================================================
  // RUNNER
  // ============================================================
  async function run(line) {
    const parts = line.split(/\s+/);
    const cmd = parts[0].toLowerCase();
    const args = parts.slice(1);

    switch (cmd) {
      case 'help':            return cmdHelp();
      case 'clear':           output.innerHTML = ''; return;
      case 'exit':            return close();
      case 'users':           return cmdUsers();
      case 'websites':        return cmdWebsites();
      case 'escrow':          return cmdEscrow();
      case 'withdraw':        return cmdWithdraw();
      case 'payments':        return cmdPayments();
      case 'logs':            return cmdLogs();
      case 'security':        return cmdSecurity();
      case 'settings':        return cmdSettings();
      case 'maintenance':     return cmdMaintenance();
      case 'analytics':       return cmdAnalytics();
      case 'premium':         return cmdPremium();
      case 'cards':           return cmdCards();
      case 'environment':     return cmdEnvironment();
      case 'backup':          return cmdBackup();
      case 'export':          return cmdExport();
      case 'import':          return cmdImport();
      // Ban / Unban / AWC
      case 'ban':             return cmdBan(args);
      case 'unban':           return cmdUnban(args);
      case 'addawc':          return cmdAddAwc(args);
      case 'remawc':          return cmdRemAwc(args);
      // Placeholders
      default:
        if (COMMANDS.includes(cmd)) return cmdComingSoon(cmd);
        print(`Unknown command: <span class="ac-cmd">${escHtml(cmd)}</span>. Type <span class="ac-cmd">help</span>.`, 'ac-error');
    }
  }

  // ============================================================
  // HELP
  // ============================================================
  function cmdHelp() {
    print(`<b>Available commands</b>`, 'ac-info');
    print('');
    print(`<b>Info:</b>`, '');
    print(`  <span class="ac-cmd">help</span>  <span class="ac-cmd">users</span>  <span class="ac-cmd">websites</span>  <span class="ac-cmd">escrow</span>  <span class="ac-cmd">withdraw</span>`, '');
    print(`  <span class="ac-cmd">payments</span>  <span class="ac-cmd">logs</span>  <span class="ac-cmd">analytics</span>  <span class="ac-cmd">premium</span>  <span class="ac-cmd">cards</span>`, '');
    print('');
    print(`<b>Ban / Unban:</b>`, 'ac-warn');
    print(`  <span class="ac-cmd">ban &lt;userId&gt;</span>                          — permanent ban`, '');
    print(`  <span class="ac-cmd">ban &lt;userId&gt; 1h &lt;reason&gt;</span>              — 1 soat ban`, '');
    print(`  Durations: <span class="ac-cmd">1s | 1m | 1h | 1d | 1w | 1y</span>`, '');
    print(`  <span class="ac-cmd">unban &lt;userId&gt;</span>                        — unban`, '');
    print('');
    print(`<b>AWC:</b>`, 'ac-ok');
    print(`  <span class="ac-cmd">addawc &lt;userId&gt; &lt;amount&gt; [reason]</span>   — qo'shish`, '');
    print(`  <span class="ac-cmd">remawc &lt;userId&gt; &lt;amount&gt; [reason]</span>   — ayirish`, '');
    print('');
    print(`<b>System:</b>`, '');
    print(`  <span class="ac-cmd">settings</span>  <span class="ac-cmd">maintenance</span>  <span class="ac-cmd">security</span>  <span class="ac-cmd">backup</span>  <span class="ac-cmd">export</span>  <span class="ac-cmd">import</span>`, '');
    print(`  <span class="ac-cmd">clear</span>  <span class="ac-cmd">exit</span>`, '');
    print('');
    print(`Dangerous commands ask <span class="ac-cmd">Y/N</span> confirmation.`, 'ac-warn');
  }

  // ============================================================
  // INFO COMMANDS
  // ============================================================
  async function cmdUsers() {
    const r = await API.adminUsers();
    if (!r.success) return print('Failed to load users.', 'ac-error');
    const list = r.data.items;
    print(`Total users: <span class="ac-ok">${list.length}</span>`, 'ac-info');
    list.slice(0, 30).forEach(u => {
      const status = u.banned ? '🚫 BANNED'
        : (u.blocked && u.blockedUntil && new Date(u.blockedUntil) > new Date()) ? '⏸ BLOCKED'
        : '✅';
      print(`  [${escHtml(u.id)}] ${escHtml(u.nickname)} — AWC ${u.balanceAWC} — ${status}`);
    });
    if (list.length > 30) print(`  … ${list.length - 30} more`, 'ac-warn');
  }

  async function cmdWebsites() {
    const r = await API.adminWebsites();
    if (!r.success) return print('Failed.', 'ac-error');
    const list = r.data.items;
    print(`Total websites: <span class="ac-ok">${list.length}</span>`, 'ac-info');
    list.slice(0, 30).forEach(w => {
      print(`  [${escHtml(w.webId)}] ${escHtml(w.name)} — ${w.status} — ${w.saleType} — ${w.type || 'frontend'}`);
    });
    if (list.length > 30) print(`  … ${list.length - 30} more`, 'ac-warn');
  }

  async function cmdEscrow() {
    const r = await API.adminEscrow();
    if (!r.success) return print('Failed.', 'ac-error');
    const list = r.data.items;
    print(`Escrow count: <span class="ac-ok">${list.length}</span>`, 'ac-info');
    list.slice(0, 30).forEach(e => {
      print(`  [${escHtml(e.id)}] web ${escHtml(e.websiteId)} — ${e.status} — ${e.amountUZS} UZS`);
    });
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
  }

  async function cmdSettings() {
    print('Global settings are on the Settings page.', 'ac-warn');
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

  async function cmdCards() {
    const r = await API.adminGet('cards');
    if (!r.success) return print('Failed.', 'ac-error');
    const list = r.data.items;
    print(`Payment cards: <span class="ac-ok">${list.length}</span>`, 'ac-info');
    list.forEach(c => {
      print(`  [${escHtml(c.id)}] **** ${String(c.cardNumber || '').slice(-4)} — ${escHtml(c.bank || '')} — ${c.status}${c.isDefault ? ' ⭐' : ''}`);
    });
  }

  async function cmdEnvironment() {
    print('Environment users: Admin → Environment page.', 'ac-warn');
  }

  async function cmdBackup() {
    const ok = await confirmConsole('Create a backup of backend.json now?');
    if (!ok) return print('Cancelled.', 'ac-warn');
    const r = await API.adminPost('backup', {});
    if (r.success) print(`✅ Backup created: ${r.data.file}`, 'ac-ok');
    else print(`❌ ${r.message}`, 'ac-error');
  }

  async function cmdExport() {
    print('Export is available in Admin → Export/Import.', 'ac-warn');
  }

  async function cmdImport() {
    print('Import is available in Admin → Export/Import.', 'ac-warn');
  }

  // ============================================================
  // BAN / UNBAN
  // ============================================================
  async function cmdBan(args) {
    const userId = args[0];
    if (!userId) {
      print('Usage: <span class="ac-cmd">ban &lt;userId&gt; [duration] [reason]</span>', 'ac-warn');
      print('Durations: <span class="ac-cmd">1s | 1m | 1h | 1d | 1w | 1y</span>', '');
      print('Without duration → permanent ban.', '');
      return;
    }

    const duration = args[1] || '';
    const reason = args.slice(2).join(' ') || '';
    const validDurations = ['1s', '1m', '1h', '1d', '1w', '1y'];
    const isPermanent = !duration || !validDurations.includes(duration);

    const confirmMsg = isPermanent
      ? `PERMANENTLY ban user ${userId}?`
      : `Ban user ${userId} for ${duration}?`;
    const ok = await confirmConsole(confirmMsg);
    if (!ok) return print('Cancelled.', 'ac-warn');

    const r = await API.adminPost('users/ban-duration', { userId, duration, reason });
    if (r.success) {
      print(`✅ ${r.data.message}`, 'ac-ok');
      if (r.data.until) print(`   Until: ${new Date(r.data.until).toLocaleString()}`);
    } else {
      print(`❌ ${r.message}`, 'ac-error');
    }
  }

  async function cmdUnban(args) {
    const userId = args[0];
    if (!userId) return print('Usage: <span class="ac-cmd">unban &lt;userId&gt;</span>', 'ac-warn');

    const r = await API.adminPost('users/unban', { userId });
    if (r.success) print(`✅ ${r.data.message}`, 'ac-ok');
    else print(`❌ ${r.message}`, 'ac-error');
  }

  // ============================================================
  // AWC ADJUST
  // ============================================================
  async function cmdAddAwc(args) {
    const userId = args[0];
    const amount = Number(args[1]);
    const reason = args.slice(2).join(' ') || '';

    if (!userId || !amount || isNaN(amount)) {
      print('Usage: <span class="ac-cmd">addawc &lt;userId&gt; &lt;amount&gt; [reason]</span>', 'ac-warn');
      return;
    }
    if (amount <= 0) return print('Amount must be positive.', 'ac-error');

    const ok = await confirmConsole(`Add ${amount} AWC to user ${userId}?`);
    if (!ok) return print('Cancelled.', 'ac-warn');

    const r = await API.adminPost('users/awc-adjust', { userId, amount, reason });
    if (r.success) {
      print(`✅ ${r.data.message}`, 'ac-ok');
      print(`   New balance: ${r.data.newBalance} AWC`);
    } else {
      print(`❌ ${r.message}`, 'ac-error');
    }
  }

  async function cmdRemAwc(args) {
    const userId = args[0];
    const amount = Number(args[1]);
    const reason = args.slice(2).join(' ') || '';

    if (!userId || !amount || isNaN(amount)) {
      print('Usage: <span class="ac-cmd">remawc &lt;userId&gt; &lt;amount&gt; [reason]</span>', 'ac-warn');
      return;
    }
    if (amount <= 0) return print('Amount must be positive.', 'ac-error');

    const ok = await confirmConsole(`Remove ${amount} AWC from user ${userId}?`);
    if (!ok) return print('Cancelled.', 'ac-warn');

    const r = await API.adminPost('users/awc-adjust', { userId, amount: -Math.abs(amount), reason });
    if (r.success) {
      print(`✅ ${r.data.message}`, 'ac-ok');
      print(`   New balance: ${r.data.newBalance} AWC`);
    } else {
      print(`❌ ${r.message}`, 'ac-error');
    }
  }

  // ============================================================
  // CONFIRM (Y/N)
  // ============================================================
  function confirmConsole(msg) {
    return new Promise(resolve => {
      print(msg + ' <span class="ac-cmd">(Y/N)</span>', 'ac-warn');
      const handler = e => {
        if (e.key === 'y' || e.key === 'Y') {
          input.removeEventListener('keydown', handler);
          print('Confirmed.', 'ac-ok');
          resolve(true);
        } else if (e.key === 'n' || e.key === 'N' || e.key === 'Escape') {
          input.removeEventListener('keydown', handler);
          resolve(false);
        }
      };
      input.addEventListener('keydown', handler);
    });
  }

  // ============================================================
  // OPEN / CLOSE
  // ============================================================
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

  function toggle() {
    ensureDom();
    isOpen ? close() : open();
  }

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