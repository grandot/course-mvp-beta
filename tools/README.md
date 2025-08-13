## tools/ 使用手冊（統一入口版）

本手冊說明 `tools/` 目錄的最新結構與使用方式。為了降低心智負擔，我們已將零散測試腳本「整合為 6 個入口」，其餘子測試與輔助腳本已歸檔到分層目錄，保持根層乾淨可讀。

---

### 目錄導覽（你只需要記住這 6 個入口）

- Render 套件：`tools/render-suite.js`
- Redis 套件：`tools/redis-suite.js`
- 多輪對話套件：`tools/multi-turn-suite.js`
- 時間與重複規則套件：`tools/time-and-recurring-suite.js`
- 回歸與風險套件：`tools/regression-suite.js`
- 快速冒煙/端到端：`tools/quick-suite.js`

輔助工具（保留）
- 日誌擷取：`tools/export-render-logs-range.js`
- 回合摘要：`tools/generate-trace-summaries.js`
- 一鍵摘要：`tools/save-context.js`

分層目錄（不用直接執行）
- 子測試腳本：`tools/suites/<suite>/cases/*`
- 研發/維運輔助：`tools/internal/*`（admin/debug/logs/qa 分類）

---

### 快速開始（建議指令）

```bash
# Render 測試（部署健檢/冷啟動/Redis/併發）
node tools/render-suite.js --basic
node tools/render-suite.js --all         # 含 multi/persistence 等延伸

# Redis 測試（連線/設定/效能/整合）
node tools/redis-suite.js --conn --config   # 預設
node tools/redis-suite.js --perf
node tools/redis-suite.js --render

# 多輪/補問
node tools/multi-turn-suite.js --supplement  # 預設
node tools/multi-turn-suite.js --render

# 時間與重複規則
node tools/time-and-recurring-suite.js --parser --daily  # 預設
node tools/time-and-recurring-suite.js --format

# 回歸與風險
node tools/regression-suite.js --risk
node tools/regression-suite.js --fix "quick reply"
node tools/regression-suite.js --all

# 快速冒煙/端到端
node tools/quick-suite.js --target prod      # 5 cases（線上）
node tools/quick-suite.js --target local     # 5 cases（本地）
node tools/quick-suite.js --target prod --e2e

# 線上日誌與摘要
node tools/export-render-logs-range.js \
  --since "$(date -u -v -15M +%Y-%m-%dT%H:%M:%SZ)" \
  --max-pages 80 --keywords "traceId,userId,channel,line"
node tools/generate-trace-summaries.js \
  --since "$(date -u -v -15M +%Y-%m-%dT%H:%M:%SZ)" --max-pages 80
```

---

### 什麼時候用哪個套件？（最短決策）

- 我只想看部署好不好：用 `render-suite.js --basic`
- 我懷疑 Redis 有問題：用 `redis-suite.js --conn --config`，要看效能加 `--perf`
- 我要驗證多輪補問：用 `multi-turn-suite.js --supplement`
- 我覺得時間解析/重複課有 bug：用 `time-and-recurring-suite.js --parser` 或 `--daily`
- 我要回歸與風險清單：用 `regression-suite.js --risk` / `--all`
- 我要 5 個冒煙用例或端到端：`quick-suite.js --target prod|local [--e2e]`

---

### 常用旗標（共通心智模型）

- `--basic`：只跑基礎健檢（Render 套件）
- `--all`：該類套件能跑的通通跑
- `--conn / --config / --perf / --render`：Redis 套件的子測試選擇
- `--supplement / --render`：多輪套件的子測試選擇
- `--parser / --format / --daily`：時間套件的子測試選擇
- `--risk / --fix <tag>`：回歸/風險套件
- `--target local|prod`：快速套件（冒煙/端到端）目標環境

---

### 注意事項（避免踩雷）

- `test-line-bot-automation.js` 已移至 `tools/suites/misc/`，請勿直打線上 webhook 當作 E2E。
  - 若未經 LINE 平台且使用假 replyToken，LINE 回覆會失敗，伺服器端常見 500。
  - 建議：用 `render-suite.js` 做線上健檢；對話類請改走真實 LINE 或改為 Mock。
- 舊的 `test-*.js` 已分流到 `suites/*/cases` 或 `suites/misc`，入口統一由 6 個 *-suite.js 管理。
- 研發/維運輔助腳本（索引檢查、除錯、長迴圈批次等）已移至 `tools/internal/*`，不要誤當正式測試入口。

---

### 舊版到新版的對應（遷移備忘）

- `test-render-*` → `render-suite.js`（子測試見 `suites/render/cases`）
- `test-redis-*`/`redis-performance-test.js` → `redis-suite.js`（見 `suites/redis/cases`）
- `test-multi-turn-*`/`test-supplement-input.js` → `multi-turn-suite.js`（見 `suites/multi-turn/cases`）
- `test-time-*`/`test-daily-recurring.js` → `time-and-recurring-suite.js`（見 `suites/time/cases`）
- `regression-test.js`/`test-all-risks.js`/`test-fix-verification.js` → `regression-suite.js`
- `test-5-cases*.js`/`test-full-workflow.js` → `quick-suite.js`（見 `suites/quick/cases`）

---

### FAQ（你可能會碰到的問題）

- 為什麼我直打 webhook 會 500？
  - 因為沒有經 LINE 平台、replyToken 不合法，真正的回覆 API 會失敗。請用 `render-suite.js` 健檢或走 LINE 官方對話。
- Render 日誌抓不到？
  - CLI 偶發節流，縮小時間窗或降低頁數；或先把 NDJSON 存檔再生成摘要。
- 我要把腳本再精簡？
  - 新案例直接放 `suites/<suite>/cases`，入口不用改；不建議再回到根層新增 `test-*.js`。

---

### 貢獻與規範（簡版）

- 新的測試案例：請放到 `tools/suites/<suite>/cases/`，並在對應 `*-suite.js` 加一個旗標分支
- 命名統一：`test-<領域>-<主題>.js`，避免縮寫
- 請在案例檔案開頭用 5~10 行說明「測什麼、為何需要」，讓 PM 也看得懂

## tools/ 工具總覽與擴充指南

這份文件提供一個「可擴充」的結構，用來說明 `tools/` 目錄下所有工具的用途與使用方式。未來新增新工具時，請沿用同一份模板，讓內容保持一致、好維護。

---

### 目錄
- 一、快速開始（給趕時間的人）
- 二、共用前置條件
- 三、工具清單（依模板撰寫）
  - 3.0 測試套件統一入口（新增）
  - 3.1 export-render-logs-range.js（Render 日誌分頁擷取）
  - 3.2 generate-trace-summaries.js（互動回合摘要）
  - 3.3 save-context.js（一鍵生成摘要）
- 四、輸出與命名規則
- 五、常見問題（FAQ）
- 六、工具說明模板（新增工具請複製此段）
- 七、附註與建議

---

### 一、快速開始（給趕時間的人）

```bash
# Render 測試（統一入口）
node tools/render-suite.js --basic        # 健檢（健康/冷啟動/Redis/併發）
node tools/render-suite.js --all          # 含 multi/persistence/api/deps

# Redis 測試（統一入口）
node tools/redis-suite.js --conn --config # 連線+設定（預設）
node tools/redis-suite.js --perf          # 效能
node tools/redis-suite.js --render        # 與 Render 整合

# 多輪測試（統一入口）
node tools/multi-turn-suite.js --supplement  # 補問/槽位補齊（預設）
node tools/multi-turn-suite.js --render      # Render 多輪

# 時間與重複規則（統一入口）
node tools/time-and-recurring-suite.js --parser --daily  # 預設
node tools/time-and-recurring-suite.js --format          # 格式修正

# 回歸與風險
node tools/regression-suite.js --risk
node tools/regression-suite.js --fix "quick reply"
node tools/regression-suite.js --all

# 快速冒煙/端到端
node tools/quick-suite.js --target prod      # 5 cases（線上）
node tools/quick-suite.js --target local     # 5 cases（本地）
node tools/quick-suite.js --target prod --e2e

# 近 15 分鐘抓取線上日誌（含常見關鍵詞）
node tools/export-render-logs-range.js \
  --since "$(date -u -v -15M +%Y-%m-%dT%H:%M:%SZ)" \
  --max-pages 80 \
  --keywords "traceId,userId,channel,line"

# 近 15 分鐘產生互動回合摘要（未先 export 也可）
node tools/generate-trace-summaries.js \
  --since "$(date -u -v -15M +%Y-%m-%dT%H:%M:%SZ)" \
  --max-pages 80

# 或者，一鍵生成摘要（預設近 15 分鐘）
npm run save:context
```

---

### 二、共用前置條件
- 已安裝並登入 Render CLI（未登入請執行：`render auth login`）。
- 線上服務已部署可用；腳本已內建服務資源設定，無需手動指定。

---

### 三、工具清單（依模板撰寫）

#### 3.0 測試套件統一入口（新增）
- render-suite.js：Render 部署健檢與延伸測試（health/cold-start/redis/concurrency/api/persistence/multi）
- redis-suite.js：Redis 相關測試（conn/config/perf/render）
- multi-turn-suite.js：多輪與補問測試（supplement/render）
- time-and-recurring-suite.js：時間解析/格式修正/每日重複
- regression-suite.js：回歸/風險/修復驗證
- quick-suite.js：5-case 冒煙與端到端切換（local/prod）

#### 3.1 export-render-logs-range.js（Render 日誌分頁擷取）
- 功能定位：
  - 分頁抓取 Render 日誌，避開單次 100 筆限制；可輸出原始 NDJSON 與依關鍵詞過濾的純文字檔。
- 適用情境：
  - 需要「較長時間窗」或「大量」日誌做歸檔、後處理與分析時。
- 主要輸出（預設路徑 `test-results/render-logs/`）：
  - `render-range-<timestamp>.ndjson`（原始 NDJSON）
  - `render-range-filtered-<timestamp>.log`（按關鍵詞過濾的純文字）
- 參數：
  - `--since <ISO>` 起始時間（預設：近 60 分鐘）
  - `--until <ISO>` 結束時間（選填）
  - `--keywords <a,b,c>` 關鍵詞，逗號分隔（選填）
  - `--max-pages <N>` 最大頁數（每頁約 100 筆；建議 50~120 視需要）
- 指令範例：
```bash
node tools/export-render-logs-range.js \
  --since "$(date -u -v -15M +%Y-%m-%dT%H:%M:%SZ)" \
  --max-pages 80 \
  --keywords "traceId,userId,channel,line"
```
- 相關/相依：可搭配 `generate-trace-summaries.js` 將 NDJSON 轉為人類可讀的摘要。

#### 3.2 generate-trace-summaries.js（互動回合摘要）
- 功能定位：
  - 依 `traceId` 分組，輸出每回合 inbound → processing（intent/slots/task）→ outbound 的 Markdown 摘要。
- 適用情境：
  - PM/開發快速檢視某段時間內的對話回合與系統決策過程。
- 主要輸出（預設路徑 `test-results/render-logs/`）：
  - `trace-summary-<timestamp>.md`
- 參數：
  - `--since <ISO>` 起始時間（預設：近 30 分鐘）
  - `--until <ISO>` 結束時間（選填）
  - `--userId <ID>` 僅匯出特定使用者（選填）
  - `--max-pages <N>` 最大頁數（預設 60）
- 指令範例：
```bash
# 近 15 分鐘回合摘要
node tools/generate-trace-summaries.js \
  --since "$(date -u -15M +%Y-%m-%dT%H:%M:%SZ)" \
  --max-pages 80

# 只看特定 userId 的回合
node tools/generate-trace-summaries.js \
  --since "2025-08-09T13:00:00Z" \
  --userId Uxxxxxxxxxxxxxxxxxxxx \
  --max-pages 80
```
- 相關/相依：若未先執行 `export-render-logs-range.js`，本工具也會自行抓取所需日誌。

#### 3.3 save-context.js（一鍵生成摘要）
- 功能定位：
  - 一鍵執行回合摘要生成，預設近 15 分鐘與 `--max-pages 80`，並在完成時回傳實際輸出檔案路徑。
- 適用情境：
  - 想快速說「/save-context」就得到最新摘要文檔的場景。
- 使用方式：
  - npm 指令：`npm run save:context`
  - 或直接執行：`node tools/save-context.js [--since <ISO>] [--until <ISO>] [--max-pages <N>] [--userId <ID>]`
- 參數：
  - 與 `generate-trace-summaries.js` 相同；未指定時使用預設值。
- 相關/相依：
  - 內部呼叫 `generate-trace-summaries.js`。

---

### 四、輸出與命名規則
- 所有輸出存於 `test-results/render-logs/`。
- 檔名包含時間戳，便於版本化與歸檔。

---

### 五、常見問題（FAQ）
- Render CLI 回傳 `unknown error` / `ETIMEDOUT`？
  - 屬於偶發節流/連線問題。請縮小時間窗、降低頁數或稍後重試。
- 沒抓到我剛剛的訊息？
  - 確認最新程式已部署且訊息有到 webhook。可放大 `--max-pages` 或加長 `--since` 的時間範圍。
- 需要 CSV？
  - 目前產出 Markdown 與 NDJSON；可後續替 `generate-trace-summaries.js` 增加 `--format csv`。

---

### 六、工具說明模板（新增工具請複製此段）

請以此模板新增新工具章節，置於「三、工具清單」內，以數字順序遞增。

```markdown
#### X.Y <檔名>.js（<一句話功能定位>）
- 功能定位：
  - <簡述要解決的問題/目標>
- 適用情境：
  - <何時應該用它>
- 主要輸出（預設路徑 <相對路徑>）：
  - <檔名或格式說明>
- 參數：
  - `--foo <type>` 說明
  - `--bar <type>` 說明
- 指令範例：
```bash
node tools/<檔名>.js --foo ... --bar ...
```
- 相關/相依：<可與哪些工具搭配、或依賴哪些設定>
```

---

### 七、附註與建議
- 我們在伺服器端使用「單行 JSON（NDJSON）」結構化日誌，欄位包含：`userId`、`traceId`、`direction`、`channel`、`textIn`/`textOut`、`intent`、`slots`、`status`、`latencyMs` 等。
- 若臨時需要「幫忙抓一下」：
```bash
node tools/export-render-logs-range.js --since "$(date -u -v -15M +%Y-%m-%dT%H:%M:%SZ)" --max-pages 80 --keywords "traceId,userId"
node tools/generate-trace-summaries.js --since "$(date -u -v -15M +%Y-%m-%dT%H:%M:%SZ)" --max-pages 80
```

---

## Trello 同步工具（新增）

> 用來把 `PROJECT_STATUS.md` 與 Trello 看板做雙向同步；支援 push、pull 預覽、pull 寫回、列表篩選、dry-run、（可選）標籤自動化，以及 Webhook 事件收集。

### 環境變數
```env
TRELLO_KEY=
TRELLO_TOKEN=
TRELLO_BOARD_ID=
# optional for webhook（要從 Trello 即時回流才需要）
TRELLO_APP_SECRET=
TRELLO_WEBHOOK_PORT=4300
TRELLO_WEBHOOK_CALLBACK_URL=
# optional：自動將 `[P1][Feature]` 這類標籤同步成 Trello 標籤
ENABLE_TRELLO_LABELS=false
```

### 指令
```bash
# 推送 PROJECT_STATUS.md → Trello（會自動建立 Backlog/Next/Doing/Blocked/Done 列表）
./bin/trello:push

# 從 Trello 拉回五個列表並直接寫回 PROJECT_STATUS.md（無預覽）
./bin/trello:pull

# 進階旗標（搭配 trello:push 使用）
#   --dry-run               只顯示即將動作
#   --lists=Backlog,Next    只同步指定列表
#   --purge                 推送前刪除目標列表所有卡（非封存，保留列表）
#   --purge-concurrency=12  刪卡並行度（1~16，預設 8）
#   --labels                啟用標籤自動化（或用 .env 的 ENABLE_TRELLO_LABELS=true）
node tools/trello-sync/trello-sync.js --dry-run --lists=Backlog,Next --labels

# Webhook（可選，需公網 URL）
node tools/trello-sync/trello-webhook-server.js     # 啟動本地 Webhook 伺服器（預設 :4300/trello/webhook）
node tools/trello-sync/register-trello-webhook.js   # 註冊 Webhook 到 Trello（需 TRELLO_WEBHOOK_CALLBACK_URL）
```

### 同步規則（重要）
- 唯一識別（UID）：Description 首行 `uid:xxxxxxxx`，支援 8 或 12 碼；MD 每條目尾保留 `[uid:xxxxxxxx]`。
- 描述表頭（頂部維護）：
  1) `uid:<8或12位hex>`
  2) `source: PROJECT_STATUS.md | manual`
  3) `syncedAt:<ISO>`
  4) `ref: spec/...`（若 MD 條目含「｜規格: ...」會自動帶入）
- 標題以 MD 為準（同步時會更新 Trello 卡片標題；會移除技術性標記如 `[uid:...]`）。
- 拉回（pull）時：直接用 Trello 卡名覆寫 `PROJECT_STATUS.md` 的五個區塊（請先確認不要保留本地修改）。

### 去重與移動
- 去重：
  - 指令：`node tools/trello-sync.js --merge-duplicates --lists=Doing`（可指定多個列表）。
  - 規則：同一 UID 的卡視為重複；保留最早活動時間的卡為主卡，合併其餘描述與標籤後封存重複卡。
- 自動移動列表：
  - 推送時若找到既有卡片但在錯誤列表，會自動移動到目標列表（例如把完成項從 Doing 移到 Done）。

### 小提示
- `Done` 預設僅同步最近 5 筆（專案面板有保留完整歷史）。
- 若卡名尾註不同（例如加了規格連結/狀態字樣），系統仍會依 UID 視為同一張卡，不會重複建立。

### 常見問題
- 401 invalid key：Token 與 Key 不成對，請用 `https://trello.com/1/authorize?...&key=YOUR_KEY` 重新產生 token。
- 400 invalid idBoard：`TRELLO_BOARD_ID` 若填 shortLink，建列表會被拒；腳本已自動轉為長 ID。
- 429：稍候再試或降低同步頻率；腳本已有輕量節流，可依需要加大等待時間。

### 設計筆記
- 主從與衝突：第一版採「單向推」為主，pull 預覽不改檔；若要雙向自動 merge，建議加 `config/trello-sync-map.json` 以 cardId 為準，或使用 Custom Fields 存 `syncId`。
- 標籤：會解析卡名開頭的 `[P1][Feature]` 類型標籤；啟用後自動建立 Trello 標籤並綁定到卡片。
- Webhook：伺服器會把事件以 NDJSON 寫到 `reports/trello-webhook-events.ndjson`，之後可加上差異報告與自動回寫。
