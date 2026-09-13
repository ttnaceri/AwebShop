const { awc } = require('../../config');
const { readData, update } = require('../utils/db');
const { uniqueId } = require('../utils/idGenerator');
const { now } = require('../utils/helpers');

function getAwcUzsRate() {
  const data = readData();
  return data.settings?.awcPriceUZS || awc.priceUZS;
}

function getUsdRate() {
  const data = readData();
  return data.apiConfig?.exchangeRate?.lastRate || 12650;
}

function uzsToUsd(uzs) {
  return +(Number(uzs) / getUsdRate()).toFixed(4);
}

function usdToUzs(usd) {
  return Math.round(Number(usd) * getUsdRate());
}

function awcToUzs(awcAmount) {
  return Math.round(Number(awcAmount) * getAwcUzsRate());
}

function recordTransaction(userId, type, meta = {}) {
  return update(data => {
    const tx = {
      id: uniqueId('tx', data.transactions.map(t => t.id)),
      userId,
      type,
      amountAWC: meta.amountAWC || 0,
      amountUSD: meta.amountUSD || 0,
      amountUZS: meta.amountUZS || 0,
      status: meta.status || 'completed',
      paymentMethod: meta.paymentMethod || null,
      paymentDetailsReference: meta.paymentDetailsReference || null,
      description: meta.description || '',
      referenceId: meta.referenceId || null,
      adminNotes: '',
      createdAt: now(),
      updatedAt: now()
    };
    data.transactions.push(tx);
    return data;
  });
}

function adjustBalance(userId, deltaAWC) {
  return update(data => {
    const u = data.users.find(x => x.id === userId);
    if (!u) return data;
    u.balanceAWC = +(u.balanceAWC + deltaAWC).toFixed(4);
    u.updatedAt = now();
    return data;
  });
}

module.exports = {
  getAwcUzsRate,
  getUsdRate,
  uzsToUsd,
  usdToUzs,
  awcToUzs,
  recordTransaction,
  adjustBalance
};