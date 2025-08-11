## AI Fallback 整合方案（意圖＋槽位｜正式上線版）

### 目標
- 讓模糊語句也能被正確理解（使用者「說人話」即可）
- 僅在不明確或規則低信心時啟用 AI，控制成本與延遲
- 保留強保護：提醒/取消/明確新增不被 AI 誤改

### 範圍與變更
- 意圖解析（新增 AI fallback 與模糊判定）
  - 檔案：`src/intent/parseIntent.js`
  - 行為：
    - 規則無命中、問句但無強特徵、或新增與查詢同時命中視為「模糊」→ 呼叫 `openaiService.identifyIntent()`
    - 信心度（預設 0.7）達標才採用 AI 結果；否則回退規則
    - 強保護：
      - 含「提醒」→ `set_reminder`
      - 含「取消/刪除」→ `cancel_course`
      - 「要上/安排 + 時間詞」→ `add_course`

- 槽位抽取（規則先行，AI 補齊缺欄位）
  - 檔案：`src/intent/extractSlots.js`
  - 行為：規則抽不到的欄位再調 `openaiService.extractEntities()` 合併；保留本地驗證與清理

- Webhook 保險絲（立即見效）
  - 檔案：`src/bot/webhook.js`
  - 行為：問句 + 查詢關鍵詞（課表/有什麼課/今天/明天/這週/查詢/看一下/課程安排）→ 最終覆寫為 `query_schedule`（除非同時命中新增/提醒/取消）

- 任務前置校驗（避免 AI 判對卻走錯流程）
  - 記錄內容：`src/tasks/handle_record_content_task.js` 預設嚴格模式（找不到課程 → `NOT_FOUND`）
  - 設定提醒：`src/tasks/handle_set_reminder_task.js` 找不到課程 → `NOT_FOUND`
  - 取消/修改：`handle_cancel_course_task.js` 保留範圍選項；`handle_modify_course_task.js` 先回「功能開發中 / `NOT_MODIFIABLE_NO_CONTEXT`」

### 環境變數（Render）
- `ENABLE_AI_FALLBACK=true`
- `AI_FALLBACK_MIN_CONFIDENCE=0.7`
- `AI_FALLBACK_TIMEOUT_MS=900`
- `OPENAI_MODEL=gpt-4o-mini`（可調）
- `AI_CACHE_TTL_SECONDS=600`（可選，服務端快取）
- `STRICT_RECORD_REQUIRES_COURSE=true`（建議）

### 觀測與安全
- NDJSON 追加欄位：`aiFallback`, `aiIntent`, `aiConfidence`
- 逾時/錯誤自動回退規則；設速率與快取，控制成本與延遲

### 測試與驗證
- 冒煙用例：
  - 模糊查詢：「我想了解一下課程安排的情況」→ `query_schedule`
  - 問句查詢：「小明今天有什麼課？」→ `query_schedule`
  - 新增明確：「小明明天下午2點要上數學課」→ `add_course`
  - 記錄內容：「今天小明數學課學了分數加減法」→ `record_content`（若無課→`NOT_FOUND`）
  - 提醒：「提醒我小明的數學課」→ `set_reminder`（若無課→`NOT_FOUND`）

---

## 與現有規劃文件的對照

### 參考文件
- `spec/ai-enhance/plan-ai-enhance.md`
- `spec/ai-enhance/task-ai-enhance.md`

### 一致與重疊
- 三層策略一致：規則收斂 → AI 輔助 → 結果驗證
- 提取 Prompt 重設、結果驗證與清理（action word 移除）與本方案相容
- 收緊 `intent-rules.yaml` 的方向一致（提高查詢詞權重、排除非課程詞）

### 差異與補充（無衝突，可互補）
- 本方案新增「意圖 AI fallback 的介入條件與保護條款」：避免 AI 改壞明確意圖（提醒/取消/新增強特徵）
- 新增「Webhook 保險絲」：在最終回覆前再守一次查詢覆寫，提升線上穩定度（規劃文件未明確提及）
- 明確列出上線所需環境變數與打點欄位，利於部署與觀測
- 任務前置校驗（記錄/提醒/取消/修改）被歸為「結構性缺口修補」，與規劃文件的抽取側互補

### 整合未落地項（將本檔作為唯一權威）
- 規則收斂（plan/task 中提出，尚未同步）：
  - 目標：`config/mvp/intent-rules.yaml`
  - 動作：為 `query_course_content` 增加 required/exclusions；為 `add_course` 增加 required（時間/新增線索）與 exclusions（內容/過去式）；調整 priority（`query_schedule` 提高）
- Webhook 最終護欄（新增）：
  - 目標：`src/bot/webhook.js`
  - 動作：問句+查詢詞覆寫為 `query_schedule`；含「提醒」覆寫為 `set_reminder`；含「取消/刪除」覆寫為 `cancel_course`
- 嚴格模式預設開啟（plan 有提品質保障，未強制）：
  - 目標：`src/tasks/handle_record_content_task.js`
  - 動作：預設 `STRICT_RECORD_REQUIRES_COURSE=true`（程式預設或 Render 環境變數），找不到課程回 `NOT_FOUND`
- 修改課程最小處理器（task 提及修改流程，尚缺最小落地）：
  - 新檔：`src/tasks/handle_modify_course_task.js`
  - 動作：回「功能開發中」或 `NOT_MODIFIABLE_NO_CONTEXT`，避免誤流至新增/記錄
- 抽取 Prompt 與驗證器命名對齊（與 task 文檔一致）：
  - 目標：`src/intent/extractSlots.js`
  - 動作：將當前 prompt/函式命名與 `task-ai-enhance.md` 最終版對齊，保留現有邏輯
- 錯誤案例收集器（task 提出、程式有掛鉤但未完備）：
  - 目標：`src/services/errorCollectionService.js`
  - 動作：補齊 `recordLowConfidenceCase/recordExtractionError/recordIntentError` 與匯出；由 `extractSlots/parseIntent` 調用

—— 以上項目一律以本檔為唯一權威規格，後續編修請同步更新本檔。

### 待對齊項
- `extractSlots.js` 中的 AI Prompt 最終文案與驗證器函式命名，依 `task-ai-enhance.md` 的命名規則落地
- `config/mvp/intent-rules.yaml` 的收斂細節（required/exclusions/priority）用一次 PR 同步
- 錯誤案例收集（`ErrorCollectionService`）可於第二階段接入，與本方案打點對齊

---

## 推進計畫（落地順序）
1) 啟用 AI fallback（parseIntent）＋ Webhook 保險絲 → 立即緩解模糊句失敗
2) 記錄/提醒嚴格校驗 → 避免假成功
3) 收斂規則與提取 Prompt/驗證（對齊 `task-ai-enhance.md`）
4) 錯誤案例收集與快取/速率治理 → 控成本提穩定

### 具體落地清單（可勾選）
- [x] `config/mvp/intent-rules.yaml` 收斂與優先級調整（已提升 query_schedule，收斂 add_course）
- [x] `src/bot/webhook.js` 問句查詢覆寫/提醒護欄（已加強；取消亦有快徑）
- [x] `src/tasks/handle_record_content_task.js` 嚴格模式預設開啟（預設 true，可用環境關閉）
- [x] `src/tasks/handle_set_reminder_task.js` 找不到課程統一 `NOT_FOUND` 文案
- [x] `src/tasks/handle_modify_course_task.js` 最小處理器新增（回覆「功能開發中」）
- [ ] `src/intent/extractSlots.js` Prompt/驗證器命名與文檔對齊（進行中，命名尚待最終對齊）
- [ ] `src/services/errorCollectionService.js` 實作與掛鉤（低信心/錯誤用例收集）
- [x] `/health/deps`/NDJSON 打點驗證（OpenAI/GCal/Redis/Firebase 健康檢查已接）

## 成功準則（短期）
- 模糊查詢與問句類用例線上 PASS 率 ≥ 80%

## 已落地項目（目前已實作）
- 解析器備援（intent）：
  - `src/intent/parseIntent.js`
    - 第二階段 AI 備援（`ENABLE_AI_FALLBACK=true` 啟用）
    - 信心門檻（`AI_FALLBACK_MIN_CONFIDENCE`，預設 0.7）
    - 強規則保護：`set_reminder`、`cancel_course`、以及帶明顯新增線索的 `add_course` 不被低價值 AI 結果覆蓋
    - 打點：落 `aiFallback`、`aiIntent`、`aiConfidence` 至 NDJSON logger
- 槽位抽取（slots）：
  - `src/intent/extractSlots.js`
    - AI 協助抽取：`extractSlotsByAI`
    - 信心分：`calculateConfidence`
    - 結果校驗與自動清理：`validateExtractionResult`、`hasActionWords`、`cleanStudentName`、`cleanCourseName`、`extractStudentFromCourseName`
    - 人名末尾時間詞剝離、常見誤提取修正
    - 打點：低信心與修正案例記錄（透過 logger）
- OpenAI 封裝：
  - `src/services/openaiService.js`
    - 能力：`identifyIntent`、`extractEntities`、`generateResponse`、`chatCompletion`、`testConnection`
    - 結構已預留快取/速率治理掛鉤（後續補 `AI_MAX_RPS`、`AI_CACHE_TTL_SECONDS`）
- 測試與觀測：
  - 問句/模糊句線上實測串接；低信心與覆寫決策已出現在 `/test-results/render-logs` 摘要中
  - 健康檢查與日誌線路暢通（依賴 `src/utils/logger.js` 與現有 webhook 打點）

## 近期新增（本輪）
- 查詢會話鎖（預設 60s，測試用戶自動關閉）：避免查詢跨學生串台
- Webhook 覆寫加強：提醒/查詢短路；修改快徑導向最小處理器
- 查詢輸出一致化：標題一律「課表」，空結果固定引導

## 關聯（非 AI 配套）
非 AI 的規則分流、Webhook 覆寫、任務前置校驗與文案一致化，詳見：
- `spec/nlu/intent-routing-and-guards.md`

- 記錄/提醒不存在課程時一律回 `NOT_FOUND`
- 平均延遲 ≤ 2s（AI 觸發率 ≤ 30%，有快取）


