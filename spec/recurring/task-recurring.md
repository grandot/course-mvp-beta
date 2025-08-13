### Recurring 一致化「實作任務清單」(task-recurring) — 依第一性原則

目的：將 `spec/recurring/plan-recurring.md` 的決策落地為明確可執行的任務，避免邏輯分歧與重工。原則是「盡量依賴 GCal RRULE、不自造輪子；本地僅做最小推導＋首實例衝突檢查」。

---

## 0) 範圍與基調
- P0 支援：daily、weekly（含多天）、monthly（固定日 BYMONTHDAY）。
- P1 才做：monthly 第 N 個週 X（BYDAY+BYSETPOS）。
- 小月策略：預設「跳過」，建立當下提示「改為每月最後一天？」讓用戶決定。
- 撤銷時限：統一 2 分鐘（程式內建，可選環境變數覆蓋）。

---

## 1) 功能開關一致化（單一開關＋關閉時統一降級）
- Why（第一性）：減少心智負擔與測試不一致；flag 僅作風險控管，不決定行為細節。
- Edits：
  - `src/intent/extractSlots.js`
    - 若 `ENABLE_RECURRING_COURSES !== 'true'` 且偵測到 recurring 關鍵詞，回傳 `recurringRequested=true` 與特殊結果（disabled），不得落入補問日期流。
  - `src/tasks/handle_add_course_task.js`
    - 若收到 disabled 標記，直接回統一降級文案（不要再進入澄清/追問）。
  - `src/services/googleCalendarService.js`
    - RRULE 生成前統一檢查單一開關（僅此一處）。
- 驗收：
  - 關閉時，daily/weekly/monthly 都回相同降級文案，不再追問。
  - 開啟時不受影響。
- 風險：降級口徑需與文案測試同步，避免誤判用例。

---

## 2) 起始日預設（缺日期時）
- Why：與人類直覺一致、且只做最小推導，不展開長序列。
- Edits（新增純函式並在任務層使用）：
  - `src/tasks/handle_add_course_task.js`
    - 改進現有 `calculateNextCourseDate` 的日期推導邏輯（P0）；P1 再抽象為 `deriveStartDate` 標準介面：
      - daily：今天指定時間未過→今天；否則→明天。
      - weekly（單/多天）：從「現在」起找最近的符合週幾；若今天且未過→今天。
      - monthly（BYMONTHDAY）：本月有該日且未過→本月；否則→下月；小月無該日→跳過（不自動改）。
      - 注意：推導需同時考量具體時間（scheduleTime），不可只看日期。
    - 若使用者「有給日期」但在過去→直接 `VALIDATION_ERROR`；僅「未給日期」時啟動推導。
- 驗收：
  - A2.1-C / A2.1-D 不再被追問日期，能直接建立 daily。
  - weekly 今天即指定日且未過→今天。
- 風險：時區一律 `Asia/Taipei`，避免今日/明日邊界誤判。

---

## 3) 衝突檢查口徑（只檢「首個實例」）
- Why：降低成本與假陽性；足夠覆蓋使用者感知層。
- Edits：
  - `handle_add_course_task.js` 中，推導出首個實例日期後再呼叫 `googleCalendarService.checkConflict(...)`；僅針對首實例。
- 驗收：
  - A2.2-E：第二個 daily 同時段建立時，能命中首實例衝突，回清單＋引導。
- 風險：使用者可能以為全串都檢查，文案需明確「僅檢首個時段」。

---

## 4) RRULE 單一產生器（服務層集中）
- Why：集中一處避免分散邏輯，與 GCal 對齊。
- Edits：
  - `src/services/googleCalendarService.js`
    - 新增 `buildRecurrenceRule(recurring, { recurrenceType, dayOfWeek, monthDay, nthWeek }) => string[]`。
    - daily → `RRULE:FREQ=DAILY`
    - weekly → `RRULE:FREQ=WEEKLY;BYDAY=...`（多天以逗號列出）
    - monthly（BYMONTHDAY）→ `RRULE:FREQ=MONTHLY;BYMONTHDAY=X`
  - 呼叫點：`handle_add_course_task.js` 全走此入口。
- 驗收：
  - 所有 recurring 事件都由此生成 RRULE；月的 BYSETPOS 留待 P1。
- 風險：BYDAY 映射（中/英）需測試；不可引入本地序列展開。

---

## 5) 小月策略與提示（不黑箱）
- Why：透明可預期，避免「31 號變 28/29」的驚訝。
- Edits：
  - 任務層在建立當下，若偵測 monthDay 為 29/30/31 且本月無該日：
    - 仍採「跳過」規則；
    - 回覆文案帶「是否改為每月最後一天？」快捷選項（交互由之後 UI/Quick Reply 接入）。
- 驗收：
  - 首次建立時就有提示；不自動改動。
- 風險：僅提示不改動，需說清楚「本月將無課」。

---

## 6) 文案與格式一致化
- Why：降低誤解、提昇體驗一致性。
- Edits：
  - 成功訊息時間：一律 `上午/下午h:mm`，分鐘補零。
  - 關閉降級：固定一段友善文案（不追問）。
  - 錯誤碼：`VALIDATION_ERROR / CONFLICT_ERROR / SYSTEM_ERROR`。
- 驗收：
  - 各路徑訊息一致，測試不再靠模糊字串才過。

---

## 7) 撤銷時限統一介面（內建 2 分鐘）
- Why：單一事實來源，避免各處魔法數字。
- P0：直接以常數使用 `2 * 60 * 1000`（2 分鐘），不須新增檔案。
- P1：抽出 `src/utils/timeWindow.js` 並提供：
  - `export const UNDO_WINDOW_MS = 2 * 60 * 1000;`
  - `export function getUndoWindowMs() { /* 可選讀 env 覆蓋 */ }`
- 使用處：`cancel_action` 與 P0「撤銷＋重建」流。
- 驗收：
  - 2 分鐘內可撤銷；超時有明確提示。

---

## 8) 測試與 QA 更新
- Why：對齊新行為，讓報告可信。
- Edits：
  - Daily：A2.1-C/D 改為 PASS（不追問日期）；A2.2-E 能命中衝突提示。
  - Weekly：若今天屬集合且未過→今天；多天（如一三五）保持 PASS。
  - Monthly：固定日 PASS；A2.2-C 對 monthly（第 N 個週 X）維持未支援文案（直到 P1）。
  - 關閉用例：daily/weekly/monthly 均走同一降級文案。
- 驗收：
  - render basic 與 time/recurring 套件一致；線上不再出現每日被追問日期的 FAIL。

---

## 9) 可觀測性（最小 NDJSON）
- Why：線上追蹤必要最低限度，不過度。
- Edits：
  - 建立系列時輸出：`{ intent, userId, traceId, recurring, recurrenceType, startDate, scheduleTime, rule, status }`
  - 降級時輸出：`{ intent, recurringRequested: true, disabledByFlag: true }`
- 驗收：
  - 測試報告可依欄位快速定位差異；不要求額外高成本指標。

---

## 10) 風險提示與防呆
- 起始日推導一定走 `Asia/Taipei`，避免跨日誤判。
- 僅檢首實例，文案須寫清楚，避免誤解為全串檢查。
- 小月「跳過」策略需即時提示選項；否則用戶以為漏排。
- 關閉時絕不進入追問流，避免造成錯誤互動。

---

## 11) 文件與看板（狀態）
- 已完成：
  - `spec/recurring/plan-recurring.md`（規劃）
  - `doc/developer-guide.md`／`ai-rules/tech.md`／`README.md`（上位摘要與連結）
- 待持續同步：
  - `PROJECT_STATUS.md` 與 Trello 卡描述（遇到決策變動時，先改規劃再改看板）

---

## 12) 交付順序（建議）
1) 任務層起始日推導（先修 Daily 3 個 FAIL）
2) 關閉降級一致化（避免追問）
3) RRULE 單一產生器接管 Daily/Weekly；接著串 Monthly 固定日
4) 小月提示＋文案統一
5) 測試校準（time/recurring + render basic）
6) 最小 NDJSON 字段校準


