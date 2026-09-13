const { security } = require('../../config');

const buckets = new Map(); // ip -> { count, resetAt }

function rateLimiter(req, res, next) {
  const ip = req.socket.remoteAddress || 'unknown';
  const now = Date.now();
  let bucket = buckets.get(ip);

  if (!bucket || bucket.resetAt < now) {
    bucket = { count: 0, resetAt: now + security.rateLimitWindowMs };
    buckets.set(ip, bucket);
  }

  bucket.count += 1;

  if (bucket.count > security.rateLimitMaxRequests) {
    res.writeHead(429, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      success: false,
      message: 'Too many requests. Please slow down.',
      code: 'RATE_LIMITED'
    }));
    return;
  }
  next();
}

module.exports = { rateLimiter };