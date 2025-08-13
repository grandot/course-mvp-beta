### 重複課程（每天/每週/每月）統一規則與實作計畫（P0）

本文件遵循核心原則：「盡量依賴 Google Calendar 的 RRULE 標準，不重造時間/重複規則的輪子」。
我們只在本地進行最小必要運算（解析語意、缺日期時推導首個實例、檢查首個實例衝突），其餘一概交由 GCal 處理。
以下定義「每天 / 每週 / 每月」重複課程的統一行為規則、風險邊界、技術介面與落地步驟，確保使用體驗一致、風險可控、且具可觀測性。

---

## 1. 第一性原則
- 使用者心智優先：
  - 說「每天 8 點」→ 期待從最近的未來一次開始，每天固定發生。
  - 說「每週三 15:00」→ 下個週三的 15:00 為起點，之後每週同時段。
  - 說「每月 15 號 10:00」或「每月第一個週一 10:00」→ 以最近的未來一次為起點，之後每月固定規律。
- 風險最低：只檢查並建立「首個實例」即可，避免全串預檢造成高成本與假陽性。
- 可逆可觀測：產生清楚的系列摘要與撤銷路徑；整段流程有結構化日誌。

---

## 2. 範圍（P0）
- 納入：
  - Daily：每天；
  - Weekly：每週（含多天，如一三五；保留，因已穩定可用且風險低）；
  - Monthly：
    - 型一 BYMONTHDAY：每月 X 號（例：每月 1 號 / 15 號）。
    - （移至 P1）型二 BYDAY+BYSETPOS：每月第 N 個週 X 或最後一個週 X（例：每月第一個週一、每月最後一個週日）。
- 先不納入（明確不做）：
  - 工作日/週末等複合語意；
  - 每雙週/每兩月/跨複合 RRULE；
  - 每月 X 號在小月自動「改為月底」之類語意修正（P0 採保守策略：該月跳過）。

---

## 3. 統一行為規則

### 3.1 起始日（未提供日期時）
- Daily：
  - 「今天該時間未過」→ 起始日=今天；
  - 否則→ 起始日=明天。
- Weekly（單/多天）：
  - 若今天包含於指定週幾集合，且該時間未過→ 今天；
  - 否則→ 從「下一個符合的週幾」中最早的一天開始。
- Monthly（BYMONTHDAY）：
  - 本月有該日，且時間未過→ 本月該日；
  - 否則→ 下月該日；
  - 小月無該日→ 該月跳過（不自動改月底）。
- Monthly（BYDAY+BYSETPOS）：
  - 計算本月第 N 個週 X（或最後一個週 X）；
  - 若該日期在未來、或等於今天且時間未過→ 本月；
  - 否則→ 下月對應週次。

備註：時間判斷與日期計算一律在 Asia/Taipei 時區下進行，避免跨日/跨時區歧義。

### 3.2 衝突檢查
- 一律僅檢查「首個實例」是否與既有事件衝突；
- 衝突時回覆清單（含 summary 與時間），引導使用者改時間或放棄；
- 不做整串預檢（成本高、噪音大）。

### 3.3 功能開關與降級（Feature Flag）
- 以單一環境變數 `ENABLE_RECURRING_COURSES` 控制 daily/weekly/monthly（相容舊 `ENABLE_DAILY_RECURRING`）。
- 關閉時：若偵測到任何重複語意（daily/weekly/monthly），一律回「重複功能未開放」統一降級文案；不得落入「缺日期→追問」。

### 3.4 RRULE 產生（單一入口）
- `FREQ=DAILY` / `FREQ=WEEKLY;BYDAY=...` / `FREQ=MONTHLY;BYMONTHDAY=X` / `FREQ=MONTHLY;BYDAY=MO;BYSETPOS=1` 等；
- 專責函式：`buildRecurrenceRule(recurrenceType, options)`，由任務層唯一呼叫。
- 介面相容（實作層現況）：
  - 舊：`buildRecurrenceRule(recurring, recurrenceType, dayOfWeek)`（既有呼叫不需修改）
  - 新：`buildRecurrenceRule(recurring, { recurrenceType, dayOfWeek, monthDay, nthWeek })`
  - P0：接受 `nthWeek` 但不使用；P1 啟用 `BYSETPOS` 相關邏輯。

### 3.5 成功/錯誤文案與格式
- 成功：固定時間格式 `上午/下午h:mm`，分鐘補零；列出首個實例日期與時間，並標註「系列已建立」。
- 錯誤：錯誤碼維持簡化（VALIDATION_ERROR / CONFLICT_ERROR / SYSTEM_ERROR）；文案一致且可預期。

---

## 4. 欄位與資料模型（Slots）
- `recurring: boolean`
- `recurrenceType: 'daily' | 'weekly' | 'monthly' | null`
- `dayOfWeek: string[]`（週一到週日：MO/TU/WE/TH/FR/SA/SU；weekly 與 monthly-第N個週X 會用到）
- `monthDay: number | null`（monthly BYMONTHDAY 用）
- `nthWeek: number | null`（1,2,3,4 或 -1=最後一個；monthly BYSETPOS 用）
- `scheduleTime: string`（'HH:mm'）
- `courseDate: string | null`（'YYYY-MM-DD'，可缺省，由任務層補）
- 關閉時降級：`recurringRequested: true` + 特殊結果 `recurrenceResult='disabled'`

---

## 5. 系統變更點（不立即實作，此處為計畫）
- `src/intent/extractSlots.js`
  - 保持既有關鍵詞解析，但回傳更結構化欄位：`recurrenceType / dayOfWeek / monthDay / nthWeek`；
  - 當開關關閉且偵測到重複語意→ 設定 `recurringRequested=true` 與 `recurrenceResult='disabled'`。

- `src/tasks/handle_add_course_task.js`
  - 新增「起始日決策」：`deriveStartDate(recurrenceType, scheduleTime, { dayOfWeek, monthDay, nthWeek }, now)`；
  - 缺日期時，依 3.1 規則補 `courseDate`；
  - 若使用者「顯式給了日期」且在過去→ 一律回 `VALIDATION_ERROR`（只有「沒給日期」才啟動自動推導）。
  - 僅檢查「首個實例」的衝突；
  - 呼叫統一 RRULE 產生器，將 `recurrence` 帶入行事曆建立；
  - 關閉時立即回降級文案。

- `src/services/googleCalendarService.js`
  - 新增/整合：`buildRecurrenceRule(recurrenceType, { dayOfWeek, monthDay, nthWeek })`；
  - 內部統一使用單一開關 `ENABLE_RECURRING_COURSES`（相容舊變數）。

- `src/config/features.js` / `src/config/index.js`
  - 文件化單一開關；保留舊變數 deprecation 記錄與相容邏輯。

---

## 6. 介面草案（函式雛形）
```js
// 任務層（handle_add_course_task.js）
function deriveStartDate(recurrenceType, scheduleTime, { dayOfWeek, monthDay, nthWeek }, now = zonedNow('Asia/Taipei')) => 'YYYY-MM-DD'

// 服務層（googleCalendarService.js）
function buildRecurrenceRule(recurrenceType, { dayOfWeek, monthDay, nthWeek }) => string[]  // e.g., ['RRULE:FREQ=MONTHLY;BYDAY=MO;BYSETPOS=1']
```

---

## 7. 測試計畫（對齊現有套件並補強）
- Daily：
  - A2.1-C/D：未給日期→不追問，能自動選「今天或明天」建立系列；
  - A2.2-D：關閉時直接降級文案，不追問日期；
  - A2.2-E：兩個每日同時段不同課名→第二次應命中首實例衝突。
- Weekly：
  - 單天、多天（如一三五；首實例＝從現在起最近的一天，若今天且未過→今天）；
  - 今天即指定週幾且時間未過→以今天為首實例。
- Monthly：
  - BYMONTHDAY：1 號、15 號；跨小月（例如 31 號）→ 當月跳過，文案提示。
  - （P1）BYDAY+BYSETPOS：第一個週一、第三個週四、最後一個週日；本月/下月邊界測試。
- 旗標：
  - 開關 ON → 三類可用；
  - 開關 OFF → 三類皆統一降級文案。

---

## 8. 風險與決策
- 小月缺日：P0 採「跳過該月」，不自動變更為月底，以免違反使用者預期。
- 衝突只檢查首實例：大幅降低成本與誤報，足夠覆蓋主流程；必要時再提供「檢視系列衝突」輔助。
- 時區：鎖定 Asia/Taipei（+08:00）進行解析與比較，避免跨時差帶來的今天/明天誤判。

---

## 9. 上線與旗標
- 單一布林：`ENABLE_RECURRING_COURSES`；
- 灰度策略：先本機/測試 ON，Render 小範圍 ON 視情擴大；
- 撤銷時限：程式內建 2 分鐘（統一用於「撤銷上一動作」與「撤銷＋重建」）。如需臨時調整，可選擇性以 `UNDO_WINDOW_MINUTES` 覆蓋（預設不需設定）。
- 文件：`config/env.example` 與 `tools/README.md` 更新。

---

## 10. 交付步驟（工程）
1) 任務層補「起始日決策」，優先修復 Daily（對應線上 FAIL）。
2) 關閉時降級邏輯套用於 Weekly 與 Monthly，避免追問流。
3) 實作 `buildRecurrenceRule` 並改寫 Daily/Weekly 呼叫；加入 Monthly 兩型。
4) 補測試用例與文案；跑 quick / time-and-recurring / render basic。
5) 觀察日誌與回歸，調整邊界文案。

---

## 11. 可觀測性（NDJSON）
- 每次建立系列輸出：`{ intent:'add_course', recurring:true, recurrenceType, startDate, scheduleTime, rule, firstInstanceConflict, userId, traceId }`
- 降級輸出：`{ intent:'add_course', recurringRequested:true, disabledByFlag:true }`

---

## 12. 非目標（P0 不做）
- 工作日/週末等進階語意；
- 變動結束條件（直到某日期/共 N 次）與 EXDATE 規則；
- 直接「修改既有系列」（P0 提供「撤銷＋重建（預填）」一鍵流；P1 再做限改時間/課名且無例外日的系列修改）。


## 13. P0「撤銷＋重建」UI 文案（精簡）
- 按鈕：重新設定課程
- 副標：不改內容，只調整時間與重複
- 確認視窗：會以原設定預填，重建新系列；舊系列會移除。要繼續嗎？
- 確認按鈕：繼續重新設定｜取消
- 進度：正在重新設定，請稍等…
- 成功：已改為「每週三 下午3:00」。2 分鐘內可撤銷。
- 撤銷：已可撤銷至原設定（限 2 分鐘）
- 小月提醒：本月沒有 31 號。要改成「每月最後一天」嗎？（改為最後一天｜維持 31 號並跳過本月）
- 降級（功能關閉）：目前尚未開放重複課程功能，之後會通知喔

---

## 14. 統一撤銷時限共用介面（規劃）
- 目的：將「2 分鐘撤銷時限」做成單一定義、可重用的程式介面，避免各處硬編寫。
- 位置：`src/utils/timeWindow.js`（或整合於 `src/config/index.js`）。
- 介面（示意）：
```js
// 預設 2 分鐘，不需環境變數亦可生效
export const UNDO_WINDOW_MS = 2 * 60 * 1000;

// 可選：若未來臨時需要調整，才讀環境變數覆蓋（預設不設定）
export function getUndoWindowMs() {
  const v = Number(process.env.UNDO_WINDOW_MINUTES);
  return Number.isFinite(v) && v > 0 ? v * 60 * 1000 : UNDO_WINDOW_MS;
}
```
- 使用範圍：
  - 撤銷上一動作（cancel_action）時限判斷
  - P0「撤銷＋重建」一鍵流的時限判斷
- 說明：程式內建 2 分鐘即可運作；僅在需要臨時調整時，才以 `UNDO_WINDOW_MINUTES` 覆蓋（非必填）。


