// bot/bot.js
// AWebShop Telegram Bot — long polling.
// Ishga tushirish:  node bot/bot.js
//
// Bot vazifalari:
//  - Registration verification code yuborish (backend orqali so'ralgan)
//  - Recovery code yuborish
//  - Notifications (login, payment, order, escrow, dispute, refund)
//  - Reply keyboard: Wallet / Profile / Support
//  - Force-subscribe tekshiruvi
//
// Bot backend bilan bir xil data/backend.json ni o'qiydi, LEKIN faqat
// O'QISH uchun. Yozish uchun bot backend bilan bir xil utils/db.js import qiladi
// va atomic write ishlatadi.

const path = require('path');
const fs = require('fs');
const config = require('../config');
const tg = require('./telegramService');
const db = require('../backend/utils/db');
const { verifyPassword, now } = require('../backend/utils/helpers');
const { hashPassword } = require('../backend/utils/helpers');

const STATE = {
  offset: 0,
  running: true,
  lastErrorAt: 0
};

// Foydalanuvchi sessiyasi (in-memory, bot uchun yetarli)
const sessions = new Map(); // telegramId -> { step, data }

// =========================================================
// START
// =========================================================
async function main() {
  if (!tg.enabled()) {
    console.error('❌ Telegram bot is disabled or botToken is a placeholder.');
    console.error('   → Set telegram.enabled=true and telegram.botToken in config.js');
    process.exit(1);
  }

  const me = await tg.getMe();
  if (!me.ok) {
    console.error('❌ Telegram getMe failed:', me);
    process.exit(1);
  }
  console.log(`✅ AWebShop bot started as @${me.result.username} (id ${me.result.id})`);
  console.log('   Polling for updates…');

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  loop();
}

function shutdown() {
  console.log('\n⏹  Stopping bot…');
  STATE.running = false;
}

async function loop() {
  while (STATE.running) {
    try {
      const res = await tg.getUpdates(STATE.offset, 30);
      if (res.ok && Array.isArray(res.result)) {
        for (const update of res.result) {
          STATE.offset = update.update_id + 1;
          handleUpdate(update).catch(err => console.error('update handler', err.message));
        }
      } else if (!res.ok && res.reason !== 'telegram_disabled') {
        // rate limit yoki tarmoq xatosi — bir oz kutamiz
        if (Date.now() - STATE.lastErrorAt > 3000) {
          console.error('⚠  getUpdates failed:', res.description || res.reason || 'unknown');
          STATE.lastErrorAt = Date.now();
        }
        await sleep(1500);
      }
    } catch (e) {
      console.error('poll error:', e.message);
      await sleep(2000);
    }
  }
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// =========================================================
// UPDATE ROUTER
// =========================================================
async function handleUpdate(update) {
  if (update.message) return handleMessage(update.message);
  if (update.callback_query) return handleCallback(update.callback_query);
}

// =========================================================
// MESSAGE HANDLER
// =========================================================
async function handleMessage(msg) {
  const chatId = msg.chat.id;
  const text = (msg.text || '').trim();
  const tgUser = msg.from || {};
  const telegramId = String(tgUser.id);
  const telegramUsername = tgUser.username ? '@' + tgUser.username : '';

  // /start
  if (text === '/start' || text.startsWith('/start ')) {
    return sendWelcome(chatId, telegramId, telegramUsername);
  }

  // /help
  if (text === '/help') {
    return sendReplyKeyboard(chatId, helpText(), mainKeyboard());
  }

  // /verify — kodni qayta yuborish uchun
  if (text === '/verify') {
    return sendReplyKeyboard(chatId, 'Open AWebShop registration page and press "Send code". The code will arrive here.', mainKeyboard());
  }

  // Reply keyboard tugmalari
  if (text === BTN.WALLET)   return sendWallet(chatId, telegramId);
  if (text === BTN.PROFILE)  return sendProfile(chatId, telegramId);
  if (text === BTN.SUPPORT)  return startSupport(chatId, telegramId);

  // Support rejimida bo'lsa
  const session = sessions.get(telegramId);
  if (session && session.step === 'support_message') {
    return submitSupport(chatId, telegramId, text, session);
  }

  // Noma'lum buyruq
  return sendReplyKeyboard(chatId, 'Unknown command. Use the buttons below or /help.', mainKeyboard());
}

// =========================================================
// CALLBACK HANDLER
// =========================================================
async function handleCallback(cq) {
  const chatId = cq.message.chat.id;
  const msgId = cq.message.message_id;
  const data = cq.data || '';
  const telegramId = String(cq.from.id);

  await tg.answerCallbackQuery(cq.id);

  if (data === 'open_wallet')   return sendWallet(chatId, telegramId);
  if (data === 'open_profile')  return sendProfile(chatId, telegramId);
  if (data === 'open_support')  return startSupport(chatId, telegramId);
  if (data === 'back_main')     return sendReplyKeyboard(chatId, 'Main menu', mainKeyboard());
  if (data.startsWith('fs_check_')) {
    const channelId = data.slice('fs_check_'.length);
    return checkForceSubscribe(chatId, telegramId, channelId);
  }
  return tg.editMessageText(chatId, msgId, 'Unknown action.');
}

// =========================================================
// UI: KEYBOARDS
// =========================================================
const BTN = {
  WALLET:  '💰 Wallet',
  PROFILE: '👤 Profile',
  SUPPORT: '🆘 Support'
};

function mainKeyboard() {
  return [
    [{ text: BTN.WALLET }, { text: BTN.PROFILE }],
    [{ text: BTN.SUPPORT }]
  ];
}

function walletInline() {
  return [[
    { text: '🔄 Refresh', callback_data: 'open_wallet' },
    { text: '👤 Profile', callback_data: 'open_profile' }
  ]];
}

function backInline() {
  return [[{ text: '← Main menu', callback_data: 'back_main' }]];
}

// =========================================================
// UI: WELCOME
// =========================================================
async function sendWelcome(chatId, telegramId, telegramUsername) {
  const data = db.readData();
  const user = data.users.find(u => u.telegramId === telegramId && !u.deleted);
  const greeting = user
    ? `Welcome back, <b>${escapeHtml(user.nickname)}</b>!`
    : `Welcome to <b>AWebShop</b>!`;

  const text =
    `${greeting}\n\n` +
    `This bot helps you:\n` +
    `• Receive registration & recovery codes\n` +
    `• Track your wallet and AWC balance\n` +
    `• Get notifications about orders, payments, escrow\n` +
    `• Contact support\n\n` +
    (user ? `Your AWC balance: <b>${fmtAWC(user.balanceAWC)}</b>` : `Not registered yet? Use the website to create an account.`);

  return tg.sendReplyKeyboard(chatId, text, mainKeyboard());
}

function helpText() {
  return (
    `<b>AWebShop Bot — Help</b>\n\n` +
    `<b>Buttons:</b>\n` +
    `• ${BTN.WALLET} — balance, top-up info\n` +
    `• ${BTN.PROFILE} — your account information\n` +
    `• ${BTN.SUPPORT} — send a message to support\n\n` +
    `<b>Commands:</b>\n` +
    `/start — main menu\n` +
    `/verify — info about verification code\n` +
    `/help — this help`
  );
}

// =========================================================
// FORCE SUBSCRIBE
// =========================================================
async function getActiveChannels() {
  const data = db.readData();
  return (data.forceSubscribeChannels || []).filter(c => c.status === 'active');
}

async function isSubscribedAll(telegramId) {
  const channels = await getActiveChannels();
  if (!channels.length) return { ok: true, missing: [] };

  const missing = [];
  for (const ch of channels) {
    const r = await tg.getChatMember(ch.channelId, telegramId);
    const status = r.ok ? r.result.status : 'left';
    if (!['member', 'administrator', 'creator'].includes(status)) {
      missing.push(ch);
    }
  }
  return { ok: missing.length === 0, missing };
}

async function sendForceSubscribe(chatId, missing) {
  const rows = missing.map(ch => ([{
    text: '📢 ' + ch.channelName,
    url: ch.channelLink
  }]));
  rows.push([{ text: '✅ I subscribed', callback_data: 'fs_check_' + missing[0].channelId }]);

  return tg.sendMessage(chatId,
    `🔒 <b>Please subscribe to our channels</b>\n\nTo continue, subscribe to the channels below, then press "I subscribed".`,
    { reply_markup: { inline_keyboard: rows } }
  );
}

async function checkForceSubscribe(chatId, telegramId) {
  const res = await isSubscribedAll(telegramId);
  if (res.ok) {
    return tg.sendMessage(chatId, '✅ Thanks! You can now continue.', { reply_markup: { inline_keyboard: backInline() } });
  }
  return sendForceSubscribe(chatId, res.missing);
}

// =========================================================
// WALLET
// =========================================================
async function sendWallet(chatId, telegramId) {
  const data = db.readData();
  const user = data.users.find(u => u.telegramId === telegramId && !u.deleted);
  if (!user) {
    return tg.sendReplyKeyboard(chatId,
      `You're not registered on AWebShop yet.\nRegister on the website to use the wallet.`,
      mainKeyboard()
    );
  }

  // Force-subscribe tekshiruvi (faqat faol kanallar bo'lsa)
  const sub = await isSubscribedAll(telegramId);
  if (!sub.ok) return sendForceSubscribe(chatId, sub.missing);

  const rate = data.settings?.awcPriceUZS || 10000;
  const usdRate = data.apiConfig?.exchangeRate?.lastRate || 12650;
  const balanceUZS = user.balanceAWC * rate;
  const balanceUSD = balanceUZS / usdRate;

  const activeCard = (data.paymentCards || []).find(c => c.status === 'active' && c.isDefault) ||
                     (data.paymentCards || []).find(c => c.status === 'active');

  const cardLine = activeCard
    ? `\n<b>Top-up card:</b>\n<code>${maskCard(activeCard.cardNumber)}</code>\nOwner: ${escapeHtml(activeCard.owner || '—')}${activeCard.bank ? ' • ' + escapeHtml(activeCard.bank) : ''}\n\nSend the payment, then submit the reference via the website → Wallet → Top up.`
    : `\nNo active top-up card configured yet. Please contact support.`;

  const text =
    `💰 <b>Your Wallet</b>\n\n` +
    `<b>Nickname:</b> ${escapeHtml(user.nickname)}\n` +
    `<b>WebShop ID:</b> <code>${escapeHtml(user.id)}</code>\n` +
    `<b>Telegram:</b> ${escapeHtml(user.telegramUsername || '—')}\n` +
    `<b>Phone:</b> ${escapeHtml(user.phone || '—')}\n\n` +
    `<b>AWC balance:</b> <b>${fmtAWC(user.balanceAWC)}</b>\n` +
    `≈ ${fmtUZS(balanceUZS)} • ${fmtUSD(balanceUSD)}\n` +
    `Rate: 1 AWC = ${fmtUZS(rate)}\n` +
    cardLine;

  return tg.sendMessage(chatId, text, { reply_markup: { inline_keyboard: walletInline() } });
}

// =========================================================
// PROFILE
// =========================================================
async function sendProfile(chatId, telegramId) {
  const data = db.readData();
  const user = data.users.find(u => u.telegramId === telegramId && !u.deleted);
  if (!user) {
    return tg.sendReplyKeyboard(chatId,
      `You're not registered on AWebShop yet.\nRegister on the website to create your profile.`,
      mainKeyboard()
    );
  }

  const sub = await isSubscribedAll(telegramId);
  if (!sub.ok) return sendForceSubscribe(chatId, sub.missing);

  const premium = data.premiumSubscriptions
    .filter(s => s.userId === user.id && s.status === 'active')
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0];

  const text =
    `👤 <b>Your Profile</b>\n\n` +
    `<b>Nickname:</b> ${escapeHtml(user.nickname)}\n` +
    `<b>WebShop ID:</b> <code>${escapeHtml(user.id)}</code>\n` +
    `<b>Phone:</b> ${escapeHtml(user.phone || '—')}\n` +
    `<b>Telegram ID:</b> <code>${escapeHtml(user.telegramId)}</code>\n` +
    `<b>Telegram username:</b> ${escapeHtml(user.telegramUsername || '—')}\n` +
    `<b>AWC balance:</b> ${fmtAWC(user.balanceAWC)}\n` +
    `<b>Verification:</b> ${user.verified ? '✅ Verified' : '⏳ Not verified'}\n` +
    `<b>Rating:</b> ⭐ ${(user.rating || 0).toFixed(1)}\n` +
    `<b>Joined:</b> ${new Date(user.createdAt).toLocaleDateString()}\n` +
    `<b>Premium:</b> ${premium ? escapeHtml(premium.plan) + ' (' + premium.status + ')' : '—'}\n`;

  return tg.sendMessage(chatId, text, { reply_markup: { inline_keyboard: [[
    { text: '💰 Wallet', callback_data: 'open_wallet' },
    { text: '🆘 Support', callback_data: 'open_support' }
  ]] } });
}

// =========================================================
// SUPPORT
// =========================================================
async function startSupport(chatId, telegramId) {
  sessions.set(telegramId, { step: 'support_message', data: {} });
  return tg.sendReplyKeyboard(chatId,
    `🆘 <b>Support</b>\n\nType your message below. It will be delivered to AWebShop admins.\nSend /cancel to cancel.`,
    [[{ text: '✖ Cancel' }]]
  );
}

async function submitSupport(chatId, telegramId, text, session) {
  if (text === '✖ Cancel' || text === '/cancel') {
    sessions.delete(telegramId);
    return tg.sendReplyKeyboard(chatId, 'Cancelled.', mainKeyboard());
  }

  const data = db.readData();
  const user = data.users.find(u => u.telegramId === telegramId && !u.deleted);

  db.update(d => {
    d.messages.push({
      id: 'msg_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      userId: user ? user.id : null,
      telegramId,
      nickname: user ? user.nickname : null,
      source: 'telegram',
      subject: 'Bot support message',
      body: String(text).slice(0, 4000),
      status: 'unread',
      createdAt: now(),
      updatedAt: now()
    });
    return d;
  });

  // Adminga xabar
  await tg.notifyAdmin(
    `🆘 <b>Support message</b>\n` +
    `From: ${user ? escapeHtml(user.nickname) + ' (id ' + escapeHtml(user.id) + ')' : 'TG ' + telegramId}\n` +
    `Telegram: ${escapeHtml(user?.telegramUsername || ('@' + telegramId))}\n\n` +
    `${escapeHtml(String(text).slice(0, 2000))}`
  );

  sessions.delete(telegramId);

  return tg.sendReplyKeyboard(chatId,
    '✅ Your message has been sent to support. We will reply soon.',
    mainKeyboard()
  );
}

// =========================================================
// NOTIFICATIONS API (backend chaqiradi)
// =========================================================
// Bu funksiyalar backend services/telegramService.js orqali emas, balki
// bot/telegramService.js orqali chaqiriladi. Backend ularni ishlatmaydi.
// Bu faylda biz ularni eksport qilamiz, chunki bot mustaqil ishlaydi.

// =========================================================
// HELPERS
// =========================================================
function escapeHtml(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
function maskCard(card) {
  if (!card) return '**** **** **** ****';
  const digits = String(card).replace(/\D/g, '');
  if (digits.length < 4) return '****';
  return '**** **** **** ' + digits.slice(-4);
}
function fmtAWC(n) {
  return Number(n || 0).toFixed(4).replace(/\.?0+$/, '') + ' AWC';
}
function fmtUZS(n) {
  return new Intl.NumberFormat('uz-UZ').format(Math.round(n || 0)) + " so'm";
}
function fmtUSD(n) {
  return '$' + Number(n || 0).toFixed(2);
}

// =========================================================
// BOOT
// =========================================================
if (require.main === module) {
  main().catch(err => {
    console.error('Fatal bot error:', err);
    process.exit(1);
  });
}

module.exports = { main };