// frontend/js/favorites.js
// AwebShop — Sevimlilar ro'yxati (localStorage + backend sync).

(function () {
  'use strict';

  var KEY = 'aw_favorites';

  var Favorites = {
    getAll: function () {
      try {
        var raw = localStorage.getItem(KEY);
        return raw ? JSON.parse(raw) : [];
      } catch (_) { return []; }
    },

    save: function (list) {
      try { localStorage.setItem(KEY, JSON.stringify(list)); }
      catch (_) {}
    },

    has: function (id) {
      return this.getAll().indexOf(id) !== -1;
    },

    toggle: function (id) {
      var list = this.getAll();
      var idx = list.indexOf(id);
      if (idx >= 0) list.splice(idx, 1);
      else list.push(id);
      this.save(list);
      this.syncRemote();
      return this.has(id);
    },

    syncRemote: async function () {
      var user = window.AuthExt ? window.AuthExt.getUser() : null;
      if (!user || !window.BackendAPI) return;
      try {
        await window.BackendAPI.saveCustom('favorites', this.getAll(), user.id);
      } catch (_) {}
    },

    loadRemote: async function () {
      var user = window.AuthExt ? window.AuthExt.getUser() : null;
      if (!user || !window.BackendAPI) return;
      try {
        var res = await window.BackendAPI.loadCustom('favorites', user.id);
        if (res && res.success) {
          var list = Array.isArray(res.data) ? res.data : [];
          if (list.length) {
            var first = list[0];
            if (first && first.value) this.save(first.value);
          }
        }
      } catch (_) {}
    }
  };

  window.Favorites = Favorites;
  console.log('[favorites] Loaded');
})();