// frontend/components/website-card.js
// website-card elementini yasash. Store sahifasida ishlatiladi.

function websiteCard(w) {
  const saleBadge = w.saleType === 'safe'
    ? `<span class="aw-badge aw-badge-safe">${t('safe')}</span>`
    : `<span class="aw-badge aw-badge-fast">${t('fast')}</span>`;

  const img = w.imageUrl
    ? `<img src="${esc(w.imageUrl)}" alt="${esc(w.name)}" onerror="this.style.display='none'"/>`
    : `<div class="aw-card-noimg">${esc(w.name[0] || '?')}</div>`;

  return `
    <a class="aw-card" href="website-detail.html?id=${encodeURIComponent(w.webId)}">
      <div class="aw-card-img">${img}</div>
      <div class="aw-card-body">
        <div class="aw-card-top">
          <h3 class="aw-card-title">${esc(w.name)}</h3>
          ${saleBadge}
        </div>
        <div class="aw-card-domain">${esc(w.domain)}</div>
        <div class="aw-card-topic">${esc(w.topic)}</div>
        <p class="aw-card-desc">${esc(w.description)}</p>
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
function websiteCard(w) {
  // ...
  const typeBadge = w.type === 'frontend' ? '🎨 Frontend'
    : w.type === 'backend' ? '⚙️ Backend'
    : w.type === 'fullstack' ? '🚀 Fullstack'
    : '';
  // ...
}