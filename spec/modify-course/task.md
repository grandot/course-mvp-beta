## 修改課程 v1 — 精準 Edits 片段草稿（不直接改碼）

> 目的：提供每個檔案的「具體編輯片段草稿」，作為實作對照用。實作時請依序套用，並保持既有程式風格與格式。

---

### 1) src/tasks/handle_modify_course_task.js

- 目的：用「單次課 reschedule」邏輯取代 placeholder，支援雙入口（modify_action / modify_course）。
- 需引入（檔頭區）：
```js
const firebaseService = require('../services/firebaseService');
const googleCalendarService = require('../services/googleCalendarService');
const { getConversationManager } = require('../conversation/ConversationManager');
```
- 主函式骨架（保留簽名）：
```js
async function handle_modify_course_task(slots, userId, event) {
  // 1) 目標課程定位（優先上下文，fallback DB）
  const conversationManager = getConversationManager();
  const ctx = await conversationManager.getContext(userId).catch(() => null);
  let course = null;
  if (ctx && ctx.state && (ctx.state.lastActions || ctx.state.pendingData)) {
    // 從最近 add_course 操作取目標
    const last = ctx.state.lastActions && Object.values(ctx.state.lastActions).sort((a,b) => b.timestamp - a.timestamp)[0];
    const op = last || (ctx.state.pendingData && ctx.state.pendingData.lastOperation) || null;
    if (op && op.intent === 'add_course' && op.slots) {
      const s = op.slots;
      course = await firebaseService.findCourse(userId, s.studentName, s.courseName, s.courseDate);
    }
  }
  if (!course && slots && slots.studentName && slots.courseName) {
    // timeReference → YYYY-MM-DD（若必要）
    const courseDate = slots.courseDate || toYmdFromReference(slots.timeReference);
    course = await firebaseService.findCourse(userId, slots.studentName, slots.courseName, courseDate);
  }
  if (!course) {
    return { success: false, code: 'VALIDATION_ERROR', message: '❓ 請提供學生、課程與日期，以便定位要修改的課程' };
  }

  // 2) 驗證非重複課
  if (course.isRecurring) {
    return { success: false, code: 'VALIDATION_ERROR', message: '🔄 重複課程請使用「取消 → 重新新增」進行修改' };
  }

  // 3) 自癒 calendarId / 存取
  const student = await ensureStudentCalendarSafe(userId, course.studentName);

  // 4) 準備新值與合法性檢查
  const newCourseDate = slots.courseDateNew || course.courseDate;
  const newScheduleTime = slots.scheduleTimeNew || course.scheduleTime;
  if (isPastTime(newCourseDate, newScheduleTime)) {
    return { success: false, code: 'VALIDATION_ERROR', message: '❌ 新時間早於現在，請提供未來時間' };
  }

  // 5) 衝突檢查（必做）
  const conflict = await googleCalendarService.checkConflict(student.calendarId, newCourseDate, newScheduleTime);
  if (conflict && conflict.hasConflict) {
    const list = (conflict.conflicts || []).map(c => `• ${c.summary} (${fmtHm(c.start)})`).join('\n');
    return { success: false, code: 'CONFLICT_ERROR', message: `⚠️ 時間衝突\n\n${newCourseDate} ${newScheduleTime} 已有：\n${list}\n\n請換一個時間再試。` };
  }

  // 6) 更新 Google Calendar（先 GCal, 後 Firebase）
  const start = googleCalendarService.buildDateTime(newCourseDate, newScheduleTime);
  const end = googleCalendarService.addHours(start, 1);
  const summary = buildEventSummary(userId, course.studentName, slots.courseNameNew || course.courseName);
  try {
    await googleCalendarService.updateEvent(course.calendarId || student.calendarId, course.calendarEventId, { start: { dateTime: start, timeZone: 'Asia/Taipei' }, end: { dateTime: end, timeZone: 'Asia/Taipei' }, summary });
  } catch (e) {
    return { success: false, code: 'SYSTEM_ERROR', message: '❌ 日曆更新失敗，請稍後再試' };
  }

  // 7) 更新 Firebase（與 GCal 對齊）
  const updateData = { courseDate: newCourseDate, scheduleTime: newScheduleTime };
  if (slots.courseNameNew) updateData.courseName = slots.courseNameNew;
  await firebaseService.updateDocument('courses', course.courseId, updateData);

  // 8) 成功訊息（沿用新增課格式的中文時間）
  const timeDisplay = toZhTime(newScheduleTime);
  const msgLines = [
    '✅ 課程已更新！',
    `👦 學生：${course.studentName}`,
    `📚 課程：${updateData.courseName || course.courseName}`,
    `📅 日期：${newCourseDate}`,
    `🕐 時間：${timeDisplay}`,
  ];
  return { success: true, message: msgLines.join('\n') };
}
```
- 輔助函式片段（置於同檔案底部或提取 utils；保持專案既有格式）：
```js
function toYmdFromReference(ref) { /* today/tomorrow → YYYY-MM-DD（對齊 extractSlots 的規則） */ }
function isPastTime(ymd, hm) { /* 非重複課：若 ymd+hm < now → true */ }
function fmtHm(isoOrDt) { /* 取 HH:MM 顯示 */ }
function toZhTime(hm) { /* 09:00 → 上午9:00；14:30 → 下午2:30（沿用新增課時間格式） */ }
async function ensureStudentCalendarSafe(userId, studentName) { /* 內部呼叫 ensureStudentCalendar（handle_add_course_task 同款邏輯） */ }
function buildEventSummary(userId, studentName, courseName) { return `[${userId}] ${studentName} - ${courseName}`; }
```

---

### 2) src/services/firebaseService.js

- 新增薄封裝（提升語義；內部仍用通用 `updateDocument`，避免 API 重疊）：
```js
async function updateCourse(courseId, updateData) {
  const data = { ...updateData };
  return updateDocument('courses', courseId, data);
}
// 匯出 updateCourse
```

- 若不想增加新函式，可直接在任務層呼叫 `updateDocument('courses', courseId, ...)`（兩者擇一）。

---

### 3) src/intent/extractSlots.js（Phase 2 再做）

- 僅在 intent === 'modify_course' 時，額外萃取「新值欄位」，不覆蓋原值：
```js
case 'modify_course': {
  // 目標定位仍依賴 studentName/courseName/courseDate（不足時轉澄清）
  const t = parseScheduleTime(message);
  if (t) slots.scheduleTimeNew = t;
  const d = parseSpecificDate(message);
  if (d) slots.courseDateNew = d;
  const cn = extractCourseName(message);
  if (cn) slots.courseNameNew = cn;
  break;
}
```

---

### 4) 錯誤碼與訊息（精簡版）
- VALIDATION_ERROR：缺學生/課程/日期、時間在過去、重複課不支援。
- CONFLICT_ERROR：時間衝突（附同日衝突清單）。
- SYSTEM_ERROR：GCal 更新失敗等外部錯誤。

訊息模板（示例）：
```text
❓ 請提供學生、課程與日期，以便定位要修改的課程
🔄 重複課程請使用「取消 → 重新新增」進行修改
⚠️ 時間衝突

2025-08-16 15:00 已有：
• 數學課 (14:00)
• 英文課 (16:00)

請換一個時間再試。
❌ 日曆更新失敗，請稍後再試
```

---

### 5) 測試建議（手動）
- modify_action：新增課後按「修改」→ 改到另一時段 → 成功訊息包含新日期與中文時間。
- modify_course：自然語包含學生/課名/日期/時間 → 成功。
- 衝突攔截：新時間與已有課衝突 → 回傳清單。
- 重複課阻擋：系列課修改 → 直接引導「取消 → 重建」。
- GCal 故障：模擬 updateEvent 抛錯 → SYSTEM_ERROR（不寫 Firebase）。

---

### 6) 回滾指引
- 僅還原 `src/tasks/handle_modify_course_task.js` 為 placeholder。
- 若新增了 `updateCourse()`，刪除之並改回 `updateDocument()`。

---

### 7) 提交建議（繁中）
- 標題：新增單次課修改功能（v1）：modify_action 優先，含衝突檢查與自癒，嚴格一致性
- 說明：
  - 邊界：不支援重複課；雙入口；不做 Firebase-only 降級。
  - 錯誤碼：VALIDATION/CONFLICT/SYSTEM。
  - AC 與測試清單摘要。
