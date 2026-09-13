// frontend/js/shortcuts.js
// Klaviatura shortcutlari.
// Backtick (`) — Admin Console ochish/yopish (faqat admin sahifalarida).
//
// Ishlatish: <script src="../js/shortcuts.js"></script>
// Modals.js bilan birgalikda ishlaydi (Esc uchun).

(function () {
  'use strict';

  function isTyping() {
    const el = document.activeElement;
    if (!el) return false;
    const tag = (el.tagName || '').toLowerCase();
    return tag === 'input' || tag === 'textarea' || el.isContentEditable;
  }

  function go(href) {
    // Agar allaqachon shu sahifada bo'lsak, hech narsa qilmaymiz
    const current = location.pathname.split('/').pop();
    if (current === href) return;
    location.href = href;
  }

  document.addEventListener('keydown', function (e) {
    // ---- Esc: modal yopish ----
    if (e.key === 'Escape') {
      if (typeof window.closeModal === 'function' &&
          document.getElementById('aw-modal-root')) {
        window.closeModal();
      }
      return;
    }

    // ---- Backtick (`) — Admin Console ----
    if (e.key === '`' && !isTyping()) {
      if (window.AdminConsole && typeof window.AdminConsole.toggle === 'function') {
        e.preventDefault();
        window.AdminConsole.toggle();
        return;
      }
    }

    // ---- Ctrl+S: searchga fokus (browser save ni buzmaslik uchun faqat input mavjud bo'lsa) ----
    if (e.ctrlKey && (e.key === 's' || e.key === 'S')) {
      const s = document.getElementById('aw-search-input');
      if (s) {
        e.preventDefault();
        s.focus();
      }
      return;
    }

    // ---- Ctrl+N: Messages ----
    if (e.ctrlKey && (e.key === 'n' || e.key === 'N')) {
      if (isTyping()) return;
      e.preventDefault();
      go('profile.html#messages');
      return;
    }

    // ---- Ctrl+P: Profile ----
    if (e.ctrlKey && (e.key === 'p' || e.key === 'P')) {
      if (isTyping()) return;
      e.preventDefault();
      go('profile.html');
      return;
    }

    // Qolganlarida yozayotgan bo'lsa — to'xtatamiz
    if (isTyping()) return;

    // ---- Shift + harflar ----
    if (e.shiftKey && !e.ctrlKey && !e.altKey) {
      const k = (e.key || '').toLowerCase();

      if (k === 's') { go('store.html'); return; }
      if (k === 'l') { go('sell.html');  return; }
      if (k === 'w') { go('wallet.html'); return; }

      // ---- Shift+F: Fullscreen ----
      if (k === 'f') {
        if (document.fullscreenElement) {
          document.exitFullscreen().catch(function () {});
        } else if (document.documentElement.requestFullscreen) {
          document.documentElement.requestFullscreen().catch(function () {});
        }
        return;
      }

      // ---- Shift+? (ya'ni Shift+/) — yordam ----
      if (e.key === '?' || (e.shiftKey && e.key === '/')) {
        alert(
          'AWebShop Shortcuts\n\n' +
          '`  — Admin Console\n' +
          'Shift + S  — Store\n' +
          'Shift + L  — Sell\n' +
          'Shift + W  — Wallet\n' +
          'Shift + F  — Fullscreen\n' +
          'Ctrl + S  — Focus search\n' +
          'Ctrl + N  — Messages\n' +
          'Ctrl + P  — Profile\n' +
          'Esc  — Close modal'
        );
      }
    }
  });
})();