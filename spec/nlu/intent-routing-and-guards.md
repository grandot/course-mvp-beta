## 意圖分流與任務前置校驗（非 AI 配套）

目標：以規則與保險絲確保穩定體驗，讓「查詢不被誤判」、「記錄/提醒不再假成功」，並統一回覆文案，降低測試誤差。

關聯文件：`spec/ai-enhance/ai-fallback-integration.md`（AI 備援），本檔為非 AI 的分流與護欄規格。

### 一、意圖分流（優先保查詢）
- 位置：`src/intent/parseIntent.js`
- 快徑規則：
  - 查詢快徑：訊息含「課表/有什麼課/今天/明天/這週/幾點/查詢/看一下/課程安排」，且不含「要上/安排/新增」+ 時間詞時，直接 `query_schedule`。
  - 提醒快徑：含「提醒」→ `set_reminder`。
  - 內容快徑：含「學了/內容/記錄」且為問句（含「什麼」或「？」）→ `query_course_content`；否則 → 記錄內容。
  - 取消快徑：含「取消/刪除」→ `cancel_course`。

### 二、規則檔調整（降噪與優先級）
- 位置：`config/mvp/intent-rules.yaml`
- 調整：
  - `query_schedule`：提高 priority；keywords 增補「課表/有什麼課/今天/明天/這週/課程安排/看一下/查詢」。
  - `add_course`：新增 required 同時命中「要上/安排/新增」與「時間詞（點/上午/下午/每週/每天/每月）」；將「今天/明天」移出新增線索，避免誤判。
  - `query_course_content`：補 required/exclusions，避免與新增/提醒混淆。

### 三、任務前置校驗（避免假成功）
- 記錄內容：`src/tasks/handle_record_content_task.js`
  - 嚴格模式預設開啟：`STRICT_RECORD_REQUIRES_COURSE=true`（程式預設或 Render 環境變數）。找不到課程回 `NOT_FOUND`，不落地「獨立內容」。
- 設定提醒：`src/tasks/handle_set_reminder_task.js`
  - 統一不存在時回 `NOT_FOUND`，並標示缺少學生/課名的情況；避免回空成功。
- 取消/修改：
  - 取消：`src/tasks/handle_cancel_course_task.js` 已有「選擇取消範圍」；缺學生/課名回 `MISSING_STUDENT/MISSING_COURSE`，不存在回 `NOT_FOUND`。
  - 修改：新增最小處理器 `src/tasks/handle_modify_course_task.js`，固定回「修改功能開發中」或 `NOT_MODIFIABLE_NO_CONTEXT`，避免誤分流到新增/記錄。

### 四、Webhook 安全覆寫（雙重保險）
- 位置：`src/bot/webhook.js` 的 `handleTextMessage`
- 規則：
  - 問句且含查詢詞（同上）→ 強制覆寫 `query_schedule`，除非同時命中新增必備（「要上/安排/新增」+ 時間詞）。
  - 含「提醒」→ 強制覆寫 `set_reminder`。
- 說明：與解析器快徑互為雙保險，對抗規則/模型波動。

### 五、回覆文案一致化（降低測試誤差）
- 查詢：標題一律「課表」，列表為「時間 + 課名」。
- 空查詢：統一為「📅 X 今天/明天/這週 沒有安排課程」，下方提供「查詢/新增/記錄」引導。
- 記錄/提醒/取消/修改：錯誤分支文案統一（缺欄位、找不到、已過期、需選擇範圍）；對應狀態碼固定（如 `MISSING_STUDENT/MISSING_COURSE/NOT_FOUND`）。

### 六、驗證與可見度（可快速自查）
- 新增 `/debug/intent`（或在 `/health/deps` 加示例）用於句子→意圖即時檢查。
- QA 模式下在回覆內加入「隱藏標籤」或固定日誌欄位，標記 intent、slots、code，方便測試框架對齊。
- NDJSON結構化日誌維持：`userId/traceId/intent/slots/status/latencyMs/errorCode`。

### 七、落地步驟（當日）
1) 調整 `parseIntent.js` 快徑與 `intent-rules.yaml` 優先級/關鍵詞。
2) 開啟記錄嚴格模式（預設 + Render 設定）。
3) Webhook 安全覆寫：問句+查詢詞→query；含提醒→reminder。
4) 文案統一與錯誤提示收斂。
5) 線上冒煙：
   - 查詢：小明今天/明天/這週/幾點 類。
   - 記錄：今天小明數學課學了…（不存在課→`NOT_FOUND`）。
   - 提醒：提醒我小明的數學課（不存在課→`NOT_FOUND`）。
   - 取消/修改：回最小可用文案或選項。

### 成功指標
- 查詢/問句類誤判顯著下降；線上 PASS 率 ≥ 80%。
- 記錄/提醒誤報成功歸零；`NOT_FOUND` 等錯誤碼穩定觸發。

### 待辦清單（可勾選）
- [ ] `src/intent/parseIntent.js` 快徑實作
- [ ] `config/mvp/intent-rules.yaml` 收斂與優先級調整
- [ ] `src/tasks/handle_record_content_task.js` 嚴格模式預設開啟
- [ ] `src/tasks/handle_set_reminder_task.js` NOT_FOUND 文案一致化
- [ ] `src/tasks/handle_modify_course_task.js` 最小處理器新增
- [ ] `src/bot/webhook.js` 安全覆寫
- [ ] 查詢/空查詢/錯誤分支文案統一
- [ ] `/debug/intent` 或 `/health/deps` 增示例


