// frontend/js/validation.js

const Validators = {
  nickname(v) { return /^[a-zA-Z0-9_]{3,20}$/.test(String(v).trim()); },
  password(v) { return String(v).length >= 8; },
  phone(v) { return /^\+?\d{7,15}$/.test(String(v).replace(/[\s-]/g, '')); },
  telegramUsername(v) { return /^@?[a-zA-Z0-9_]{5,32}$/.test(String(v).trim()); },
  telegramId(v) { return /^\d{5,15}$/.test(String(v).trim()); },
  code(v) { return /^\d{6}$/.test(String(v).trim()); },
  domain(v) {
    const d = String(v).trim().toLowerCase()
      .replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/.*$/, '');
    return /^([a-z0-9-]+\.)+[a-z]{2,}$/.test(d);
  },
  descLength(v) { return String(v || '').replace(/\s/g, '').length; }
};
window.Validators = Validators;