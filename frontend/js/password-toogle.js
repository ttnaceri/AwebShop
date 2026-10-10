// frontend/js/password-toggle.js
// Parol input'larga 👁 tugma qo'shadi.

(function () {
  'use strict';

  function attachToggle(input) {
    if (!input || input.dataset.hasToggle === '1') return;
    input.dataset.hasToggle = '1';

    if (input.parentNode && input.parentNode.classList &&
        input.parentNode.classList.contains('aw-pw-wrap')) return;

    var wrapper = document.createElement('div');
    wrapper.className = 'aw-pw-wrap';
    input.parentNode.insertBefore(wrapper, input);
    wrapper.appendChild(input);

    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'aw-pw-toggle';
    btn.setAttribute('aria-label', 'Show password');
    btn.innerHTML = '<i class="fa-solid fa-eye"></i>';
    wrapper.appendChild(btn);

    btn.addEventListener('click', function (e) {
      e.preventDefault();
      var isPassword = input.type === 'password';
      input.type = isPassword ? 'text' : 'password';
      btn.innerHTML = isPassword
        ? '<i class="fa-solid fa-eye-slash"></i>'
        : '<i class="fa-solid fa-eye"></i>';
    });
  }

  function scan() {
    var inputs = document.querySelectorAll('input[type="password"]');
    Array.prototype.forEach.call(inputs, attachToggle);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', scan);
  } else {
    scan();
  }

  try {
    var observer = new MutationObserver(function () {
      if (observer._pending) return;
      observer._pending = true;
      setTimeout(function () { observer._pending = false; scan(); }, 100);
    });
    if (document.body) observer.observe(document.body, { childList: true, subtree: true });
  } catch (e) {}

  window.PasswordToggle = { scan: scan };
})();