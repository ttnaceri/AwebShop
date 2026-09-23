// frontend/js/password-toggle.js
// Password input'larga 👁 ko'rsatish/yashirish tugmasi qo'shadi.

(function () {
  'use strict';

  function attachToggle(input) {
    if (!input || input.dataset.hasToggle) return;
    input.dataset.hasToggle = '1';

    const wrapper = document.createElement('div');
    wrapper.className = 'aw-pw-wrap';

    // Input'ni wrapper ichiga joylashtirish
    input.parentNode.insertBefore(wrapper, input);
    wrapper.appendChild(input);

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'aw-pw-toggle';
    btn.setAttribute('aria-label', 'Show password');
    btn.innerHTML = '<i class="fa-solid fa-eye"></i>';
    wrapper.appendChild(btn);

    btn.addEventListener('click', () => {
      const isPassword = input.type === 'password';
      input.type = isPassword ? 'text' : 'password';
      btn.innerHTML = isPassword
        ? '<i class="fa-solid fa-eye-slash"></i>'
        : '<i class="fa-solid fa-eye"></i>';
      btn.setAttribute('aria-label', isPassword ? 'Hide password' : 'Show password');
    });
  }

  function scan() {
    document.querySelectorAll('input[type="password"]').forEach(attachToggle);
  }

  // DOM tayyor bo'lganda va yangi modal ochilganda ishlatish
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', scan);
  } else {
    scan();
  }

  // MutationObserver — dinamik qo'shilgan inputlar uchun
  const observer = new MutationObserver(() => scan());
  observer.observe(document.body || document.documentElement, {
    childList: true,
    subtree: true
  });

  window.PasswordToggle = { scan };
})();