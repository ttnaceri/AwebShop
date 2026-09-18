// frontend/components/file-uploader.js
// Universal fayl yuklovchi. Rasm, PDF, hujjat qabul qiladi.
// Backend'ga POST /api/upload ga yuboradi.

(function () {
  'use strict';

  /**
   * File uploader yaratish
   * @param {object} opts
   * @param {string} opts.containerId - HTML element id
   * @param {string} opts.accept - 'image/*' | '.pdf' | 'image/*,.pdf'
   * @param {string} opts.folder - 'websites' | 'badges' | 'avatars' | 'attachments'
   * @param {string} opts.initialUrl - boshlang'ich URL (mavjud bo'lsa)
   * @param {number} opts.maxSizeMB - maksimal hajm (default 5)
   * @param {function} opts.onChange - URL o'zgarganda chaqiriladi
   */
  function createUploader(opts) {
    const container = document.getElementById(opts.containerId);
    if (!container) {
      console.error('Uploader: container topilmadi:', opts.containerId);
      return null;
    }

    const accept = opts.accept || 'image/*';
    const folder = opts.folder || 'misc';
    const maxSizeMB = opts.maxSizeMB || 5;
    let currentUrl = opts.initialUrl || '';

    container.innerHTML = `
      <div class="aw-uploader">
        <div class="aw-uploader-preview" id="${opts.containerId}-preview">
          ${currentUrl
            ? `<img src="${currentUrl}" alt="preview" onerror="this.style.display='none'"/>`
            : '<div class="aw-uploader-placeholder">📁</div>'}
        </div>
        <div class="aw-uploader-controls">
          <button type="button" class="aw-btn aw-btn-ghost" id="${opts.containerId}-btn">
            ${window.I18N ? window.I18N.t('chooseFile') : 'Choose file'}
          </button>
          <input type="file" id="${opts.containerId}-input" accept="${accept}" hidden/>
          <div class="aw-uploader-or">${window.I18N ? window.I18N.t('orPasteUrl') : 'or paste URL'}</div>
          <input type="text" id="${opts.containerId}-url" placeholder="https://..." value="${currentUrl}"/>
          <div class="aw-uploader-status" id="${opts.containerId}-status"></div>
        </div>
      </div>
    `;

    const fileInput = document.getElementById(`${opts.containerId}-input`);
    const urlInput = document.getElementById(`${opts.containerId}-url`);
    const statusEl = document.getElementById(`${opts.containerId}-status`);
    const previewEl = document.getElementById(`${opts.containerId}-preview`);
    const btn = document.getElementById(`${opts.containerId}-btn`);

    function updatePreview(url) {
      if (!url) {
        previewEl.innerHTML = '<div class="aw-uploader-placeholder">📁</div>';
        return;
      }
      if (url.match(/\.(png|jpe?g|gif|webp|svg|ico)$/i) || url.startsWith('data:image')) {
        previewEl.innerHTML = `<img src="${url}" alt="preview" onerror="this.style.display='none'"/>`;
      } else {
        previewEl.innerHTML = `<div class="aw-uploader-file">📄 ${url.split('/').pop()}</div>`;
      }
    }

    function setStatus(text, type) {
      statusEl.textContent = text || '';
      statusEl.className = 'aw-uploader-status ' + (type || '');
    }

    btn.addEventListener('click', () => fileInput.click());

    fileInput.addEventListener('change', async (e) => {
      const file = e.target.files && e.target.files[0];
      if (!file) return;

      // Hajm tekshiruvi
      if (file.size > maxSizeMB * 1024 * 1024) {
        setStatus(`File too large (max ${maxSizeMB}MB)`, 'error');
        return;
      }

      setStatus(window.I18N ? window.I18N.t('uploading') : 'Uploading…', 'info');

      try {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('folder', folder);

        const token = (window.API && window.API.getToken) ? window.API.getToken() : null;
        const headers = {};
        if (token) headers['Authorization'] = 'Bearer ' + token;

        const base = window.API_BASE || '';
        const res = await fetch(base + '/api/upload', {
          method: 'POST',
          headers,
          body: formData
        });
        const data = await res.json();

        if (data.success && data.data && data.data.url) {
          currentUrl = data.data.url;
          urlInput.value = currentUrl;
          updatePreview(currentUrl);
          setStatus(window.I18N ? window.I18N.t('uploadSuccess') : 'Uploaded.', 'success');
          if (typeof opts.onChange === 'function') opts.onChange(currentUrl);
        } else {
          setStatus(data.message || 'Upload failed', 'error');
        }
      } catch (err) {
        console.error('[uploader]', err);
        setStatus(window.I18N ? window.I18N.t('uploadFailed') : 'Upload failed.', 'error');
      }
    });

    urlInput.addEventListener('input', () => {
      currentUrl = urlInput.value.trim();
      updatePreview(currentUrl);
      if (typeof opts.onChange === 'function') opts.onChange(currentUrl);
    });

    return {
      getUrl: () => currentUrl,
      setUrl: (url) => {
        currentUrl = url || '';
        urlInput.value = currentUrl;
        updatePreview(currentUrl);
      }
    };
  }

  window.createUploader = createUploader;
})();