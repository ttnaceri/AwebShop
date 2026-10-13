// frontend/js/cart.js
// AwebShop — Savatcha (localStorage).

(function () {
  'use strict';

  var STORAGE_KEY = 'aw_cart';

  var Cart = {
    load: function () {
      try {
        var raw = localStorage.getItem(STORAGE_KEY);
        return raw ? JSON.parse(raw) : [];
      } catch (_) { return []; }
    },

    save: function (items) {
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(items)); }
      catch (_) {}
    },

    add: function (product) {
      var items = this.load();
      var exists = items.find(function (i) { return i.id === product.id; });
      if (exists) {
        exists.qty = (exists.qty || 1) + 1;
      } else {
        items.push({
          id: product.id,
          name: product.name,
          priceUZS: product.priceUZS || 0,
          imageUrl: product.imageUrl || '',
          qty: 1
        });
      }
      this.save(items);
      return items;
    },

    remove: function (id) {
      var items = this.load().filter(function (i) { return i.id !== id; });
      this.save(items);
      return items;
    },

    setQty: function (id, qty) {
      var items = this.load();
      var it = items.find(function (i) { return i.id === id; });
      if (it) it.qty = Math.max(1, Number(qty) || 1);
      this.save(items);
      return items;
    },

    clear: function () {
      this.save([]);
    },

    count: function () {
      return this.load().reduce(function (s, i) { return s + (i.qty || 1); }, 0);
    },

    total: function () {
      return this.load().reduce(function (s, i) { return s + (i.priceUZS || 0) * (i.qty || 1); }, 0);
    }
  };

  window.Cart = Cart;
  console.log('[cart] Loaded');
})();