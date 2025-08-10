# Google Calendar 對接方案（Integration Plan）

說明：本文件定義我們與 Google Calendar（GCal）的整合方式與落地步驟，確保使用者在「一週內」能穩定查看/管理課表。以「Firebase 為唯一真相（Source of Truth）」為前提，GCal 作為鏡像與加分能力（外部可視、FreeBusy 衝突二次校驗）。

---

## 目標與範圍
- 目標：
  - 查課表可顯示單次與重複課（daily/weekly，monthly 逐步補齊），不中斷。
  - 新增/修改/取消課程可鏡像到 GCal（不阻塞主流程）。
  - 衝突檢查可透過 GCal FreeBusy 作二次校驗（可選）。
- 範圍（與產品決策對齊）：
  - Calendar 顆粒度：採「每位學生一個 calendar」為預設。平台帳號持有，不需對外分享。
  - 查詢預設：以 Firebase 為主（快照），GCal 作鏡像/校對與背景同步。
  - 寫入順序：先寫 GCal，再寫 Firebase；GCal 失敗也要落地 Firebase 並排入回補。

---

## 架構原則
- 資料主從：
  - Firebase Firestore = 主資料（唯一真相）。
  - Google Calendar = 鏡像（Mirror），提供外部可視、FreeBusy 校對。
- 計算規則：
  - RRULE 與時區語義與 GCal 對齊（Asia/Taipei）。
  - 查詢展開：預設讀 Firebase（快、穩、低成本）；必要時以 GCal 單次展開（singleEvents/instances）做校對或補齊；本地 RRULE 展開作為後備。
- 可靠性：
  - 功能旗標控制與回退：
    - `USE_GCAL=true|false`：是否啟用 GCal 參與（鏡像/校對）。
    - `GCAL_FALLBACK_FIREBASE=true|false`：GCal 失敗時是否回退用 Firebase 結果/流程。
    - `ENABLE_LOCAL_RECURRING_EXPAND=true|false`：是否啟用本地 RRULE 展開（查詢時）。
  - 任一外部失敗，不阻塞主流程；統一回傳結構化 code/訊息。

---

## 資料模型對應（Firestore ↔ GCal）
- Firestore（courses）核心欄位建議：
  - `id`：課程 ID（Firestore doc id）
  - `userId`：家長/使用者 ID
  - `studentName`：學生名稱
  - `courseName`：課程名稱
  - `courseDate`：單次課日期（YYYY-MM-DD）
  - `scheduleTime`：開始時間（HH:mm）、`endTime`（HH:mm，可選）
  - `timezone`：'Asia/Taipei'
  - `isRecurring`：是否為重複課
  - `recurrenceType`：'daily' | 'weekly' | 'monthly'
  - `dayOfWeek`：0-6（週日-週六），僅 weekly 用
  - `rrule`：完整 RRULE 字串（可選，月循環逐步補）
  - `gcalEventId` / `gcalRecurringId`：鏡像對應的 GCal event id / recurring id（exceptions 用）
- GCal Events 對應：
  - `summary`：`[lineUserId] [studentName] - courseName`（例如：`U_xxx 小明 - 數學課`）
  - `description`：可含學生名/內部 ID/連結
  - `start`/`end`：`dateTime` + `timeZone`
  - `recurrence`: [`RRULE:FREQ=WEEKLY;BYDAY=...`] 或 daily/monthly RRULE
  - `extendedProperties.private`：存放 `courseId`、`userId`、`studentName` 等（查回對齊）

---

## 事件命名與歸屬標識（含 LINE User ID）
- 為什麼要帶 `LINE User ID`：
  - 唯一性/隔離：不同家長可能都有「小明」，用 `userId + studentName` 避免混淆與誤關聯。
  - 定位/追蹤：平台在 GCal 端能快速定位到哪位家長底下的事件，便於排錯與回補。
  - 遷移安全：`userId` 為穩定主鍵，避免僅憑顯示名造成錯配。
- 放置位置：
  - `summary`：`[lineUserId] [studentName] - courseName`（例：`U_xxx 小明 - 數學課`）
  - `extendedProperties.private`：必含 `userId`、`courseId`、`studentName`（系統硬對齊以此為準）
- 隱私與對外可見：
  - 目前 calendar 僅平台持有、不對外分享，summary 含 `userId` 不會外泄。
  - 未來若分享給家長：可改 summary 僅顯示「學生名 - 課程」，`userId` 仍保留在私有屬性中。
- 更名一致性：
  - 家長/學生改名時可更新 summary 顯示；系統對齊仍以 `userId` + `courseId` 為準，不受影響。

---

## API 對接與套件
- 使用 `googleapis`（Node）Calendar v3：
  - `events.insert` / `patch` / `delete`
  - `events.list`（`timeMin`/`timeMax`、`singleEvents=true` 展開 recurring）
  - `events.instances`（必要時針對 recurring 更精準展開）
  - `freebusy.query`（衝突查詢）
- 認證：Service Account（SA）
  - 將 SA JSON 以環境變數提供（例如 `GOOGLE_SERVICE_ACCOUNT_JSON`），啟動時寫入臨時檔或直接載入。
  - Calendar 權限：將目標 calendar 與 SA 帳號分享（寫入權）。

---

## 主要流程
### 1) 新增課程
- 單次課：
  1. 先寫入 GCal 事件（取得 eventId / recurringId）。
  2. 寫入 Firebase（帶上對應的 `gcalEventId`/`gcalRecurringId`）。
  3. 若 GCal 失敗 → 仍寫入 Firebase 並記錄回補隊列（不阻塞用戶）。
- 重複課（daily/weekly）：
  1. 先在 GCal 建 recurring 事件（RRULE）。
  2. 寫入 Firebase（保存 recurrenceType、rrule、gcalRecurringId）。
  3. 若 GCal 失敗 → 仍寫入 Firebase 並回補；查詢時以 Firebase + 本地展開保底。

### 2) 查詢課表（本週/下週/自訂區間）
- 預設策略（快速穩定）：
  - 直接讀 Firebase（單次 + 已同步/鏡像的 recurring 展開快照）。
  - 去重鍵：`studentName|date|time|courseName`，格式化輸出。
- 校對/補齊（可選）：
  - `USE_GCAL=true` 時，用 `events.list(singleEvents)` 或 `instances` 校對；如發現缺口，觸發背景回補。
- 回退策略：
  - 若 Firebase 資料不完整且 GCal 可用 → 臨時以 GCal 補齊當次查詢結果。
  - 若 GCal 失敗 → 仍回以 Firebase 可得資料；必要時本地 RRULE 展開。

### 3) 衝突檢查
- 預設：本地時間區間重疊檢查（同學生）。
- 進階（旗標）：`USE_GCAL=true` 時追加 `freebusy.query` 做二次確認。
- 決策：有任一層判定衝突即回覆衝突選項（覆蓋/改時間等）。

### 4) 修改/取消（單次/整串/未來）
- 單次課：直接 `events.patch/delete`（有 `gcalEventId`）。
- 重複課：
  - 全部：針對 recurring 主事件操作。
  - 單次例外：使用 `instances` 找到具體實例，新增/刪除例外事件。
  - Firestore 與 GCal 同步更新；失敗則記錄重試。

---

- 行為旗標：
  - `USE_GCAL=true|false`：是否啟用 GCal 參與（鏡像/校對）。
  - `GCAL_FALLBACK_FIREBASE=true|false`：GCal 失敗是否回退。
  - `ENABLE_LOCAL_RECURRING_EXPAND=true|false`：本地 RRULE 展開。
- GCal 設定：
  - `G_CALENDAR_ID_DEFAULT`：預設 calendarId（先用單一行事曆）。
  - `GOOGLE_SERVICE_ACCOUNT_JSON`：SA JSON 內容。
  - `TZ_DEFAULT=Asia/Taipei`：時區（亦可在程式常數）。

---

## 失敗與回退策略
- 分類與處置：
  - 認證/權限錯誤：回退 + 報警（需檢查 SA 與 Calendar 分享）。
  - 配額/速率限制：退避重試（指數回退），回退展示現有資料。
  - 網路/超時：退避重試，回退。
  - 資料對齊失敗（eventId 遺失/對不上）：比對 `extendedProperties.private.courseId` 回補；必要時重建。
- 使用者體驗：
  - 查詢永不報 500；最差顯示 Firebase 單次課（並提示稍後更新）。

---

## 觀測與報表
- 結構化日誌（NDJSON）：`userId`, `traceId`, `intent`, `status`, `errorCode`, `latencyMs`, `gcalOp`（insert/list/freeBusy）
- Render 日誌工具沿用（range/summary）；增加 GCal 相關關鍵字過濾。
- 指標：
  - 鏡像成功率、回補成功率、GCal 額外延遲（P95）、一致性比對率（GCal vs 本地）。

---

## 上線步驟與時間表（建議）
- D1–D2：
  - 憑證/權限（SA、calendar 分享）完成；打通 `events.insert/list`、`freebusy.query`。
  - 接上 `googleCalendarService`（CRUD + list + freebusy）。
- D3：
  - 查課表改走 GCal 展開；整合去重/排序/格式化。
- D4：
  - 修改/取消（單次/整串/例外）；失敗回補隊列；降級保險完備。
- D5：
  - 用例（MD→JS）與冒煙測試；調整 `@expect.code/@expect.success`。
- D6–D7：
  - 小流量灰度（`USE_GCAL=true` 但 `GCAL_FALLBACK_FIREBASE=true`），觀察後全量。

驗收門檻（任一未達則不放量）：
- 鏡像成功率 ≥ 99%
- 額外延遲（查課表）P95 < 400ms
- 一致性比（GCal vs 本地）≥ 99.9%
- 一週錯誤預算 < 0.1%

---

## 安全與權限
- 秘密管理：SA JSON 存放於環境變數/密鑰管理器，不入庫、不入版控。
- 權限最小化：僅授權目標 calendar；測試/正式分離 calendar。
- 稽核：關鍵操作（建立/修改/刪除）留存操作人、來源、對應 courseId。

---

## 風險與緩解
- GCal 不可用/高延遲：啟動回退（Firebase 單次 + 本地展開）。
- RRULE 月循環複雜：逐步落地，先支持常見規則（每月第 N 週 X）；極端規則用提示與人工補充。
- eventId 漏對：私有屬性（`extendedProperties.private`）雙向綁定，定期比對回補。

---

## 開發清單（Dev Checklist）
- [ ] 設定環境變數（SA、calendarId、旗標）
- [ ] 封裝 `googleCalendarService`（CRUD/list/freeBusy，含重試）
- [ ] `handle_query_schedule_task`：加入 GCal 查詢分支 + 回退
- [ ] 新增/修改/取消：鏡像寫入 + 回補隊列
- [ ] 測試：MD 用例補 `@expect.code/@expect.success`，跑 render/time/multi 套件
- [ ] 監控：日誌關鍵字、通過率與延遲報表

---

## 附錄：範例環境變數
```
USE_GCAL=true
GCAL_FALLBACK_FIREBASE=true
ENABLE_LOCAL_RECURRING_EXPAND=false
G_CALENDAR_ID_DEFAULT=your_calendar_id@group.calendar.google.com
GOOGLE_SERVICE_ACCOUNT_JSON={"type":"service_account","project_id":"..."}
TZ_DEFAULT=Asia/Taipei
```

---

註：目前預設「每位學生一個 calendar」。如需暫時簡化為單一 calendar，可透過 `G_CALENDAR_ID_DEFAULT` 快速切換，介面不變，僅在 `userId/studentName → calendarId` 對照層做退化處理。
