// frontend/components/footer.js

function renderFooter() {
  const host = document.getElementById('aw-footer');
  if (!host) return;
  host.innerHTML = `
    <footer class="aw-footer">
      <div class="aw-footer-grid">
        <div>
          <h4>AWebShop</h4>
          <p class="aw-muted">Marketplace for buying and selling fully functional websites.</p>
        </div>
        <div>
          <h4>Links</h4>
          <ul>
            <li><a href="about.html">About</a></li>
            <li><a href="about.html#help">Help</a></li>
            <li><a href="about.html#contact">Contact</a></li>
            <li><a href="about.html#quality">Quality Services</a></li>
          </ul>
        </div>
        <div>
          <h4>Social</h4>
          <ul class="aw-social">
            <li><a href="https://github.com/ttnaceri/" target="_blank" rel="noopener">GitHub</a></li>
            <li><a href="https://t.me/updateDevNews" target="_blank" rel="noopener">Telegram</a></li>
            <li><a href="https://www.instagram.com/update.dev26/" target="_blank" rel="noopener">Instagram</a></li>
            <li><a href="https://www.linkedin.com/in/ttnaceri-fan-506b57431" target="_blank" rel="noopener">LinkedIn</a></li>
          </ul>
        </div>
      </div>
      <div class="aw-footer-bottom">
        <span>© 2026 UPDATE Inc. All Rights Reserved.</span>
        <span>Made with ❤️ in Uzbekistan</span>
      </div>
    </footer>
  `;
}

document.addEventListener('DOMContentLoaded', renderFooter);