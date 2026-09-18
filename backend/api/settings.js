// backend/api/settings.js
// Public settings — autentifikatsiyasiz ochiq.

'use strict';

const { readData } = require('../utils/db');

function send(res, status, body) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*'
  });
  res.end(JSON.stringify(body));
}

function publicSettings(req, res) {
  try {
    const d = readData();
    const s = d.settings || {};
    send(res, 200, {
      success: true,
      data: {
        siteName: s.siteName || 'AWebShop',
        awcPriceUZS: s.awcPriceUZS || 10000,
        listingFeeUZS: s.listingFeeUZS || 10000,
        saleCommissionPercent: s.saleCommissionPercent || 5,
        escrowFeePercent: s.escrowFeePercent || 0.4,
        topics: s.topics || ['AI', 'Online Shop', '3D Game', 'Other'],
        social: s.social || {}
      }
    });
  } catch (e) {
    console.error('[settings:public]', e.message);
    send(res, 200, {
      success: true,
      data: {
        siteName: 'AWebShop',
        awcPriceUZS: 10000,
        listingFeeUZS: 10000,
        topics: ['AI', 'Online Shop', '3D Game', 'Other']
      }
    });
  }
}

module.exports = { publicSettings };