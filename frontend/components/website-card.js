// frontend/components/website-card.js
// Website card render funksiyasi.

(function () {
  'use strict';

  function safeEsc(s) {
    if (typeof window.esc === 'function') return window.esc(s);
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function fmtUZS(n) {
    if (typeof window.fmtUZS === 'function') return window.fmtUZS(n);
    return new Intl.NumberFormat('uz-UZ').format(Math.round(n || 0)) + " so'm";
  }
  function fmtUSD(n) {
    if (typeof window.fmtUSD === 'function') return window.fmtUSD(n);
    return '$' + Number(n || 0).toFixed(2);
  }
  function fmtAWC(n) {
    if (typeof window.fmtAWC === 'function') return window.fmtAWC(n);
    return Number(n || 0).toFixed(4).replace(/\.?0+$/, '') + ' AWC';
  }

  function websiteCard(w) {
    const saleBadge = w.saleType === 'safe'
      ? '<span class="aw-badge aw-badge-safe">Safe</span>'
      : '<span class="aw-badge aw-badge-fast">Fast</span>';

    const typeLabel = w.type === 'frontend' ? '🎨'
      : w.type === 'backend' ? '⚙️'
      : w.type === 'fullstack' ? '🚀' : '';

    const img = w.imageUrl
      ? `<img src="${safeEsc(w.imageUrl)}" alt="${safeEsc(w.name)}" onerror="this.style.display='none'"/>`
      : `<div class="aw-card-noimg">${safeEsc((w.name || '?')[0] || '?')}</div>`;

    return `
      <a class="aw-card" href="website-detail.html?id=${encodeURIComponent(w.webId || '')}">
        <div class="aw-card-img">${img}</div>
        <div class="aw-card-body">
          <div class="aw-card-top">
            <h3 class="aw-card-title">${safeEsc(w.name)}</h3>
            ${saleBadge}
          </div>
          <div class="aw-card-domain">${safeEsc(w.domain)}</div>
          <div class="aw-card-topic">${typeLabel} ${safeEsc(w.topic)}</div>
          <p class="aw-card-desc">${safeEsc(w.description || '')}</p>
          <div class="aw-card-bottom">
            <div class="aw-price">
              <strong>${fmtUZS(w.priceUZS)}</strong>
              <small>${fmtUSD(w.priceUSD)}</small>
            </div>
            <div class="aw-card-meta">👁 ${w.views || 0}</div>
          </div>
        </div>
      </a>
    `;
  }

  window.websiteCard = websiteCard;
})();