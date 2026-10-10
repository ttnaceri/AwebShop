// backend/services/telegramService.js
// AWebShop — Telegram Bot API (backend notifications).
// MUHIM: parse_mode HAR DOIM 'HTML' bo'lishi shart.

'use strict';

const https = require('https');
const config = require('../../config');

// ============================================================
// ENABLED CHECK
// ============================================================
function enabled() {
  return !!(
    config.telegram &&
    config.telegram.enabled &&
    config.telegram.botToken &&
    !config.telegram.botToken.includes('YOUR_')
  );
}

// ============================================================
// LOW-LEVEL: Telegram API chaqiruv
// ============================================================
function callTelegram(method, payload) {
  if (!enabled()) {
    console.log('[telegram:disabled]', method, JSON.stringify(payload).slice(0, 200));
    return Promise.resolve({ ok: false, reason: 'telegram_disabled' });
  }

  return new Promise(function (resolve, reject) {
    const body = JSON.stringify(payload || {});

    console.log('[telegram:call] method=' + method +
      ' parse_mode=' + (payload && payload.parse_mode ? payload.parse_mode : '(yo\'q)') +
      ' chat_id=' + (payload && payload.chat_id));

    const req = https.request({
      hostname: 'api.telegram.org',
      path: '/bot' + config.telegram.botToken + '/' + method,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body)
      }
    }, function (res) {
      let data = '';
      res.on('data', function (c) { data += c; });
      res.on('end', function () {
        try {
          const parsed = JSON.parse(data);
          if (!parsed.ok) {
            console.error('[telegram:error]', method, parsed.description || JSON.stringify(parsed));
          } else {
            console.log('[telegram:ok]', method, 'chat_id=' + (payload && payload.chat_id));
          }
          resolve(parsed);
        } catch (e) {
          console.error('[telegram:parse]', data.slice(0, 200));
          resolve({ ok: false, raw: data });
        }
      });
    });

    req.on('error', function (e) {
      console.error('[telegram:network]', e.message);
      reject(e);
    });

    req.write(body);
    req.end();
  });
}

// ============================================================
// HIGH-LEVEL: sendMessage — PARSE_MODE MAJBURIY
// ============================================================
function sendMessage(chatId, text, extra) {
  // Asosiy payload — parse_mode HAR DOIM HTML
  const payload = {
    chat_id: chatId,
    text: String(text || ''),
    parse_mode: 'HTML',
    disable_web_page_preview: true
  };

  // Qo'shimcha parametrlarni qo'shish
  // (extra.parse_mode bo'lsa, uni ALMASHTIRMAYMIZ, chunki asosiy HTML)
  if (extra && typeof extra === 'object') {
    Object.keys(extra).forEach(function (k) {
      if (k !== 'parse_mode') {
        // parse_mode dan tashqari barcha kalitlarni qo'shamiz
        payload[k] = extra[k];
      }
    });
  }

  return callTelegram('sendMessage', payload);
}

// ============================================================
// CONVENIENCE
// ============================================================
function notifyUser(telegramId, text) {
  if (!telegramId) {
    console.warn('[telegram:notifyUser] telegramId yo\'q');
    return Promise.resolve({ ok: false, reason: 'no_telegram_id' });
  }
  return sendMessage(telegramId, text);
}

function notifyAdmin(text) {
  if (!config.telegram || !config.telegram.adminChatId) {
    console.warn('[telegram:notifyAdmin] adminChatId yo\'q');
    return Promise.resolve({ ok: false, reason: 'no_admin_chat' });
  }
  return sendMessage(config.telegram.adminChatId, text);
}

// ============================================================
// EXPORTS
// ============================================================
module.exports = {
  enabled: enabled,
  callTelegram: callTelegram,
  sendMessage: sendMessage,
  notifyUser: notifyUser,
  notifyAdmin: notifyAdmin
};