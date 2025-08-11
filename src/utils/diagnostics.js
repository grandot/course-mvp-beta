const crypto = require('crypto');

// 簡易環內記憶體環形緩衝，必要時可接 Redis
const MAX_ITEMS = parseInt(process.env.DIAG_MAX_ITEMS || '500', 10);
const ring = [];

function generateRequestId() {
  try {
    return crypto.randomBytes(8).toString('hex');
  } catch (_) {
    return String(Date.now());
  }
}

function initDiagnostics(messageSnippet = '') {
  return {
    id: generateRequestId(),
    env: process.env.NODE_ENV || 'development',
    nodeVersion: process.version,
    timestamp: new Date().toISOString(),
    message: typeof messageSnippet === 'string' ? messageSnippet.slice(0, 120) : '',
    executionPath: [],
    notes: {},
    finalIntent: null,
    error: null,
  };
}

function pushPath(diag, label) {
  if (!diag) return;
  try {
    diag.executionPath.push(label);
  } catch (_) {}
}

async function detectEnvironment() {
  const isProduction = process.env.NODE_ENV === 'production';
  let redisHealthy = false;
  try {
    const { getRedisService } = require('../services/redisService');
    const redis = getRedisService();
    if (redis && redis.client) {
      await redis.client.ping();
      redisHealthy = true;
    }
  } catch (_) {
    redisHealthy = false;
  }

  if (isProduction && !redisHealthy) return 'production-stateless';
  if (isProduction && process.version < 'v18.0.0') return 'production-legacy';
  if (isProduction) return 'production';
  return 'development';
}

function safeHasAny(msg, keywords, diag) {
  if (!Array.isArray(keywords)) return false;
  try {
    const result = keywords.some((k) => typeof k === 'string' && String(msg).includes(k));
    if (diag) {
      diag.notes.hasAny = diag.notes.hasAny || [];
      diag.notes.hasAny.push({ keywords, result });
    }
    return result;
  } catch (e) {
    if (diag) {
      diag.notes.hasAnyError = e?.message || String(e);
    }
    return false;
  }
}

function recordRegex(diag, name, pattern, input, matched) {
  if (!diag) return;
  try {
    diag.notes.regex = diag.notes.regex || [];
    diag.notes.regex.push({ name, pattern, matched: !!matched, sample: String(input).slice(0, 80) });
  } catch (_) {}
}

async function logDiagnostics(diag) {
  try {
    ring.push(diag);
    while (ring.length > MAX_ITEMS) ring.shift();
  } catch (_) {}

  // 可選：寫入 Redis 以跨實例觀察
  try {
    if (process.env.ENABLE_DIAGNOSTICS_REDIS === 'true') {
      const { getRedisService } = require('../services/redisService');
      const redis = getRedisService();
      if (redis && redis.client) {
        const key = `diag:${diag.id}`;
        await redis.set(key, JSON.stringify(diag), 60 * 60); // 1 小時 TTL
      }
    }
  } catch (_) {}
}

function getRecent(limit = 50) {
  const n = Math.max(1, Math.min(Number(limit) || 50, MAX_ITEMS));
  return ring.slice(Math.max(0, ring.length - n));
}

module.exports = {
  initDiagnostics,
  pushPath,
  detectEnvironment,
  safeHasAny,
  recordRegex,
  logDiagnostics,
  getRecent,
};


