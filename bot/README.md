# AWebShop Telegram Bot

Minimal Node.js Telegram bot. No external packages. Uses Telegram Bot API long polling.

## Setup

1. Create a bot via [@BotFather](https://t.me/BotFather), copy the token.
2. In `config.js` set:
   ```js
   telegram: {
     enabled: true,
     botToken: 'YOUR_REAL_BOT_TOKEN',
     botUsername: 'YourBotUsername',
     adminChatId: 'YOUR_ADMIN_CHAT_ID',
     codeTtlMs: 1000 * 60 * 10
   }