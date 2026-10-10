// check-websites.js
// Websites holatini tekshirish + Store'da ko'rinmasligi sababini aniqlash.

'use strict';

const db = require('./backend/utils/db');

console.log('');
console.log('══════════════════════════════════════════');
console.log('  WEBSITES DIAGNOSTIKA');
console.log('══════════════════════════════════════════');
console.log('');

const d = db.readData();
const websites = d.websites || [];

console.log('📊 Jami websites:', websites.length);
console.log('');

if (!websites.length) {
  console.log('⚠️  Websites massivi BO\'SH!');
  console.log('');
  console.log('Yechim:');
  console.log('  1. Brauzerda Sell sahifasini oching:');
  console.log('     http://localhost:3000/frontend/pages/sell.html');
  console.log('  2. Yangi sayt qo\'shing');
  console.log('  3. Bu skriptni qayta ishga tushiring');
  console.log('');
  process.exit(0);
}

// Har bir website tahlili
websites.forEach((w, i) => {
  console.log('[' + (i + 1) + '] ' + (w.webId || '(webId yo\'q)'));
  console.log('    Name:      ' + (w.name || '(yo\'q)'));
  console.log('    Domain:    ' + (w.domain || '(yo\'q)'));
  console.log('    Type:      ' + (w.type || '(yo\'q)'));
  console.log('    Topic:     ' + (w.topic || '(yo\'q)'));
  console.log('    Sale Type: ' + (w.saleType || '(yo\'q)'));
  console.log('    Status:    ' + JSON.stringify(w.status));
  console.log('    Price:     ' + (w.priceUZS || 0) + ' UZS');
  console.log('    Views:     ' + (w.views || 0));
  console.log('    Created:   ' + (w.createdAt || '(yo\'q)'));
  console.log('    Sold:      ' + (w.soldAt || 'null'));
  console.log('');

  // Muammolarni aniqlash
  const issues = [];
  if (w.status !== 'active') issues.push('status: ' + w.status + ' → active');
  if (!w.saleType) issues.push('saleType bo\'sh');
  if (!w.type) issues.push('type bo\'sh');
  if (!w.priceUZS || w.priceUZS <= 0) issues.push('priceUZS noto\'g\'ri');
  if (!w.createdAt) issues.push('createdAt yo\'q');
  if (!w.webId) issues.push('webId yo\'q');
  if (!w.name) issues.push('name yo\'q');

  if (issues.length) {
    console.log('    ⚠️  MUAMMOLAR:');
    issues.forEach(x => console.log('       - ' + x));
  } else {
    console.log('    ✅ Yaxshi holat');
  }
  console.log('');
});

// Xulosa
const active = websites.filter(w => w.status === 'active');
const sold = websites.filter(w => w.status === 'sold');
const other = websites.filter(w => w.status !== 'active' && w.status !== 'sold');

console.log('══════════════════════════════════════════');
console.log('  XULOSA');
console.log('══════════════════════════════════════════');
console.log('');
console.log('  ✅ Active (ko\'rinadi): ' + active.length);
console.log('  🗑  Sold:               ' + sold.length);
console.log('  ⚠️  Other status:       ' + other.length);
console.log('');

if (active.length === 0 && websites.length > 0) {
  console.log('  ❌ HECH QANDAY ACTIVE WEBSITE YO\'Q!');
  console.log('');
  console.log('  Sabab: websites mavjud, lekin status "active" emas.');
  console.log('');
  console.log('  Yechim: "node fix-websites.js" ni ishga tushiring');
  console.log('');
}

// API test
console.log('══════════════════════════════════════════');
console.log('  API TEST');
console.log('══════════════════════════════════════════');
console.log('');

const http = require('http');
const req = http.get('http://localhost:3000/api/websites?page=1&perPage=30', function (res) {
  let body = '';
  res.on('data', function (c) { body += c; });
  res.on('end', function () {
    console.log('  Status:', res.statusCode);
    try {
      const j = JSON.parse(body);
      console.log('  success:', j.success);
      if (j.data) {
        console.log('  total:', j.data.total);
        console.log('  items:', (j.data.items || []).length);
        if (j.data.items && j.data.items.length) {
          console.log('');
          console.log('  API qaytargan websites:');
          j.data.items.forEach(function (w) {
            console.log('    - ' + w.webId + ' — ' + w.name);
          });
        }
      } else {
        console.log('  Javob:', JSON.stringify(j).slice(0, 300));
      }
    } catch (e) {
      console.log('  Xato: JSON parse');
      console.log('  Raw:', body.slice(0, 300));
    }
    console.log('');
  });
});

req.on('error', function (e) {
  console.log('  ❌ Backend ishlamayapti!');
  console.log('  Xato: ' + e.message);
  console.log('');
  console.log('  Yechim: node backend/server.js');
  console.log('');
});