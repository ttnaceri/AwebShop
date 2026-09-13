// frontend/components/charts.js
// Lightweight canvas-based charts. No dependencies.

function lineChart(canvas, { labels = [], values = [], color = '#7b5cff' } = {}) {
  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  const w = canvas.clientWidth, h = canvas.clientHeight;
  canvas.width = w * dpr; canvas.height = h * dpr;
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, w, h);

  const pad = 24;
  const max = Math.max(1, ...values);
  const stepX = (w - pad * 2) / Math.max(1, values.length - 1);

  // axes
  ctx.strokeStyle = 'rgba(255,255,255,0.15)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(pad, h - pad);
  ctx.lineTo(w - pad, h - pad);
  ctx.stroke();

  // area
  if (values.length) {
    ctx.beginPath();
    values.forEach((v, i) => {
      const x = pad + i * stepX;
      const y = h - pad - (v / max) * (h - pad * 2);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.lineTo(w - pad, h - pad);
    ctx.lineTo(pad, h - pad);
    ctx.closePath();
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, color + '66');
    g.addColorStop(1, color + '00');
    ctx.fillStyle = g;
    ctx.fill();

    // line
    ctx.beginPath();
    values.forEach((v, i) => {
      const x = pad + i * stepX;
      const y = h - pad - (v / max) * (h - pad * 2);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.stroke();
  }
}

function barChart(canvas, { labels = [], values = [], color = '#22c55e' } = {}) {
  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  const w = canvas.clientWidth, h = canvas.clientHeight;
  canvas.width = w * dpr; canvas.height = h * dpr;
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, w, h);

  const pad = 24;
  const max = Math.max(1, ...values);
  const n = values.length || 1;
  const bw = (w - pad * 2) / n * 0.7;
  const gap = (w - pad * 2) / n * 0.3;

  values.forEach((v, i) => {
    const x = pad + i * (bw + gap) + gap / 2;
    const bh = (v / max) * (h - pad * 2);
    const y = h - pad - bh;
    ctx.fillStyle = color;
    ctx.fillRect(x, y, bw, bh);
  });

  ctx.strokeStyle = 'rgba(255,255,255,0.15)';
  ctx.beginPath();
  ctx.moveTo(pad, h - pad);
  ctx.lineTo(w - pad, h - pad);
  ctx.stroke();
}

window.lineChart = lineChart;
window.barChart = barChart;