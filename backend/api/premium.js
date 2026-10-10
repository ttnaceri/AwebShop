// backend/api/premium.js
// Premium plans: AWC narxlari bilan.

'use strict';

const { readData, update } = require('../utils/db');
const { uniqueId } = require('../utils/idGenerator');
const { now } = require('../utils/helpers');

function send(res, status, body) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS'
  });
  res.end(JSON.stringify(body));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let chunks = '';
    req.on('data', c => (chunks += c));
    req.on('end', () => {
      try { resolve(chunks ? JSON.parse(chunks) : {}); } catch (e) { reject(e); }
    });
    req.on('error', reject);
  });
}

function getAwcRate() {
  try {
    const d = readData();
    return (d.settings && d.settings.awcPriceUZS) || 10000;
  } catch (_) { return 10000; }
}

function getUsdRate() {
  try {
    const d = readData();
    return (d.apiConfig && d.apiConfig.exchangeRate && d.apiConfig.exchangeRate.lastRate) || 12650;
  } catch (_) { return 12650; }
}

function plansWithDerived(plans) {
  const usdRate = getUsdRate();
  const awcRate = getAwcRate();

  return plans.map(p => {
    const monthlyAWC = p.monthlyPriceAWC != null
      ? p.monthlyPriceAWC
      : +(p.monthlyPriceUZS / awcRate).toFixed(2);
    const yearlyAWC = p.yearlyPriceAWC != null
      ? p.yearlyPriceAWC
      : +(p.yearlyPriceUZS / awcRate).toFixed(2);

    return {
      ...p,
      monthlyPriceAWC: monthlyAWC,
      yearlyPriceAWC: yearlyAWC,
      monthlyPriceUSD: +(p.monthlyPriceUZS / usdRate).toFixed(2),
      yearlyPriceUSD: +(p.yearlyPriceUZS / usdRate).toFixed(2)
    };
  });
}

// ============================================================
// PUBLIC: PLANS LIST
// ============================================================
async function plans(req, res) {
  try {
    const data = readData();
    const items = plansWithDerived(data.premiumPlans || []);
    send(res, 200, { success: true, data: { items } });
  } catch (e) {
    console.error('[premium:plans]', e.message);
    send(res, 500, { success: false, message: 'Failed.', code: 'PLANS_ERROR' });
  }
}

// ============================================================
// SUBSCRIBE
// ============================================================
async function subscribe(req, res) {
  try {
    const body = await readBody(req);
    const { planId, billingPeriod } = body;
    const period = ['monthly', 'yearly'].includes(billingPeriod) ? billingPeriod : 'monthly';

    const data = readData();
    const plan = (data.premiumPlans || []).find(p => p.id === planId && p.enabled);

    if (!plan) {
      return send(res, 400, { success: false, message: 'Invalid plan.', code: 'INVALID_PLAN' });
    }

    const awcRate = getAwcRate();
    const usdRate = getUsdRate();

    const priceUZS = period === 'monthly' ? plan.monthlyPriceUZS : plan.yearlyPriceUZS;
    const priceAWC = period === 'monthly'
      ? (plan.monthlyPriceAWC != null ? plan.monthlyPriceAWC : +(priceUZS / awcRate).toFixed(2))
      : (plan.yearlyPriceAWC != null ? plan.yearlyPriceAWC : +(priceUZS / awcRate).toFixed(2));
    const priceUSD = +(priceUZS / usdRate).toFixed(2);

    const user = data.users.find(u => u.id === req.user.userId);
    if (!user) {
      return send(res, 404, { success: false, message: 'User not found.', code: 'NOT_FOUND' });
    }

    // AWC balans tekshiruvi
    if (user.balanceAWC < priceAWC) {
      return send(res, 400, {
        success: false,
        message: `Insufficient AWC. Required: ${priceAWC} AWC, you have: ${user.balanceAWC} AWC.`,
        code: 'INSUFFICIENT_AWC',
        data: { required: priceAWC, available: user.balanceAWC }
      });
    }

    // End date
    const endDate = new Date();
    if (period === 'monthly') endDate.setMonth(endDate.getMonth() + 1);
    else endDate.setFullYear(endDate.getFullYear() + 1);

    // Subscription yaratish + AWC yechish (atomar)
    let sub = null;

    await update(d => {
      if (!Array.isArray(d.premiumSubscriptions)) d.premiumSubscriptions = [];
      if (!Array.isArray(d.transactions)) d.transactions = [];

      const subId = uniqueId('sub', d.premiumSubscriptions.map(s => s.id));

      sub = {
        id: subId,
        userId: req.user.userId,
        planId: plan.id,
        plan: plan.name,
        billingPeriod: period,
        status: 'active',
        startDate: now(),
        endDate: endDate.toISOString(),
        autoRenew: false,
        paymentMethod: 'AWC',
        priceUZS,
        priceAWC,
        priceUSD,
        trialUsed: false,
        createdAt: now(),
        updatedAt: now()
      };

      d.premiumSubscriptions.push(sub);

      // User AWC yechish
      const u = d.users.find(x => x.id === req.user.userId);
      if (u) {
        u.balanceAWC = +(u.balanceAWC - priceAWC).toFixed(4);
        u.premiumPlan = plan.name;
        u.premiumExpiresAt = sub.endDate;
        u.updatedAt = now();
      }

      // Transaction
      d.transactions.push({
        id: 'tx_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
        userId: req.user.userId,
        type: 'premium_subscription',
        amountAWC: -priceAWC,
        amountUZS: -priceUZS,
        amountUSD: -priceUSD,
        status: 'completed',
        description: `${plan.name} (${period}) subscription`,
        referenceId: subId,
        paymentMethod: 'AWC',
        adminNotes: '',
        createdAt: now(),
        updatedAt: now()
      });

      return d;
    });

    console.log(`[premium:subscribe] ✅ ${user.nickname} → ${plan.name} (${period}) — ${priceAWC} AWC`);

    send(res, 201, {
      success: true,
      data: {
        subscription: sub,
        newBalance: (user.balanceAWC - priceAWC).toFixed(4)
      }
    });
  } catch (e) {
    console.error('[premium:subscribe]', e.stack || e.message);
    send(res, 500, { success: false, message: 'Failed.', code: 'SUBSCRIBE_ERROR' });
  }
}

// ============================================================
// STATUS
// ============================================================
async function status(req, res) {
  try {
    const data = readData();
    const sub = (data.premiumSubscriptions || [])
      .filter(s => s.userId === req.user.userId)
      .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))[0] || null;

    send(res, 200, { success: true, data: { subscription: sub } });
  } catch (e) {
    send(res, 500, { success: false, message: 'Failed.', code: 'STATUS_ERROR' });
  }
}

// ============================================================
// CANCEL
// ============================================================
async function cancel(req, res) {
  try {
    await update(d => {
      (d.premiumSubscriptions || [])
        .filter(s => s.userId === req.user.userId && s.status === 'active')
        .forEach(s => {
          s.status = 'cancelled';
          s.autoRenew = false;
          s.updatedAt = now();
        });
      const u = d.users.find(x => x.id === req.user.userId);
      if (u) {
        u.premiumPlan = null;
        u.premiumExpiresAt = null;
        u.updatedAt = now();
      }
      return d;
    });
    send(res, 200, { success: true, data: { message: 'Subscription cancelled.' } });
  } catch (e) {
    send(res, 500, { success: false, message: 'Failed.', code: 'CANCEL_ERROR' });
  }
}

// ============================================================
// TRIAL
// ============================================================
async function trial(req, res) {
  try {
    const data = readData();
    const already = (data.premiumSubscriptions || [])
      .some(s => s.userId === req.user.userId && s.trialUsed);

    if (already) {
      return send(res, 400, { success: false, message: 'Trial already used.', code: 'TRIAL_USED' });
    }

    const plan = (data.premiumPlans || []).find(p => p.id === 'plan_plus');
    if (!plan) {
      return send(res, 500, { success: false, message: 'Plan not found.', code: 'NO_PLAN' });
    }

    const end = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    let sub = null;

    await update(d => {
      if (!Array.isArray(d.premiumSubscriptions)) d.premiumSubscriptions = [];

      sub = {
        id: uniqueId('sub', d.premiumSubscriptions.map(s => s.id)),
        userId: req.user.userId,
        planId: plan.id,
        plan: plan.name,
        billingPeriod: 'trial',
        status: 'active',
        startDate: now(),
        endDate: end.toISOString(),
        autoRenew: false,
        paymentMethod: null,
        priceUZS: 0,
        priceAWC: 0,
        priceUSD: 0,
        trialUsed: true,
        trialStartDate: now(),
        trialEndDate: end.toISOString(),
        createdAt: now(),
        updatedAt: now()
      };

      d.premiumSubscriptions.push(sub);

      const u = d.users.find(x => x.id === req.user.userId);
      if (u) {
        u.premiumPlan = plan.name;
        u.premiumExpiresAt = sub.endDate;
        u.updatedAt = now();
      }

      return d;
    });

    send(res, 201, { success: true, data: { subscription: sub } });
  } catch (e) {
    send(res, 500, { success: false, message: 'Failed.', code: 'TRIAL_ERROR' });
  }
}

module.exports = { plans, subscribe, status, cancel, trial };