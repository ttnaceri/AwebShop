// bot/telegramService.js
// Telegram Bot API uchun minimal klient. Faqat Node.js ning ichki modullari.
// Bu fayl backend server ham, bot ham bir xil ishlatishi mumkin.

const https = require('https');
const config = require('../config');

function enabled() {
  return config.telegram.enabled && !!config.telegram.botToken &&
    !config.telegram.botToken.includes('YOUR_');
}

function callTelegram(method, payload = {}) {
  if (!enabled()) {
    return Promise.resolve({ ok: false, reason: 'telegram_disabled' });
  }
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(payload);
    const req = https.request(
      {
        hostname: 'api.telegram.org',
        path: `/bot${config.telegram.botToken}/${method}`,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(body)
        }
      },
      res => {
        let chunks = '';
        res.on('data', c => (chunks += c));
        res.on('end', () => {
          try { resolve(JSON.parse(chunks)); }
          catch { resolve({ ok: false, raw: chunks }); }
        });
      }
    );
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

// ---- High-level helpers ----
function sendMessage(chatId, text, extra = {}) {
  return callTelegram('sendMessage', {
    chat_id: chatId,
    text,
    parse_mode: 'HTML',
    disable_web_page_preview: true,
    ...extra
  });
}

function sendReplyKeyboard(chatId, text, keyboard) {
  return sendMessage(chatId, text, {
    reply_markup: {
      keyboard,
      resize_keyboard: true,
      one_time_keyboard: false
    }
  });
}

function sendInlineKeyboard(chatId, text, inline_keyboard) {
  return sendMessage(chatId, text, { reply_markup: { inline_keyboard } });
}

function answerCallbackQuery(callbackQueryId, text = '', showAlert = false) {
  return callTelegram('answerCallbackQuery', {
    callback_query_id: callbackQueryId,
    text,
    show_alert: showAlert
  });
}

function editMessageText(chatId, messageId, text, inline_keyboard = null) {
  const payload = {
    chat_id: chatId,
    message_id: messageId,
    text,
    parse_mode: 'HTML',
    disable_web_page_preview: true
  };
  if (inline_keyboard) payload.reply_markup = { inline_keyboard };
  return callTelegram('editMessageText', payload);
}

function notifyUser(telegramId, text) {
  if (!telegramId) return Promise.resolve({ ok: false, reason: 'no_telegram_id' });
  return sendMessage(telegramId, text);
}

function notifyAdmin(text) {
  if (!config.telegram.adminChatId) return Promise.resolve({ ok: false, reason: 'no_admin_chat' });
  return sendMessage(config.telegram.adminChatId, text);
}

function getMe() {
  return callTelegram('getMe', {});
}

function getUpdates(offset = 0, timeout = 30) {
  return callTelegram('getUpdates', {
    offset,
    timeout,
    allowed_updates: ['message', 'callback_query']
  });
}

function getChatMember(chatId, userId) {
  return callTelegram('getChatMember', { chat_id: chatId, user_id: userId });
}

module.exports = {
  enabled,
  callTelegram,
  sendMessage,
  sendReplyKeyboard,
  sendInlineKeyboard,
  answerCallbackQuery,
  editMessageText,
  notifyUser,
  notifyAdmin,
  getMe,
  getUpdates,
  getChatMember
};