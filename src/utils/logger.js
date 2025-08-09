/**
 * Lightweight JSON logger (single-line per event)
 * - No extra dependencies
 * - Always prints one-line JSON for reliable parsing in Render logs
 */

function nowIso() {
  return new Date().toISOString();
}

function print(level, payload) {
  const base = { ts: nowIso(), lvl: level };
  const out = JSON.stringify({ ...base, ...payload });
  // Ensure single line
  // eslint-disable-next-line no-console
  console.log(out);
}

function info(payload) { print('info', payload); }
function warn(payload) { print('warn', payload); }
function error(payload) { print('error', payload); }

function generateTraceId(prefix = 'trace') {
  const rnd = Math.random().toString(36).slice(2, 8);
  return `${prefix}_${Date.now()}_${rnd}`;
}

module.exports = {
  info,
  warn,
  error,
  generateTraceId,
};


