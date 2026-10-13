// frontend/js/auth-ext.js
// AwebShop — Foydalanuvchi autentifikatsiyasi (external backend + localStorage).

(function () {
  'use strict';

  var USER_KEY = 'aw_ext_user';

  var AuthExt = {
    getUser: function () {
      try {
        var raw = localStorage.getItem(USER_KEY);
        return raw ? JSON.parse(raw) : null;
      } catch (_) { return null; }
    },

    setUser: function (user) {
      try { localStorage.setItem(USER_KEY, JSON.stringify(user)); }
      catch (_) {}
    },

    logout: function () {
      try { localStorage.removeItem(USER_KEY); }
      catch (_) {}
    },

    isLoggedIn: function () {
      return !!this.getUser();
    },

    // ============================================
    // REGISTER
    // ============================================
    register: async function (payload) {
      if (!window.BackendAPI) {
        return { success: false, message: 'BackendAPI yuklanmagan.' };
      }
      // Validatsiya
      if (!payload.nickname || payload.nickname.length < 3) {
        return { success: false, message: 'Nickname 3+ belgi.' };
      }
      if (!payload.password || payload.password.length < 8) {
        return { success: false, message: 'Parol 8+ belgi.' };
      }

      // Mavjudligini tekshirish
      var found = await window.BackendAPI.findUserByNickname(payload.nickname);
      if (found && found.success && Array.isArray(found.data) && found.data.length > 0) {
        return { success: false, message: 'Bu nickname band.' };
      }

      var res = await window.BackendAPI.registerUser({
        nickname: payload.nickname,
        password: payload.password,
        phone: payload.phone || '',
        telegramUsername: payload.telegramUsername || '',
        telegramId: payload.telegramId || '',
        createdAt: new Date().toISOString()
      });

      if (res && res.success) {
        var user = {
          nickname: payload.nickname,
          id: (res.data && res.data.id) || ('u_' + Date.now()),
          createdAt: new Date().toISOString()
        };
        this.setUser(user);
        return { success: true, user: user };
      }
      return { success: false, message: (res && res.message) || 'Xatolik.' };
    },

    // ============================================
    // LOGIN
    // ============================================
    login: async function (nickname, password) {
      if (!window.BackendAPI) {
        return { success: false, message: 'BackendAPI yuklanmagan.' };
      }
      var found = await window.BackendAPI.findUserByNickname(nickname);
      if (!found || !found.success) {
        return { success: false, message: 'Backend xatosi.' };
      }
      var list = Array.isArray(found.data) ? found.data : (found.data && found.data.items) || [];
      var user = list.find(function (u) { return u.nickname === nickname; });
      if (!user) {
        return { success: false, message: 'Foydalanuvchi topilmadi.' };
      }
      if (user.password !== password) {
        return { success: false, message: 'Parol xato.' };
      }
      this.setUser({
        nickname: user.nickname,
        id: user.id,
        createdAt: user.createdAt
      });
      return { success: true, user: this.getUser() };
    }
  };

  window.AuthExt = AuthExt;
  console.log('[auth-ext] Loaded');
})();