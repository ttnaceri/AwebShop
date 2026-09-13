// frontend/js/auth.js
// Session holatini boshqarish, himoyalangan sahifalarni qo'riqlash.

const Auth = {
  user: null,

  async load() {
    const t = API.getToken();
    if (!t) { this.user = null; return null; }
    const res = await API.me();
    if (res.success) {
      this.user = res.data.user;
      return this.user;
    }
    this.user = null;
    API.clearToken();
    return null;
  },

  isLoggedIn() {
    return !!this.user;
  },

  requireLogin(redirect = null) {
    if (!this.isLoggedIn()) {
      const target = redirect || (location.pathname.split('/').pop() || 'main.html');
      location.href = 'login.html?next=' + encodeURIComponent(target);
      return false;
    }
    return true;
  },

  async login(nickname, password) {
    const res = await API.login({ nickname, password });
    if (res.success) {
      API.setToken(res.data.token);
      this.user = res.data.user;
    }
    return res;
  },

  async logout() {
    try { await API.logout(); } catch (_) {}
    API.clearToken();
    this.user = null;
    location.href = 'main.html';
  }
};

window.Auth = Auth;