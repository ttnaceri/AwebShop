// frontend/js/promocode.js
// AwebShop — Promokod tekshirish.

(function () {
  'use strict';

  var STORAGE_KEY = 'aw_applied_promo';

  var Promocode = {
    apply: async function (code) {
      if (!code || !window.BackendAPI) {
        return { success: false, message: 'Kod bo\'sh.' };
      }
      var res = await window.BackendAPI.findPromocode(code);
      if (!res || !res.success) {
        return { success: false, message: 'Kod topilmadi.' };
      }
      var promo = null;
      if (Array.isArray(res.data)) {
        promo = res.data[0];
      } else if (res.data && res.data.items) {
        promo = res.data.items[0];
      } else if (res.data && res.data.code) {
        promo = res.data;
      }
      if (!promo) {
        return { success: false, message: 'Kod topilmadi.' };
      }
      if (promo.enabled === false) {
        return { success: false, message: 'Kod faol emas.' };
      }
      if (promo.expiresAt && new Date(promo.expiresAt).getTime() < Date.now()) {
        return { success: false, message: 'Kod muddati tugagan.' };
      }

      localStorage.setItem(STORAGE_KEY, JSON.stringify(promo));
      return { success: true, promo: promo, message: 'Kod qo\'llanildi!' };
    },

    getApplied: function () {
      try {
        var raw = localStorage.getItem(STORAGE_KEY);
        return raw ? JSON.parse(raw) : null;
      } catch (_) { return null; }
    },

    clear: function () {
      try { localStorage.removeItem(STORAGE_KEY); }
      catch (_) {}
    },

    calculate: function (totalUZS) {
      var p = this.getApplied();
      if (!p) return { discount: 0, total: totalUZS };
      var discount = 0;
      if (p.type === 'percent') {
        discount = Math.round(totalUZS * (Number(p.value) / 100));
      } else if (p.type === 'fixed') {
        discount = Number(p.value) || 0;
      }
      discount = Math.min(discount, totalUZS);
      return { discount: discount, total: totalUZS - discount, promo: p };
    }
  };

  window.Promocode = Promocode;
  console.log('[promocode] Loaded');
})();