/**
 * DecisionLogger
 * 輕量級決策紀錄器（記憶體環形緩衝），提供 /debug/decision 查詢
 */

const MAX_ENTRIES = 200;
const logs = [];

function push(entry) {
  logs.push(entry);
  if (logs.length > MAX_ENTRIES) {
    logs.shift();
  }
}

function recordDecision(traceId, payload) {
  const entry = {
    traceId: String(traceId || ''),
    timestamp: new Date().toISOString(),
    ...payload,
  };
  push(entry);
  return true;
}

function getRecent(limit = 20) {
  const n = Math.max(1, Math.min(Number(limit) || 20, MAX_ENTRIES));
  return logs.slice(-n);
}

function getByTraceId(traceId) {
  const id = String(traceId || '');
  return logs.filter((l) => l.traceId === id);
}

module.exports = {
  recordDecision,
  getRecent,
  getByTraceId,
};
