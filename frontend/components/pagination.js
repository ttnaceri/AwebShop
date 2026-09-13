// frontend/components/pagination.js

function renderPagination(hostEl, { page, totalPages, onChange }) {
  if (!hostEl) return;
  if (totalPages <= 1) { hostEl.innerHTML = ''; return; }

  const pages = [];
  const push = p => pages.push(p);
  const range = 2;

  push(1);
  for (let p = page - range; p <= page + range; p++) {
    if (p > 1 && p < totalPages) push(p);
  }
  if (totalPages > 1) push(totalPages);

  const uniq = [...new Set(pages)].sort((a, b) => a - b);

  const parts = [];
  let prev = 0;
  for (const p of uniq) {
    if (p - prev > 1) parts.push('…');
    parts.push(p);
    prev = p;
  }

  hostEl.innerHTML = `
    <button class="aw-page-btn" data-page="${page - 1}" ${page === 1 ? 'disabled' : ''}>‹</button>
    ${parts.map(p => typeof p === 'number'
      ? `<button class="aw-page-btn ${p === page ? 'active' : ''}" data-page="${p}">${p}</button>`
      : `<span class="aw-page-gap">…</span>`).join('')}
    <button class="aw-page-btn" data-page="${page + 1}" ${page === totalPages ? 'disabled' : ''}>›</button>
  `;

  hostEl.querySelectorAll('button[data-page]').forEach(b => {
    b.addEventListener('click', () => {
      const p = Number(b.dataset.page);
      if (p >= 1 && p <= totalPages && p !== page) onChange(p);
    });
  });
}

window.renderPagination = renderPagination;