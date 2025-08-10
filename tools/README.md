## tools/ 工具總覽與擴充指南

這份文件提供一個「可擴充」的結構，用來說明 `tools/` 目錄下所有工具的用途與使用方式。未來新增新工具時，請沿用同一份模板，讓內容保持一致、好維護。

---

### 目錄
- 一、快速開始（給趕時間的人）
- 二、共用前置條件
- 三、工具清單（依模板撰寫）
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
