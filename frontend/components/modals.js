// frontend/components/modals.js
// Universal modal tizimi.

function openModal({ title, body, actions = [], onClose = null }) {
  closeModal();
  const root = document.createElement('div');
  root.className = 'aw-modal-root';
  root.id = 'aw-modal-root';
  root.innerHTML = `
    <div class="aw-modal-backdrop"></div>
    <div class="aw-modal">
      <div class="aw-modal-header">
        <h3>${esc(title || '')}</h3>
        <button class="aw-modal-close" aria-label="Close">×</button>
      </div>
      <div class="aw-modal-body"></div>
      <div class="aw-modal-actions"></div>
    </div>
  `;
  document.body.appendChild(root);

  const bodyEl = root.querySelector('.aw-modal-body');
  if (typeof body === 'string') bodyEl.innerHTML = body;
  else bodyEl.appendChild(body);

  const actionsEl = root.querySelector('.aw-modal-actions');
  actions.forEach(a => {
    const btn = document.createElement('button');
    btn.className = 'aw-btn ' + (a.className || '');
    btn.textContent = a.label;
    btn.addEventListener('click', () => a.onClick && a.onClick());
    actionsEl.appendChild(btn);
  });

  const close = () => closeModal();
  root.querySelector('.aw-modal-close').addEventListener('click', close);
  root.querySelector('.aw-modal-backdrop').addEventListener('click', close);
  root._onClose = onClose;
  requestAnimationFrame(() => root.classList.add('show'));
}

function closeModal() {
  const root = document.getElementById('aw-modal-root');
  if (!root) return;
  root.classList.remove('show');
  const cb = root._onClose;
  setTimeout(() => { root.remove(); cb && cb(); }, 200);
}

function confirmModal(title, message) {
  return new Promise(resolve => {
    openModal({
      title,
      body: `<p>${esc(message)}</p>`,
      actions: [
        { label: 'Cancel', className: 'aw-btn-ghost', onClick: () => { closeModal(); resolve(false); } },
        { label: 'Confirm', className: 'aw-btn-danger', onClick: () => { closeModal(); resolve(true); } }
      ]
    });
  });
}

window.openModal = openModal;
window.closeModal = closeModal;
window.confirmModal = confirmModal;