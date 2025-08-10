#!/usr/bin/env node

/**
 * Generate trace summaries (inbound -> processing -> outbound) from Render logs
 * - Pulls logs via Render CLI with JSON output
 * - Parses our single-line JSON payload embedded in entry.message
 * - Groups by traceId and emits a markdown summary
 *
 * Usage examples:
 *   node tools/generate-trace-summaries.js --since "2025-08-09T13:00:00Z" --userId U_xxx
 *   node tools/generate-trace-summaries.js --since "2025-08-09T13:00:00Z" --max-pages 80
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const SERVICE_ID = 'srv-d21f9u15pdvs73frvns0';
const OUT_DIR = path.resolve(__dirname, '../test-results/render-logs');

function parseArgs() {
  const args = process.argv.slice(2);
  const opts = {
    since: null,
    until: null,
    userId: null,
    maxPages: 60,
    quiet: false,
  };
  for (let i = 0; i < args.length; i += 1) {
    const a = args[i];
    if (a === '--since') opts.since = args[++i];
    else if (a === '--until') opts.until = args[++i];
    else if (a === '--userId') opts.userId = args[++i];
    else if (a === '--max-pages') opts.maxPages = parseInt(args[++i], 10) || 60;
    else if (a === '--quiet') opts.quiet = true;
  }
  if (!opts.since) {
    const d = new Date(Date.now() - 30 * 60 * 1000);
    opts.since = d.toISOString();
  }
  return opts;
}

function fetchPage(startISO, untilISO) {
  const parts = [
    'render logs',
    `-r ${SERVICE_ID}`,
    '--limit 100',
    '-o json',
    `--start "${startISO}"`,
    '--direction forward',
  ];
  if (untilISO) parts.push(`--end "${untilISO}"`);
  const cmd = parts.join(' ');
  const out = execSync(cmd, { encoding: 'utf8', timeout: 120000, maxBuffer: 30 * 1024 * 1024 });
  return out;
}

function tryParseJsonLine(line) {
  try {
    return JSON.parse(line);
  } catch (_) {
    return null;
  }
}

function tryParsePayloadFromMessage(msg) {
  if (!msg) return null;
  const trimmed = msg.trim();
  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    try { return JSON.parse(trimmed); } catch (_) { return null; }
  }
  // Best-effort extraction: find first JSON object substring
  const start = msg.indexOf('{');
  const end = msg.lastIndexOf('}');
  if (start >= 0 && end > start) {
    const sub = msg.slice(start, end + 1);
    try { return JSON.parse(sub); } catch (_) { /* ignore */ }
  }
  return null;
}

function summarize() {
  const opts = parseArgs();
  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

  const groups = new Map(); // traceId -> { userId, items: [] }

  let startISO = opts.since;
  let pages = 0;
  while (pages < opts.maxPages) {
    pages += 1;
    if (!opts.quiet) console.log(`📥 Page ${pages} from ${startISO}`);

    let pageText = '';
    try {
      pageText = fetchPage(startISO, opts.until);
    } catch (e) {
      console.warn('⚠️ fetch error, continue:', e.message);
      break;
    }

    const lines = pageText.split('\n').filter(l => l.trim());
    if (lines.length === 0) break;

    let newestTs = null;

    for (const line of lines) {
      const entry = tryParseJsonLine(line);
      if (!entry) continue;
      const ts = entry.timestamp || entry.ts || null;
      if (ts) newestTs = ts;

      const payload = tryParsePayloadFromMessage(entry.message);
      if (!payload || !payload.traceId) continue;
      if (opts.userId && payload.userId !== opts.userId) continue;

      if (!groups.has(payload.traceId)) {
        groups.set(payload.traceId, { userId: payload.userId || null, items: [] });
      }
      groups.get(payload.traceId).items.push({ ts: ts || payload.ts, ...payload });
    }

    if (!newestTs) break;
    const next = new Date(new Date(newestTs).getTime() + 1).toISOString();
    startISO = next;
    if (opts.until && new Date(startISO) >= new Date(opts.until)) break;
  }

  // Emit markdown summary
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const outPath = path.join(OUT_DIR, `trace-summary-${stamp}.md`);
  const linesOut = [];
  linesOut.push(`# Trace Summaries (${stamp})`);
  linesOut.push('');

  const sortedTraces = Array.from(groups.entries())
    .sort((a, b) => (a[1].items[0]?.ts || '').localeCompare(b[1].items[0]?.ts || ''));

  for (const [traceId, data] of sortedTraces) {
    const items = data.items.sort((a, b) => (a.ts || '').localeCompare(b.ts || ''));
    const inbound = items.find(x => x.direction === 'inbound');
    const outbound = items.find(x => x.direction === 'outbound');
    const nlp = items.find(x => x.stage === 'nlp');
    const slots = items.find(x => x.stage === 'slots');
    const task = items.find(x => x.stage === 'task');

    linesOut.push(`## ${traceId}`);
    linesOut.push(`- userId: ${data.userId || '(unknown)'}`);
    if (inbound) linesOut.push(`- inbound: ${inbound.textIn || ''}`);
    if (nlp) linesOut.push(`- intent: ${nlp.intent || ''}`);
    if (slots) linesOut.push(`- slots: ${(Array.isArray(slots.slotsSummary) ? slots.slotsSummary.join(',') : '')}`);
    if (task) linesOut.push(`- task: success=${task.success} code=${task.code || ''} latencyMs=${task.latencyMs || ''}`);
    if (outbound) linesOut.push(`- outbound: ${outbound.textOut || ''}`);
    linesOut.push('');
  }

  fs.writeFileSync(outPath, linesOut.join('\n'));
  console.log(`\n✅ Summary written: ${outPath}`);
}

if (require.main === module) {
  summarize();
}

module.exports = { summarize };


