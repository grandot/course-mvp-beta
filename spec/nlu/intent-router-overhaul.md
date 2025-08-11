## Intent Router 全鏈重構規劃（第一性原則）

### 為什麼要重構（背景）
- 當前決策分散在多層（規則、Webhook 覆寫、AI 補判、槽位抽取、任務前置校驗、回覆文案），順序與責任邊界不穩定，導致同一句話在不同環境結果不一致。
- 規則「收緊」與「嚴格模式」啟用後，文件期望、代碼回覆、測試關鍵字未同步，通過率下降。
- 線上未正確啟用 AI fallback，本地與線上行為差距被放大。

### 第一性原則與目標
- 強一致：單一決策中心，固定順序，任何一層不覆蓋上游最終決策。
- 可觀測：每一階段的決策與輸出都有紀錄，能被追溯。
- 雙態清晰：QA 與 Prod 行為可切換、可預測；預設合理、少環境變數。

### 範圍（做與不做）
- 會做：意圖決策中心（Intent Router）、統一 RequestContext、Session 應用（查詢會話鎖）、槽位抽取整合、任務 Gatekeeper、回覆渲染器、DecisionLog、灰度開關。
- 不會做：更動 Firestore 結構、推翻既有任務的業務邏輯（僅補 Gatekeeper 與輸出模板）。

### 核心設計（模組與責任）
- IntentRouter（新）
  - 單一決策中心；固定順序：Safety → Query → Modify → Others → AI 補判（可選）→ 仲裁。
  - 以 `config/mvp/intent-rules.yaml` 為規則權威；保證 Safety 不被覆蓋。
- RequestContext（新）
  - 封裝原文、關鍵提示（是否問句、是否含提醒/取消）、userId、運行模式（qa/prod）、會話鎖 pinned 值。
- SlotExtractor（整合現有 `src/intent/extractSlots.js`）
  - Query：優先使用會話鎖 pinned → 句中明確 → 上下文；多候選不猜、回詢問。
  - 非 Query：規則 + AI 增補，但先做嚴格驗證與清洗。
- Session（沿用 `ConversationManager`）
  - `activeQuerySession` 僅由 Router 設定/清除；TTL 預設 60 秒；QA 模式 TTL=0。
- Task Gatekeeper（任務入口）
  - 檢查最小充分條件；不足則回統一錯誤碼與固定文案（MISSING_*/NOT_FOUND/PAST_*）。
- ResponseRenderer（新）
  - 模板化輸出；Query 標題永遠「課表」，空結果固定三條引導；其餘任務固定模板與錯誤碼對應。
- DecisionLogger（新）
  - 記錄 router 決策來源（rule/ai/override）、slots 前後、task gate 結果、渲染模板、錯誤碼；提供調試查詢。

### 決策順序契約（不可變）
1. 正規化與關鍵提示（是否問句、是否含提醒/取消…）
2. IntentRouter：Safety → Query → Modify → Others →（若啟用）AI 補判 → 仲裁
3. Session 套用：僅 Query 套用 pinned；非 Query 忽略 pinned
4. 槽位抽取：規則 → AI 增補 → 驗證清洗
5. 任務 Gatekeeper：最小充分條件與錯誤碼
6. 回覆渲染器：模板化輸出
7. DecisionLog + 結構化日誌（NDJSON）

### 介面契約（概要）
- `src/nlu/RequestContext.js`
  - 欄位：`userId`, `text`, `mode(qa|prod)`, `cues(isQuestion, hasReminder, hasCancel)`, `session(pinnedStudent, pinnedTimeRef)`
- `src/nlu/IntentRouter.js`
  - `async routeIntent(ctx): { intent, source: 'rule'|'ai'|'override' }`
- `src/intent/extractSlots.js`
  - `async extractSlotsWithSession(ctx, intent): Slots`
- `src/nlu/ResponseRenderer.js`
  - `render(intent, slots, taskResult): string`
- `src/utils/decisionLogger.js`
  - `recordDecision(traceId, payload)`

### 策略與模式
- QA 模式：AI 預設關或 Dummy、查詢會話鎖 TTL=0、每步重置上下文、嚴格模式開啟、DecisionLog 全量。
- 線上（Prod）：可啟用 AI（需限流與快取）、查詢會話鎖 TTL=60s、嚴格模式開啟、DecisionLog 取樣記錄。

### 配置與 Flags（盡量少）
- `USE_INTENT_ROUTER=true`（灰度開關，可一鍵回退）
- `ENABLE_AI_FALLBACK`（QA 預設 false；Prod 可為 true，無金鑰自動降級）
- `QUERY_SESSION_TTL_MS`（預設 60000；QA 模式視為 0）
- `RULES_MODE=balanced|strict`（預設 balanced，用於漸進式規則收斂）

### 可觀測性與調試
- 結構化日誌：持續記錄 `intent/slots/code/latency/error`
- DecisionLog：完整記錄決策過程（來源、slots 前後、任務與渲染）
- 調試端點：保留 `/debug/intent`，新增 `/debug/decision`（依 traceId 或最近一筆）

### 補充設計（回應審閱建議）
- 去重（避免與現有 webhook 重複）
  - Router 上線後，`webhook` 僅負責：簽名驗證 → 建立 `RequestContext` → 呼叫 Router → 回應。
  - 暫留最小覆寫（提醒/取消）僅作灰度保險；於里程碑 2 移除。規範：Router 為唯一決策中心，其他層不得改意圖。
- 查詢會話鎖（TTL 與重置條件）
  - TTL：Prod=60s、QA=0；只影響 `query_schedule`。
  - 重置條件：1) 用戶明確提到新學生/課；2) 意圖切換為非查詢；3) TTL 到期。
  - 不覆蓋訊息中已明確的學生；多候選不猜、回詢問；所有應用/重置事件寫入 DecisionLog。
- 規則收斂（漸進）
  - 新增 `RULES_MODE`；預設 `balanced`。先落 balanced 調整，再逐步轉 strict。
  - `add_course` required/exclusions 逐步上緊；`query` 關鍵詞提升但避免搶判；每次收斂前跑 QA 基線並比對。
- Feature Flag 與回滾（灰度）
  - Flags：`USE_INTENT_ROUTER`、`ENABLE_AI_FALLBACK`、`QUERY_SESSION_TTL_MS`、`RULES_MODE`。
  - 灰度步驟：先對 `U_test_*` 開啟 → 10% 流量 → 全量；任一指標異常即關 Flag 回退。

### 遷移策略與里程碑
- 里程碑 1（約 1 天，灰度）
  - 上線 `IntentRouter/RequestContext/ResponseRenderer` 骨架；Webhook 改為純中轉；Query 全鍊打通；Flag 可回退。
  - 目標：查詢類線上 PASS ≥ 60%，標題固定「課表」。
- 里程碑 2（約 1–2 天）
  - Record/Reminder/Cancel 加 Gatekeeper 與模板統一；錯誤碼一致。
  - 移除 webhook 中殘留覆寫邏輯，由 Router 全權決策，完成去重。
  - 目標：三類線上 PASS ≥ 75%。
- 里程碑 3（約 1 天）
  - Modify 最小處理器模板；AI fallback 加限流與快取；DecisionLog 查詢。
  - 目標：整體 PASS ≥ 85%。

### 測試與驗收
- MD 驅動用例同步：
  - 查詢用「課表」做關鍵字；
  - 記錄內容找不到課→預期 NOT_FOUND；
  - 修改→「功能開發中」。
- QA Runner：每步帶 `X-QA-Reset-Context: true`；`U_test_*` 使用者（Session TTL=0）。
- 驗收 KPI：線上冒煙 PASS ≥ 80%，DecisionLog 與 NDJSON 一致。

### 風險與回退
- 風險：核心路徑重構；以 Feature Flag 灰度，保留舊路徑 24–48 小時可無縫回退。
- 回退：`USE_INTENT_ROUTER=false` 即回舊路徑；日誌持續可觀測。

### 實作清單（可勾選）
- [x] 新增 `src/nlu/RequestContext.js`
- [x] 新增 `src/nlu/IntentRouter.js`（Safety/Query/Modify 決策、AI 補判）
- [x] 調整 `src/bot/webhook.js` 使用 Router（保留回退 Flag；QA 流程預設走 Router）
- [x] 新增 `src/nlu/ResponseRenderer.js` 並接入 webhook（已上線 Query 空結果與錯誤碼模板）
- [x] 調整 `src/intent/extractSlots.js` 支援 session pinned、Query 多候選回詢問
- [ ] 各任務 Gatekeeper（最小充分條件與錯誤碼/文案統一）
- [x] 新增 `src/utils/decisionLogger.js` 與 `/debug/decision`
- [ ] 更新 `config/mvp/intent-rules.yaml`（Safety/Query/Modify 權威規則）
- [ ] 更新 QA 測試 MD 期望（課表/NOT_FOUND/功能開發中）
- [ ] 灰度上線與回報（里程碑 1 → 3）

### 測試附註（持續更新）
- 2025-08-11 里程碑1骨幹上線（Router/Context/Renderer 空模板接入 webhook）
  - 本地：無阻塞
  - 線上冒煙（render-suite）：通過率 11%（28 測試，3 通過）
    - 正向：B1.1-B（明日課表）、新增單次課、模糊語句澄清 PASS
    - 主要落差：
      1) Query 標題已多數轉為「課表」，但仍有誤分流（今天/明天問句被帶偏）
      2) 記錄/提醒/取消尚未全面接 Gatekeeper＋模板，錯誤碼與文案未對齊期望
  - 下一步：補 Gatekeeper 與錯誤碼模板；微調 Router/規則避免 Query 被搶判

- 2025-08-11 第三輪（時區修正：Asia/Taipei 日期計算）
  - 變更：`handle_query_schedule_task` 改為台北時區計算今天/明天/本週/下週
  - 線上冒煙：通過率 11%（28 測試，3 通過）
    - 改善：空結果/標題一致仍正常；個別用例文案更穩定
    - 落差：
      1) 「今天」仍有部分落到「明天」的案例（研判為舊會話鎖/上下文干擾或快取延遲）
      2) 查詢/新增分流在「課程安排」等模糊詞上仍有誤蓋
      3) 記錄/提醒/取消未全面套用錯誤模板（關鍵詞比對仍不穩）
  - 下一步：
    - 關閉查詢上下文自動補齊對非查詢意圖的干擾；檢查 pinned 寫入時機
    - 完成 `record/reminder/cancel` 的錯誤模板化輸出
    - 規則收斂：提高 Query 詞權重，新增必備時間條件給 Add，避免搶判

- 2025-08-11 第二輪（多候選澄清與決策觀測上線）
  - 線上冒煙：通過率 14%（28 測試，4 通過）
    - 已改善：
      - 查詢多候選不猜，回澄清選單（Quick Reply）
      - 空查詢統一「課表＋三條指引」
      - 決策鏈可於 `/debug/decision` 觀測（nlp/slots/task/render）
    - 主要落差：
      1) 時區/日期範圍導致「今天」誤落到「明天」
      2) 「課程安排」等字眼仍可能讓新增/查詢互搶（需規則收斂）
      3) 記錄/提醒/取消未全面套用錯誤模板，關鍵詞比對不穩定
  - 下一步：
    - 修正 Asia/Taipei 日期計算於 `handle_query_schedule_task`
    - 將 `record/reminder/cancel` 錯誤回覆接入 `ResponseRenderer` 模板
    - 收斂 `config/mvp/intent-rules.yaml` 以保護查詢不被搶判
