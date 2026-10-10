# 🛒 AWebShop — Buy & Sell Websites Marketplace

> **A lightweight, production-ready marketplace for buying and selling fully functional websites.**  
> Escrow-protected Safe deals, direct Fast deals, AWC token economy, Telegram bot integration, and a full-featured Admin panel — all in one JSON-backed Node.js application.

![Status](https://img.shields.io/badge/status-active-brightgreen)
![Version](https://img.shields.io/badge/version-1.0.0-blue)
![License](https://img.shields.io/badge/license-MIT-green)
![Node](https://img.shields.io/badge/node-%3E%3D20-339933?logo=node.js&logoColor=white)
![Made with](https://img.shields.io/badge/made%20with-vanilla%20JS-f7df1e?logo=javascript&logoColor=black)
![Made in](https://img.shields.io/badge/made%20in-Uzbekistan-1EB53A?logo=flag&logoColor=white)

---

## 📑 Table of Contents

- [About](#-about)
- [Key Features](#-key-features)
- [Tech Stack](#-tech-stack)
- [Screenshots](#-screenshots)
- [Live Demo](#-live-demo)
- [Project Structure](#-project-structure)
- [Installation](#-installation)
- [Configuration](#-configuration)
- [Running the App](#-running-the-app)
- [API Endpoints](#-api-endpoints)
- [Data Model](#-data-model)
- [Premium Plans](#-premium-plans)
- [AWC Token](#-awc-token)
- [Escrow System](#-escrow-system)
- [Telegram Bot](#-telegram-bot)
- [Admin Panel](#-admin-panel)
- [Security](#-security)
- [Deployment](#-deployment)
- [Development Rules](#-development-rules)
- [Contributing](#-contributing)
- [License](#-license)
- [Credits](#-credits)

---

## 🎯 About

**AWebShop** — это легковесный, но полнофункциональный маркетплейс для покупки и продажи **готовых веб-сайтов**.

Проект создан для разработчиков и бизнеса, которые хотят:
- 🛍 **Покупать** работающие сайты
- 💰 **Продавать** свои проекты
- 🔐 Совершать безопасные сделки через **escrow**
- 🚀 Совершать быстрые сделки напрямую
- 🪙 Использовать внутренний токен **AWC** для всех транзакций

Платформа полностью автономна — используется **одна JSON-база данных** (`data/backend.json`) и **vanilla Node.js** без внешних зависимостей. Никаких PostgreSQL, Redis, Docker, MongoDB.

---

## ✨ Key Features

### Для пользователей
- 🔐 **Регистрация с Telegram-верификацией** (код приходит в бот)
- 🔑 **Вход по nickname + password**, восстановление через Telegram
- 🛒 **Магазин** — поиск, фильтры, сортировка, пагинация
- 💰 **Продажа сайтов** — Safe (escrow) или Fast (direct)
- 📥 **Загрузка изображений** (uploader + drag-drop)
- 💵 **Кошелёк AWC** — баланс, пополнение, переводы, вывод
- 💎 **4 Premium плана**: Plus, Prime, Pro, Enterprise
- 📊 **Дашборд профиля** — заказы, транзакции, сообщения, FAQ
- 🌙 **Dark / Light тема** + выбор языка (EN/UZ)
- 📱 **Mobile-first**: navbar на десктопе, tab bar на мобильных
- 💬 **Чат с продавцом** через Telegram (@username)
- 📨 **Уведомления** в Telegram для всех важных событий

### Для администраторов
- 🛡 **Полный Admin panel** (30+ страниц)
- 👥 **Управление пользователями** — бан/разбан, блокировка, badge
- 🌐 **Модерация сайтов** — approve, reject, delete
- 🔐 **Escrow управление** — статусы, споры, возврат
- 💸 **Withdrawals** — approve / reject
- 💳 **Payments** — ручная верификация карточных платежей
- 🎁 **Promocodes / Discounts** — CRUD + usage tracking
- 📅 **Events / Announcements** — ротация на главной
- 🏅 **Badges** — создание, редактирование, назначение
- 📊 **Analytics** — графики, revenue, активность
- 📋 **Admin Console** — терминал в стиле CMD (backtick)
- 🔒 **Role-based access**: SuperAdmin, Admin, Moderator
- 🗂 **Audit logs** — каждое действие админа записывается
- 💾 **Backup / Restore** — snapshot backend.json
- 📤 **Export / Import** — CSV, JSON
- 🚧 **Maintenance mode** — с whitelist
- 🚫 **Запрещённые Telegram ID** — чёрный список

### Для бота
- 🤖 **Reply keyboard**: Wallet, Profile, Support
- 💬 **Recovery / Verification коды** (copyable)
- 📣 **Force-subscribe** — проверка подписки на каналы
- 📨 **Уведомления** о входе, покупке, продаже, escrow, refund
- 🆘 **Support** — сообщение админам

---

## 🧰 Tech Stack

| Компонент | Технология |
|---|---|
| **Frontend** | HTML5, CSS3, Vanilla JavaScript (ES2020+) |
| **Backend** | Node.js (v20+), vanilla (no frameworks) |
| **Data storage** | Single JSON file (`data/backend.json`) |
| **Authentication** | Username/Password + HMAC-signed session tokens |
| **Password hashing** | PBKDF2-SHA512 (120 000 iterations, 16-byte salt) |
| **Telegram Bot** | Telegram Bot API (long polling) |
| **Payments** | Manual card payment (Payme/Hamkorbank — planned) |
| **Fonts** | Inter, Poppins |
| **Icons** | Font Awesome 6 Free (CDN) |
| **Analytics** | Google Analytics (optional) |

### Правила архитектуры
- ❌ **Нет** PostgreSQL, MySQL, MongoDB
- ❌ **Нет** Redis, Memcached
- ❌ **Нет** Prisma, Sequelize, TypeORM
- ❌ **Нет** Docker, Kubernetes
- ❌ **Нет** npm-пакетов (кроме самого Node.js)
- ❌ **Нет** React, Vue, Angular
- ❌ **Нет** build-системы (webpack, vite, rollup)

Всё — **чистый Node.js + браузер**.

---

## 📸 Screenshots

> Добавьте ваши скриншоты сюда. Примеры рекомендованных:

| Главная | Магазин |
|---|---|
| ![Main](docs/screenshots/main.png) | ![Store](docs/screenshots/store.png) |

| Детали сайта | Кошелёк |
|---|---|
| ![Detail](docs/screenshots/detail.png) | ![Wallet](docs/screenshots/wallet.png) |

| Admin Dashboard | Escrow |
|---|---|
| ![Admin](docs/screenshots/admin-dashboard.png) | ![Escrow](docs/screenshots/admin-escrow.png) |

| Telegram Bot | Admin Console |
|---|---|
| ![Bot](docs/screenshots/telegram-bot.png) | ![Console](docs/screenshots/admin-console.png) |

---

## 🌐 Live Demo

- **Frontend:** [https://aweb-shop.vercel.app](https://aweb-shop.vercel.app)
- **API Base:** `https://aweb-shop.vercel.app/api`
- **GitHub:** [https://github.com/ttnaceri/AwebShop](https://github.com/ttnaceri/AwebShop)

### Demo Accounts

| Роль | Nickname | Пароль |
|---|---|---|
| Super Admin | `superAdmin` | `Admin123!` |
| Admin | `Behruz` | `08022026` |
| Admin | `Bekhzod` | `08022026` |
| Admin | `Lutfulla` | `08022026` |
| Admin | `Shorahim` | `08022026` |
| Admin | `Mirolim` | `08022026` |
| User | `user007` | `87654321` |

> ⚠️ **Важно:** Смените все пароли в production.

