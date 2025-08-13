## 修改課程 v1 — 最終 Edits 清單（安全邊界版）

### 目的與原則
- 目的：提供「單次課」的時間/日期修改能力，維持 Google Calendar 與 Firebase 一致性。
- 原則：第一性原則（只解決本質問題）＋剃刀法則（最小可行、安全可驗證）。

### 功能邊界（v1）
- 支援：單次課程的時間/日期修改。
- 不支援：重複課系列（RRULE）修改。遇到系列改動，引導「取消 → 重新新增」或「停止重複課程」再新增。
- 不做部分降級：修改流程不採用 Firebase-only 降級。若 GCal 更新失敗則整體失敗（避免長期不一致）。

### 雙入口策略
1. 主入口：modify_action（優先，最安全）
   - 來源：新增課後的 Quick Reply「修改」。
   - 資料：可從對話上下文 `lastActions` / `pendingData.lastOperation` 取得最近的課程資訊。
2. 次入口：modify_course（自然語）
   - 例：「把小明數學課改到下午3點」。
   - 資訊不足則走澄清（學生/課名/日期），再執行修改。

### 資料契約
- 目標鍵（定位課程）：`userId + studentName + courseName + courseDate`
  - 若只有時間參考（今天/明天），需先轉成 `YYYY-MM-DD` 再查。
- 新值欄位（不覆蓋原值，避免混淆）
  - `scheduleTimeNew`: "15:00"
  - `courseDateNew`: "2025-08-16"
  - `courseNameNew`: "英文課"
- 事件 summary 規範（保持一致）：`[${userId}] ${studentName} - ${courseName}`

### 執行流程（v1）
1) 定位目標課程
   - modify_action：從 `ConversationManager.getContext(userId)` 的 `state.lastActions` 或 `pendingData.lastOperation` 取得最近 `add_course` 結果。
   - modify_course：若上下文不足，使用 `firebaseService.findCourse(userId, studentName, courseName, courseDate)`。
   - 若 `courseDate` 為時間參考（今天/明天），轉成 `YYYY-MM-DD` 後再查。
   - 找不到 → 回覆澄清文案，要求最小必要鍵（學生/課名/日期）。

2) 驗證非重複課
   - 若 `course.isRecurring === true`（或語句顯示為系列），回覆：
     - 「重複課程請使用『取消 → 重新新增』方式修改」，結束流程。

3) 自癒（calendar）
   - 呼叫既有自癒流程（與新增課一致）：
     - 缺 `calendarId` → 建新日曆並回寫。
     - `verifyCalendarAccess` 不可訪問 → 重建並回寫。

4) 準備新值
   - `newScheduleTime = slots.scheduleTimeNew || course.scheduleTime`
   - `newCourseDate = slots.courseDateNew || course.courseDate`
   - `newCourseName = slots.courseNameNew || course.courseName`
   - 過去時間檢查（僅非歷史調整）：若新時間在當前時間之前 → 回覆錯誤並結束。

5) 衝突檢查（必做）
   - `googleCalendarService.checkConflict(student.calendarId, newCourseDate, newScheduleTime)`
   - 有衝突 → 列表化衝突資訊並回覆，請用戶換時間。

6) 更新 Google Calendar（先 GCal）
   - `start = buildDateTime(newCourseDate, newScheduleTime)`，`end = addHours(start, 1)`
   - 若課名變更，重建 summary：`[${userId}] ${studentName} - ${newCourseName}`
   - `updateEvent(calendarId, calendarEventId, { start, end, summary? })`
   - 若 GCal 失敗 → 回覆 SYSTEM_ERROR（不寫入 Firebase）。

7) 更新 Firebase（後寫）
   - 使用通用更新：
     - `updateDocument('courses', courseId, { courseDate: newCourseDate, scheduleTime: newScheduleTime, ...(slots.courseNameNew && { courseName: newCourseName }) })`
   - 或使用薄封裝 `updateCourse(courseId, updateData)`（內部仍呼叫 `updateDocument`）。

8) 成功訊息（格式對齊新增課）
   - 顯示新日期與時間，時間中文格式（上午/下午）與新增課一致。

### 錯誤碼（精簡版）
- VALIDATION_ERROR：缺必要資料、時間在過去、重複課程不支援等。
- CONFLICT_ERROR：時間衝突（附清單）。
- SYSTEM_ERROR：外部服務錯誤（如 GCal 更新失敗）。

### 邊界處理
- 上下文過期：`lastActions` 不存在/過期 → fallback 到 `findCourse(...)`；仍找不到則請澄清。
- 多筆候選：不猜測，最多列 3–5 筆候選請用戶選擇。
- `courseDate` 為 null：不允許「跨日」推導；若只改時間、日期留當日（僅在既有 `courseDate` 存在時）。
- 跨日（23:00 → 01:00）：不自動換日；需給新日期或時間參考詞。
- 重複課：一律拒絕，改以「取消 → 重建」引導。

### 需編輯的檔案與變更點
- `src/tasks/handle_modify_course_task.js`
  - 用上述流程取代 placeholder，維持簽名：`async (slots, userId, event?)`。
  - 使用既有服務：`firebaseService`、`googleCalendarService`、`ConversationManager`。
  - 回傳物件包含：`{ success, message, code? }`，錯誤碼採精簡版。

- `src/services/firebaseService.js`（可選，提升可讀性）
  - 新增：
    - `async function updateCourse(courseId, updateData) { /* 內部呼叫 updateDocument('courses', ...) 並補 updatedAt */ }`

- `src/tasks/index.js`
  - 確認映射：`modify_course: handle_modify_course_task`（無需修改若已存在）。

- Phase 2 時再改：`src/intent/extractSlots.js`
  - 於 `modify_course` 意圖萃取：`scheduleTimeNew`、`courseDateNew`、`courseNameNew`（不覆蓋原值）。

### 驗收條件（AC）
- 能成功修改單次課的時間或日期（modify_action、modify_course 皆可）。
- 有衝突時不覆蓋，回傳清晰的衝突清單。
- 重複課修改請求會被友善拒絕並引導「取消 → 重建」。
- GCal 失敗時整體失敗（不做 Firebase-only），回覆 SYSTEM_ERROR。
- 成功訊息與新增課訊息格式一致（時間中文格式）。

### 測試清單（最小集）
1. modify_action 修改時間：新增後按「修改」→ 改到另一時段 → 成功。
2. modify_action 修改日期：改成明天 → 成功。
3. modify_course 自然語：句子同時帶學生/課名/日期/時間 → 成功。
4. 衝突攔截：新時間與既有課程衝突 → 列清單、不中斷流程。
5. 重複課阻擋：系列課修改 → 直接拒絕並引導。
6. GCal 失敗：模擬更新失敗 → SYSTEM_ERROR（不寫 Firebase）。

### 回滾方案
- 僅涉及：`handle_modify_course_task.js` 與（可選）`firebaseService.updateCourse()` 薄封裝。
- 回滾步驟：
  - 邏輯回退：還原 `handle_modify_course_task.js` 為 placeholder。
  - API 回退：移除 `updateCourse()`，改回 `updateDocument()` 呼叫。
- 不影響其它意圖與既有功能。

### 提交指引（繁中）
- 建議提交訊息：
  - 標題：「新增單次課修改功能（v1）：modify_action 優先，含衝突檢查與自癒，嚴格一致性」
  - 內容：
    - 說明雙入口策略與不支援重複課。
    - 錯誤碼精簡（VALIDATION/CONFLICT/SYSTEM）。
    - 說明不採 Firebase-only 降級、維持一致性。
    - 附 AC 與測試清單摘要。
