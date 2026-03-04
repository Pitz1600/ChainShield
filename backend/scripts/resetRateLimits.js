/**
 * Reset rate limit counters (Redis-backed or in-memory).
 * For Redis, it deletes all rl:* keys. For memory store it no-ops.
 *
 * Usage:
 *   node backend/scripts/resetRateLimits.js
 */
const Redis = require('ioredis');

async function reset() {
  const url = process.env.REDIS_URL || 'redis://localhost:6379';
  const redis = new Redis(url, { lazyConnect: false });
  try {
    const keys = await redis.keys('rl:*');
    if (keys.length) {
      await redis.del(keys);
    }
    console.log(`Reset ${keys.length} rate-limit keys.`);
  } catch (err) {
    console.error('Failed to reset rate limits:', err.message);
  } finally {
    redis.disconnect();
  }
}

reset();
