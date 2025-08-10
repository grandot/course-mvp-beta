const { execFile } = require('node:child_process');

function hasFlag(argv, name) {
  return argv.some((arg) => arg === name || arg.startsWith(`${name}=`));
}

function buildArgs() {
  const passthrough = process.argv.slice(2);
  const args = [];

  if (!hasFlag(passthrough, '--since')) {
    const since = new Date(Date.now() - 15 * 60 * 1000).toISOString();
    args.push('--since', since);
  }
  if (!hasFlag(passthrough, '--max-pages')) {
    args.push('--max-pages', '80');
  }

  return [...args, ...passthrough];
}

function main() {
  const nodeBin = process.execPath;
  const script = 'tools/generate-trace-summaries.js';
  const args = [script, ...buildArgs()];

  console.log('Running:', ['node', ...args].join(' '));

  const child = execFile(nodeBin, args, { encoding: 'utf8' }, (err, stdout, stderr) => {
    if (err) {
      console.error('[save-context] Failed:', err.message);
      if (stderr) console.error(stderr);
      process.exitCode = err.code || 1;
      return;
    }

    if (stdout) process.stdout.write(stdout);

    const match = stdout.match(/Summary\s+written:\s+(.*)/i);
    if (match && match[1]) {
      const outPath = match[1].trim();
      console.log(`[save-context] 已輸出檔案：${outPath}`);
    } else {
      console.log('[save-context] 已完成，但未偵測到輸出檔案路徑。請檢查上方輸出訊息。');
    }
  });

  child.on('spawn', () => {
    // no-op
  });
}

main();
