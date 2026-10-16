const rateLimit = require('express-rate-limit');

function createTemplateDownloadLimiter(store, overrides = {}) {
  return rateLimit({
    windowMs: 10 * 60 * 1000,
    limit: 5,
    ...(store ? { store } : {}),
    keyGenerator: req => String(req.user._id || req.user.id),
    standardHeaders: true,
    legacyHeaders: false,
    handler(req, res) {
      const retryAfterSeconds = Math.max(1, Math.ceil(((req.rateLimit?.resetTime?.getTime() || Date.now() + 600000) - Date.now()) / 1000));
      res.set('Retry-After', String(retryAfterSeconds));
      res.status(429).json({ error: 'Too many template downloads. Please wait before trying again.', retryAfterSeconds });
    },
    ...overrides,
  });
}
module.exports = { createTemplateDownloadLimiter };
