# AWebShop

Marketplace for buying and selling fully functional websites.

## Stack
- Vanilla HTML/CSS/JS frontend
- Vanilla Node.js backend
- Single JSON datastore: `data/backend.json`
- Telegram Bot for verification, recovery, notifications

## Setup
1. `cp config.example.js config.js` and fill in real values.
2. `npm start` (no external npm deps required — pure Node.js).
3. Backend runs at `http://localhost:3000`.

## Deployment
- Frontend: GitHub Pages (`/frontend`)
- Backend: any Node.js-compatible host (Render, Fly, Railway, VPS)
- API base URL is configured in `frontend/js/api.js`

## Notes
- No PostgreSQL, Redis, MongoDB, Docker, Prisma.
- Payments are manual (card) for now. Payme/Hamkorbank are placeholders.
- Exactly 4 Premium plans: Plus, Prime, Pro, Enterprise.

© 2026 UPDATE Inc. All Rights Reserved.