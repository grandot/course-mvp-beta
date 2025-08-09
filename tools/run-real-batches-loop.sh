#!/usr/bin/env bash

set -euo pipefail

# 固定環境變數（Mock GCal 真環境測試）
export TEST_USER_ID=${TEST_USER_ID:-U_test_user_qa}
export QA_FORCE_REAL=${QA_FORCE_REAL:-true}
export DISABLE_CONTEXT_AUTO_FILL=${DISABLE_CONTEXT_AUTO_FILL:-true}
export USE_MOCK_CALENDAR=${USE_MOCK_CALENDAR:-true}
export STRICT_RECORD_REQUIRES_COURSE=${STRICT_RECORD_REQUIRES_COURSE:-true}
export REAL_BATCH_PASS_THRESHOLD=${REAL_BATCH_PASS_THRESHOLD:-50}

LOG_FILE="$(cd "$(dirname "$0")"/..; pwd)/QA/reports/real-batches-latest.log"

# 建立報告目錄
mkdir -p "$(dirname "$LOG_FILE")"

echo "==== $(date '+%F %T %z') LOOP START ====" | tee -a "$LOG_FILE"

while true; do
  echo "==== $(date '+%F %T %z') START BATCH ====" | tee -a "$LOG_FILE"
  node "$(cd "$(dirname "$0")"; pwd)/test-real-batches.js" 2>&1 | tee -a "$LOG_FILE"
  echo "==== $(date '+%F %T %z') END BATCH ====" | tee -a "$LOG_FILE"
  # 間隔 1 分鐘再跑下一輪（提高 Render 日誌可見度）
  sleep 60
done


