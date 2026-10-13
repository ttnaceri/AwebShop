// frontend/js/orders.js
// AwebShop — Buyurtma berish.

(function () {
  'use strict';

  var ORDERS_KEY = 'aw_orders';

  var Orders = {
    getAll: function () {
      try {
        var raw = localStorage.getItem(ORDERS_KEY);
        return raw ? JSON.parse(raw) : [];
      } catch (_) { return []; }
    },

    save: function (orders) {
      try { localStorage.setItem(ORDERS_KEY, JSON.stringify(orders)); }
      catch (_) {}
    },

    create: async function () {
      var cart = window.Cart ? window.Cart.load() : [];
      if (!cart.length) {
        return { success: false, message: 'Savatcha bo\'sh.' };
      }
      var user = window.AuthExt ? window.AuthExt.getUser() : null;
      if (!user) {
        return { success: false, message: 'Avval tizimga kiring.' };
      }

      var total = window.Cart.total();
      var promoCalc = window.Promocode ? window.Promocode.calculate(total) : { discount: 0, total: total };
      var finalTotal = promoCalc.total;

      var orderId = 'ord_' + Date.now().toString(36).toUpperCase();
      var order = {
        id: orderId,
        userId: user.id,
        nickname: user.nickname,
        items: cart,
        totalUZS: finalTotal,
        discountUZS: promoCalc.discount,
        promoCode: promoCalc.promo ? promoCalc.promo.code : null,
        status: 'pending',
        createdAt: new Date().toISOString()
      };

      // Local saqlash
      var all = this.getAll();
      all.push(order);
      this.save(all);

      // Backendga saqlash (async)
      if (window.BackendAPI) {
        try {
          await window.BackendAPI.createOrder(order);
        } catch (e) {
          console.warn('[orders] Backend error:', e.message);
        }
      }

      // Savatni tozalash
      if (window.Cart) window.Cart.clear();
      if (window.Promocode) window.Promocode.clear();

      return { success: true, order: order };
    },

    getByUser: function (userId) {
      return this.getAll().filter(function (o) { return o.userId === userId; });
    },

    clear: function () {
      this.save([]);
    }
  };

  window.Orders = Orders;
  console.log('[orders] Loaded');
})();