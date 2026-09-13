// frontend/js/shortcuts.js
// Klaviatura shortcutlari. Backtick (`) Admin Console uchun keyingi qismda.

document.addEventListener('keydown', e => {
  const tag = (e.target.tagName || '').toLowerCase();
  const typing = tag === 'input' || tag === 'textarea' || e.target.isContentEditable;

  // Esc — modal yopish
  if (e.key === 'Escape') {
    if (document.getElementById('aw-modal-root')) window.closeModal();
    return;
  }

  // Ctrl+S — searchga fokus (browser save ni buzmaslik uchun faqat search mavjud bo'lsa)
  if (e.ctrlKey && e.key.toLowerCase() === 's') {
    const s = document.getElementById('aw-search-input');
    if (s) { e.preventDefault(); s.focus(); }
    return;
  }

  // Ctrl+N — Messages
  if (e.ctrlKey && e.key.toLowerCase() === 'n') {
    if (typing) return;
    e.preventDefault();
    location.href = 'profile.html#messages';
    return;
  }

  // Ctrl+P — Profile
  if (e.ctrlKey && e.key.toLowerCase() === 'p') {
    if (typing) return;
    e.preventDefault();
    location.href = 'profile.html';
    return;
  }

  if (typing) return;

  if (e.shiftKey && e.key.toLowerCase() === 's') { location.href = 'store.html'; }
  if (e.shiftKey && e.key.toLowerCase() === 'l') { location.href = 'sell.html'; }
  if (e.shiftKey && e.key.toLowerCase() === 'w') { location.href = 'wallet.html'; }
  if (e.shiftKey && e.key.toLowerCase() === 'f') {
    if (document.fullscreenElement) document.exitFullscreen();
    else document.documentElement.requestFullscreen().catch(() => {});
  }
  if (e.shiftKey && e.key === '?') {
    alert('Shortcuts:\n` — Admin Console\nShift+S — Store\nShift+L — Sell\nShift+W — Wallet\nShift+F — Fullscreen\nCtrl+S — Search\nCtrl+N — Messages\nCtrl+P — Profile\nEsc — Close modal');
  }
});