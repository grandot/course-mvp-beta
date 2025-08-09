#!/usr/bin/env node

/**
 * Export Render logs over a time range with pagination (overcomes --limit 100)
 * - Uses forward pagination via --start and the last entry timestamp
 * - Supports keyword filters (comma-separated)
 * - Saves both raw NDJSON and filtered text summary
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const RENDER_CONFIG = {
  SERVICE_ID: 'srv-d21f9u15pdvs73frvns0',
  LOG_DIR: path.resolve(__dirname, '../test-results/render-logs'),
  PAGE_LIMIT: 100,
};

function parseArgs() {
  const args = process.argv.slice(2);
  const opts = {
    since: null,
    until: null,
    keywords: [],
    maxPages: 50,
    quiet: false,
  };
  for (let i = 0; i < args.length; i += 1) {
    const a = args[i];
    if (a === '--since') opts.since = args[++i];
    else if (a === '--until') opts.until = args[++i];
    else if (a === '--keywords') opts.keywords = (args[++i] || '').split(',').map(s => s.trim()).filter(Boolean);
    else if (a === '--max-pages') opts.maxPages = parseInt(args[++i], 10) || 50;
    else if (a === '--quiet') opts.quiet = true;
  }
  if (!opts.since) {
    const d = new Date(Date.now() - 60 * 60 * 1000); // default last 60m
    opts.since = d.toISOString();
  }
  return opts;
}

function toISOFromText(tsText) {
  // Render text timestamps look like: 2025-08-09 13:13:14
  // Ensure we return ISO Z
  if (!tsText) return null;
  if (tsText.includes('T')) return tsText; // already ISO-like
  return tsText.replace(' ', 'T') + 'Z';
}

function runRenderLogs({ startISO, untilISO }) {
  const parts = [
    'render logs',
    `-r ${RENDER_CONFIG.SERVICE_ID}`,
    `--limit ${RENDER_CONFIG.PAGE_LIMIT}`,
    '-o text',
    `--start "${startISO}"`,
    '--direction forward',
  ];
  if (untilISO) parts.push(`--end "${untilISO}"`);
  const cmd = parts.join(' ');
  const out = execSync(cmd, { encoding: 'utf8', timeout: 120000, maxBuffer: 20 * 1024 * 1024 });
  return out;
}

function main() {
  const opts = parseArgs();

  if (!fs.existsSync(RENDER_CONFIG.LOG_DIR)) {
    fs.mkdirSync(RENDER_CONFIG.LOG_DIR, { recursive: true });
  }

  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const rawPath = path.join(RENDER_CONFIG.LOG_DIR, `render-range-${stamp}.ndjson`);
  const filteredPath = path.join(RENDER_CONFIG.LOG_DIR, `render-range-filtered-${stamp}.log`);

  let startISO = opts.since;
  const endISO = opts.until || null;
  let pages = 0;
  let totalKept = 0;
  let lastSeenISO = null;

  fs.writeFileSync(rawPath, '');
  fs.writeFileSync(filteredPath, '');

  while (pages < opts.maxPages) {
    pages += 1;
    if (!opts.quiet) console.log(`📥 Page ${pages} from ${startISO}${endISO ? ` to ${endISO}` : ''}`);
    let chunk;
    try {
      chunk = runRenderLogs({ startISO, untilISO: endISO });
    } catch (e) {
      console.error('❌ Render logs fetch failed:', e.message);
      break;
    }
    const lines = chunk.split('\n').filter(l => l.trim().length > 0);
    if (lines.length === 0) {
      if (!opts.quiet) console.log('ℹ️ No more logs.');
      break;
    }
    // Append raw
    fs.appendFileSync(rawPath, lines.join('\n') + '\n');

    // Process and filter
    let newestTs = null;
    for (const line of lines) {
      // timestamp at line start, e.g., 2025-08-09 13:13:14
      const tsMatch = line.match(/^(\d{4}-\d{2}-\d{2})\s+(\d{2}:\d{2}:\d{2})/);
      if (tsMatch) {
        const z = `${tsMatch[1]}T${tsMatch[2]}Z`;
        newestTs = z;
        lastSeenISO = z;
      }
      if (opts.keywords.length === 0 || opts.keywords.some(k => line.includes(k))) {
        fs.appendFileSync(filteredPath, line + '\n');
        totalKept += 1;
      }
    }

    // Advance start to just after newest timestamp to avoid duplicates
    if (newestTs) {
      const t = new Date(newestTs);
      const next = new Date(t.getTime() + 1);
      startISO = next.toISOString();
    } else {
      break; // nothing parsable
    }

    // Safety: if start surpasses end, stop
    if (endISO && new Date(startISO) >= new Date(endISO)) break;
  }

  console.log(`\n✅ Completed. Raw NDJSON: ${rawPath}`);
  console.log(`✅ Filtered: ${filteredPath} (kept ${totalKept} lines)`);
}

if (require.main === module) {
  main();
}

module.exports = { main };


