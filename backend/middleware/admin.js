const { readData } = require('../utils/db');
const { readToken, authRequired } = require('./auth');

const ROLE_LEVEL = { super_admin: 3, admin: 2, moderator: 1 };

function adminRequired(minRole = 'moderator') {
  return (req, res, next) => {
    authRequired(req, res, () => {
      const data = readData();
      const admin = data.admins.find(a => a.userId === req.user.userId && !a.disabled);
      if (!admin) {
        res.writeHead(403, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          success: false,
          message: 'Admin access required.',
          code: 'FORBIDDEN'
        }));
        return;
      }
      const need = ROLE_LEVEL[minRole] || 1;
      const have = ROLE_LEVEL[admin.role] || 0;
      if (have < need) {
        res.writeHead(403, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          success: false,
          message: 'Insufficient admin permissions.',
          code: 'FORBIDDEN'
        }));
        return;
      }
      req.admin = admin;
      next();
    });
  };
}

module.exports = { adminRequired, ROLE_LEVEL };