const https = require('https');
const { telegram } = require('../../config');

function sendMessage(chatId, text, options = {}) {
  if (!telegram.enabled || !telegram.botToken) {
    console.log('[telegram:disabled]', chatId, text);
    return Promise.resolve({ ok: false, reason: 'disabled' });
  }
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ chat_id: chatId, text, ...options });
    const req = https.request(
      {
        hostname: 'api.telegram.org',
        path: `/bot${telegram.botToken}/sendMessage`,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(body)
        }
      },
      res => {
        let data = '';
        res.on('data', c => (data += c));
        res.on('end', () => {
          try {
            resolve(JSON.parse(data));
          } catch {
            resolve({ ok: false });
          }
        });
      }
    );
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

function notifyUser(telegramId, text) {
  if (!telegramId) return Promise.resolve();
  return sendMessage(telegramId, text);
}

function notifyAdmin(text) {
  if (!telegram.adminChatId) return Promise.resolve();
  return sendMessage(telegram.adminChatId, text);
}

module.exports = { sendMessage, notifyUser, notifyAdmin };