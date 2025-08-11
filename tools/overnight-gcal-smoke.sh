#!/usr/bin/env bash
set -euo pipefail

# Overnight loop: regenerate MD cases -> run render basic smoke -> collect logs & summaries

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
OUT_DIR="$ROOT_DIR/test-results/overnight"
mkdir -p "$OUT_DIR"

echo "[overnight] start at $(date -u +%FT%TZ)" | tee -a "$OUT_DIR/overnight.log"

iter=0
while true; do
  iter=$((iter+1))
  ts=$(date -u +%FT%TZ)
  echo "\n[overnight] ===== iteration $iter @ $ts =====" | tee -a "$OUT_DIR/overnight.log"

  # 1) regenerate tests from MD (best-effort)
  (cd "$ROOT_DIR" && node tools/internal/qa/generate-from-md.js) || true

  # 2) health checks
  (cd "$ROOT_DIR" && curl -sS https://course-mvp-beta.onrender.com/health/gcal || true) | tee "$OUT_DIR/${ts}-health-gcal.json" >/dev/null

  # 3) run render basic smoke (deployment + generated cases)
  (cd "$ROOT_DIR" && node tools/render-suite.js --basic) | tee "$OUT_DIR/${ts}-render-basic.log" || true

  # 4) export render logs for the last 15 minutes and generate summaries (best-effort)
  since_iso=$(date -u -v-15M +%FT%TZ 2>/dev/null || date -u --date='15 minutes ago' +%FT%TZ)
  (cd "$ROOT_DIR" && node tools/export-render-logs-range.js --since "$since_iso" --max-pages 80 --keywords "Google Calendar,已創建,OAuth2,準備建立事件,創建日曆" || true)
  (cd "$ROOT_DIR" && node tools/generate-trace-summaries.js --since "$since_iso" --max-pages 80 || true)

  # 5) compact status line for quick glance
  gcal_mode=$(jq -r '.authMode // empty' "$OUT_DIR/${ts}-health-gcal.json" 2>/dev/null || echo "")
  echo "[overnight] gcal=$gcal_mode done iteration $iter" | tee -a "$OUT_DIR/overnight.log"

  # Sleep 2 minutes
  sleep 120
done


