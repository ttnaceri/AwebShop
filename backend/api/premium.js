const { readData, update } = require('../utils/db');
const { getUsdRate } = require('../services/tokenService');
const { uniqueId } = require('../utils/idGenerator');
const { now } = require('../utils/helpers');

function send(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(body));
}
function readBody(req) {
  return new Promise((resolve, reject) => {
    let chunks = '';
    req.on('data', c => (chunks += c));
    req.on('end', () => {
      try { resolve(chunks ? JSON.parse(chunks) : {}); } catch { reject(new Error('Invalid JSON')); }
    });
    req.on('error', reject);
  });
}

function plansWithUsd(plans) {
  const rate = getUsdRate();
  return plans.map(p => ({
    ...p,
    monthlyPriceUSD: +(p.monthlyPriceUZS / rate).toFixed(2),
    yearlyPriceUSD: +(p.yearlyPriceUZS / rate).toFixed(2)
  }));
}

async function plans(req, res) {
  const data = readData();
  send(res, 200, { success: true, data: { items: plansWithUsd(data.premiumPlans) } });
}

async function subscribe(req, res) {
  const body = await readBody(req);
  const { planId, billingPeriod = 'monthly' } = body;
  const data = readData();
  const plan = data.premiumPlans.find(p => p.id === planId && p.enabled);
  if (!plan) return send(res, 400, { success: false, message: 'Invalid plan.', code: 'INVALID_PLAN' });
  if (!['monthly', 'yearly'].includes(billingPeriod)) return send(res, 400, { success: false, message: 'Invalid billing period.', code: 'INVALID_PERIOD' });

  const price = billingPeriod === 'monthly' ? plan.monthlyPriceUZS : plan.yearlyPriceUZS;
  const endDate = new Date();
  if (billingPeriod === 'monthly') endDate.setMonth(endDate.getMonth() + 1);
  else endDate.setFullYear(endDate.getFullYear() + 1);

  let sub = null;
  await update(d => {
    sub = {
      id: uniqueId('sub', d.premiumSubscriptions.map(s => s.id)),
      userId: req.user.userId,
      plan: plan.name,
      planId: plan.id,
      billingPeriod,
      status: 'pending_payment',
      startDate: null,
      endDate: endDate.toISOString(),
      autoRenew: false,
      paymentMethod: 'manual_card',
      priceUZS: price,
      priceUSD: +(price / getUsdRate()).toFixed(2),
      trialUsed: false,
      trialStartDate: null,
      trialEndDate: null,
      createdAt: now(),
      updatedAt: now()
    };
    d.premiumSubscriptions.push(sub);
    return d;
  });

  send(res, 201, { success: true, data: { subscription: sub, message: 'Awaiting manual payment verification.' } });
}

async function status(req, res) {
  const data = readData();
  const sub = data.premiumSubscriptions
    .filter(s => s.userId === req.user.userId)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0] || null;
  send(res, 200, { success: true, data: { subscription: sub } });
}

async function cancel(req, res) {
  await update(d => {
    d.premiumSubscriptions
      .filter(s => s.userId === req.user.userId && s.status === 'active')
      .forEach(s => { s.status = 'cancelled'; s.autoRenew = false; s.updatedAt = now(); });
    return d;
  });
  send(res, 200, { success: true, data: { message: 'Cancelled.' } });
}

async function trial(req, res) {
  const data = readData();
  const already = data.premiumSubscriptions.some(s => s.userId === req.user.userId && s.trialUsed);
  if (already) return send(res, 400, { success: false, message: 'Trial already used.', code: 'TRIAL_USED' });

  const plan = data.premiumPlans.find(p => p.id === 'plan_plus');
  const end = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  let sub = null;
  await update(d => {
    sub = {
      id: uniqueId('sub', d.premiumSubscriptions.map(s => s.id)),
      userId: req.user.userId,
      plan: plan.name,
      planId: plan.id,
      billingPeriod: 'trial',
      status: 'active',
      startDate: now(),
      endDate: end.toISOString(),
      autoRenew: false,
      paymentMethod: null,
      trialUsed: true,
      trialStartDate: now(),
      trialEndDate: end.toISOString(),
      createdAt: now(),
      updatedAt: now()
    };
    d.premiumSubscriptions.push(sub);
    const u = d.users.find(x => x.id === req.user.userId);
    if (u) { u.premiumPlan = plan.name; u.premiumExpiresAt = sub.endDate; }
    return d;
  });
  send(res, 201, { success: true, data: { subscription: sub } });
}

module.exports = { plans, subscribe, status, cancel, trial };