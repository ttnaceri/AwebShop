const { verifySession } = require('../services/authService');

function readToken(req) {
  const auth = req.headers['authorization'];
  if (auth && auth.startsWith('Bearer ')) return auth.slice(7);
  const cookie = req.headers['cookie'] || '';
  const m = cookie.match(/(?:^|;\s*)aw_session=([^;]+)/);
  if (m) return decodeURIComponent(m[1]);
  return null;
}

function authRequired(req, res, next) {
  const token = readToken(req);
  const session = token ? verifySession(token) : null;
  if (!session) {
    res.writeHead(401, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      success: false,
      message: 'Authentication required.',
      code: 'UNAUTHORIZED'
    }));
    return;
  }
  req.user = session;
  next();
}

module.exports = { authRequired, readToken };