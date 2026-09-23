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

  // Ban tekshiruvi
  try {
    const { readData } = require('../utils/db');
    const data = readData();
    const user = data.users.find(u => u.id === session.userId);

    if (user) {
      if (user.banned) {
        res.writeHead(403, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          success: false,
          message: 'Your account has been permanently banned.',
          code: 'ACCOUNT_BANNED'
        }));
        return;
      }
      if (user.blocked && user.blockedUntil) {
        if (new Date(user.blockedUntil) > new Date()) {
          res.writeHead(403, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            success: false,
            message: `Your account is temporarily blocked until ${new Date(user.blockedUntil).toLocaleString()}`,
            code: 'ACCOUNT_TEMP_BLOCKED',
            data: { blockedUntil: user.blockedUntil }
          }));
          return;
        } else {
          // Blok tugadi — tozalash
          const { update } = require('../utils/db');
          update(d => {
            const u = d.users.find(x => x.id === session.userId);
            if (u) {
              u.blocked = false;
              u.blockedUntil = null;
              u.moderationStrikes = { count: 0, until: null };
            }
            return d;
          });
        }
      }
    }
  } catch (_) {}

  req.user = session;
  next();
}