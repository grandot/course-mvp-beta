# 任務：Render 測試通過率修復 (75% → 95%+)

## 🎯 任務概述

**目標**：修復意圖處理器映射缺失問題，將 Render 測試通過率從 75% 提升至 95%+ 

**核心問題**：補充意圖和修改意圖的處理器函式已完整實現，但在任務分發對應表中缺失映射，導致系統回覆「不支援該功能」

**預期效果**：
- 補充意圖 (supplement_*) 正常處理缺失資訊
- 修改意圖 (modify_course) 正常執行課程修改
- 多輪對話流程完整可用
- 通過率提升至 95%+

## 📊 問題詳細分析

### 1. 已確認的缺失映射

| 意圖名稱 | 處理器函式 | 狀態 |
|---------|-----------|------|
| `supplement_student_name` | `handle_supplement_student_name_task` | ✅ 已實現，❌ 未註冊 |
| `supplement_course_name` | `handle_supplement_course_name_task` | ✅ 已實現，❌ 未註冊 |
| `supplement_schedule_time` | `handle_supplement_schedule_time_task` | ✅ 已實現，❌ 未註冊 |
| `supplement_course_date` | `handle_supplement_course_date_task` | ✅ 已實現，❌ 未註冊 |
| `supplement_day_of_week` | `handle_supplement_day_of_week_task` | ✅ 已實現，❌ 未註冊 |
| `modify_course` | `handle_modify_action_task` | ✅ 已實現，❌ 未註冊 |

### 2. 根本原因分析

**技術原因**：
- `src/tasks/handle_supplement_input_task.js` 包含完整的 5 個補充處理器函式
- `src/tasks/handle_modify_action_task.js` 存在修改課程功能
- `src/tasks/index.js` 的 `taskHandlers` 對應表未註冊這些意圖映射

**業務影響**：
- 用戶嘗試補充缺失資訊時得到「不支援該功能」回覆
- 多輪對話流程中斷，無法完成任務
- 課程修改功能無法使用
- 整體用戶體驗嚴重受損

## 🔧 修復步驟

### 步驟 1：註冊補充意圖處理器

**文件**：`src/tasks/index.js`

**操作**：在文件頂部的 require 區域添加補充處理器導入：

```javascript
// 補充資訊處理器（多輪對話功能）
const {
  handle_supplement_student_name_task,
  handle_supplement_course_name_task,
  handle_supplement_schedule_time_task,
  handle_supplement_course_date_task,
  handle_supplement_day_of_week_task
} = require('./handle_supplement_input_task');
```

### 步驟 2：更新任務處理器對應表

**文件**：`src/tasks/index.js`

**操作**：在 `taskHandlers` 物件中添加補充意圖映射：

```javascript
const taskHandlers = {
  // 現有映射保持不變...
  
  // 補充資訊意圖（多輪對話功能）
  supplement_student_name: handle_supplement_student_name_task,
  supplement_course_name: handle_supplement_course_name_task,
  supplement_schedule_time: handle_supplement_schedule_time_task,
  supplement_course_date: handle_supplement_course_date_task,
  supplement_day_of_week: handle_supplement_day_of_week_task,
  
  // 修改課程意圖
  modify_course: handle_modify_action_task,
};
```

### 步驟 3：更新模組導出

**文件**：`src/tasks/index.js`

**操作**：在 `module.exports` 中添加補充處理器的導出：

```javascript
module.exports = {
  // 現有導出保持不變...
  
  // 補充資訊處理器
  handle_supplement_student_name_task,
  handle_supplement_course_name_task,
  handle_supplement_schedule_time_task,
  handle_supplement_course_date_task,
  handle_supplement_day_of_week_task,
};
```

### 步驟 4：驗證修復完整性

**驗證命令**：
```bash
# 檢查語法正確性
node -c src/tasks/index.js

# 測試意圖映射
node -e "console.log(Object.keys(require('./src/tasks/index.js').taskHandlers))"

# 運行特定補充意圖測試
node tools/test-supplement-input.js

# 運行完整 Render 測試
node tools/test-render.js
```

## 📋 完整代碼修改

### src/tasks/index.js (完整修改後的版本)

```javascript
/**
 * 任務處理器索引檔案
 * 統一匯出所有任務處理器函式
 */

const handle_add_course_task = require('./handle_add_course_task');
const handle_query_schedule_task = require('./handle_query_schedule_task');
const handle_record_content_task = require('./handle_record_content_task');
const handle_set_reminder_task = require('./handle_set_reminder_task');
const handle_cancel_course_task = require('./handle_cancel_course_task');

// 操作性意圖處理器（多輪對話功能）
const handle_confirm_action_task = require('./handle_confirm_action_task');
const handle_modify_action_task = require('./handle_modify_action_task');
const handle_cancel_action_task = require('./handle_cancel_action_task');
const handle_restart_input_task = require('./handle_restart_input_task');

// 補充資訊處理器（多輪對話功能）
const {
  handle_supplement_student_name_task,
  handle_supplement_course_name_task,
  handle_supplement_schedule_time_task,
  handle_supplement_course_date_task,
  handle_supplement_day_of_week_task
} = require('./handle_supplement_input_task');

/**
 * 任務處理器對應表
 * 意圖名稱 -> 處理器函式的映射
 */
const taskHandlers = {
  // 課程管理
  add_course: handle_add_course_task,
  create_recurring_course: handle_add_course_task, // 重複課程使用相同處理器
  query_schedule: handle_query_schedule_task,
  cancel_course: handle_cancel_course_task,
  stop_recurring_course: handle_cancel_course_task, // 停止重複課程使用相同處理器

  // 內容記錄
  record_content: handle_record_content_task,
  add_course_content: handle_record_content_task, // 內容記錄使用相同處理器

  // 提醒設定
  set_reminder: handle_set_reminder_task,

  // 操作性意圖（多輪對話功能）
  confirm_action: handle_confirm_action_task,
  modify_action: handle_modify_action_task,
  cancel_action: handle_cancel_action_task,
  restart_input: handle_restart_input_task,
  
  // 修改課程意圖
  modify_course: handle_modify_action_task,
  
  // 補充資訊意圖（多輪對話功能）
  supplement_student_name: handle_supplement_student_name_task,
  supplement_course_name: handle_supplement_course_name_task,
  supplement_schedule_time: handle_supplement_schedule_time_task,
  supplement_course_date: handle_supplement_course_date_task,
  supplement_day_of_week: handle_supplement_day_of_week_task,
};

/**
 * 根據意圖名稱取得對應的任務處理器
 * @param {string} intent - 意圖名稱
 * @returns {Function|null} 任務處理器函式
 */
function getTaskHandler(intent) {
  const handler = taskHandlers[intent];
  if (!handler) {
    console.log(`⚠️ 找不到意圖 "${intent}" 的任務處理器`);
    return null;
  }
  return handler;
}

/**
 * 執行任務處理器
 * @param {string} intent - 意圖名稱
 * @param {Object} slots - 提取的槽位資料
 * @param {string} userId - LINE 用戶ID
 * @returns {Object} 處理結果 { success: boolean, message: string }
 */
async function executeTask(intent, slots, userId) {
  try {
    const handler = getTaskHandler(intent);
    if (!handler) {
      return {
        success: false,
        message: `❌ 目前不支援「${intent}」功能，請稍後再試`,
      };
    }

    console.log(`🎯 執行任務: ${intent}`);
    const result = await handler(slots, userId);

    console.log('📊 任務執行結果:', result);
    return result;
  } catch (error) {
    console.error(`❌ 任務執行異常 (${intent}):`, error);
    return {
      success: false,
      message: '❌ 系統處理異常，請稍後再試',
    };
  }
}

/**
 * 取得所有支援的意圖列表
 * @returns {Array} 意圖名稱陣列
 */
function getSupportedIntents() {
  return Object.keys(taskHandlers);
}

module.exports = {
  // 核心函式
  getTaskHandler,
  executeTask,
  getSupportedIntents,

  // 任務處理器對應表
  taskHandlers,

  // 個別處理器（供直接引用）
  handle_add_course_task,
  handle_query_schedule_task,
  handle_record_content_task,
  handle_set_reminder_task,
  handle_cancel_course_task,

  // 操作性意圖處理器
  handle_confirm_action_task,
  handle_modify_action_task,
  handle_cancel_action_task,
  handle_restart_input_task,
  
  // 補充資訊處理器
  handle_supplement_student_name_task,
  handle_supplement_course_name_task,
  handle_supplement_schedule_time_task,
  handle_supplement_course_date_task,
  handle_supplement_day_of_week_task,
};
```

## 🎯 預期修復效果

### 修復前現象
- 用戶：「小明」（補充學生姓名）
- 系統：「❌ 目前不支援 supplement_student_name 功能，請稍後再試」

### 修復後效果
- 用戶：「小明」（補充學生姓名）
- 系統：「好的，已為小明安排數學課，時間是每週三下午2:00」✅

### 核心功能恢復
1. **多輪對話補充**：用戶可正常補充缺失的學生姓名、課程名稱、時間等資訊
2. **課程修改**：用戶可正常修改已安排的課程
3. **對話流程完整**：從意圖識別到任務執行的完整流程正常運作
4. **錯誤提示優化**：用戶不再看到「不支援該功能」的困惑訊息

## ⚠️ 風險評估

### 低風險修改
- **修改性質**：僅添加映射註冊，不修改現有邏輯
- **向下相容**：完全向下相容，不影響現有功能
- **範圍可控**：僅涉及 1 個文件的映射表更新

### 潛在風險點
1. **語法錯誤**：require 路徑或物件結構錯誤
   - **緩解措施**：修改前先備份，修改後語法檢查
2. **處理器衝突**：新增意圖與現有意圖衝突
   - **緩解措施**：確認映射表中無重複key
3. **依賴問題**：補充處理器依賴其他模組
   - **緩解措施**：處理器函式已驗證可正常運行

### 回滾方案
如果修復後出現問題：
1. **立即回滾**：還原 `src/tasks/index.js` 至修改前版本
2. **快速部署**：重新部署至 Render
3. **日誌分析**：檢查錯誤日誌確定問題原因

## 🧪 測試計劃

### 1. 語法驗證
```bash
# 語法檢查
node -c src/tasks/index.js

# 模組載入測試
node -e "console.log('意圖數量:', Object.keys(require('./src/tasks').taskHandlers).length)"
```

### 2. 功能驗證
```bash
# 補充意圖測試
node tools/test-supplement-input.js

# 修改意圖測試  
node tools/send-test-message.js "修改小明的數學課時間"

# 完整流程測試
node tools/test-multi-turn-dialogue.js
```

### 3. Render 部署測試
```bash
# Render 環境測試
node tools/test-render.js

# 完整回歸測試
node tools/run-all-tests.js
```

### 4. 通過率驗證
- **目標**：95%+ 通過率
- **關鍵測試案例**：補充學生姓名、修改課程時間、完整多輪對話
- **驗證指標**：原本失敗的補充意圖測試案例全部通過

## ✅ 完成標準

### 技術標準
- [ ] `src/tasks/index.js` 成功添加 6 個意圖映射
- [ ] 語法檢查通過，無錯誤和警告
- [ ] 模組載入測試成功
- [ ] 補充處理器函式可正常調用

### 業務標準
- [ ] 補充學生姓名功能正常工作
- [ ] 補充課程時間功能正常工作  
- [ ] 修改課程功能正常工作
- [ ] 多輪對話流程完整可用
- [ ] Render 測試通過率達到 95%+

### 用戶體驗標準
- [ ] 用戶不再看到「不支援該功能」錯誤
- [ ] 對話流程自然順暢
- [ ] 補充資訊後能立即完成任務
- [ ] 錯誤提示清晰有意義

## 🚀 下一步建議

修復完成後建議：

1. **立即部署**：將修復推送至 Render 生產環境
2. **監控測試**：密切監控 24 小時內的系統表現
3. **用戶回饋**：收集用戶對多輪對話功能的使用回饋
4. **效能分析**：分析修復後的通過率提升幅度
5. **文檔更新**：更新相關技術文檔，記錄此次修復

---

**任務負責人**：技術團隊  
**預計完成時間**：1 小時（單純映射註冊修改）  
**優先級**：緊急（直接影響核心功能可用性）  
**影響範圍**：多輪對話、課程修改、補充資訊等核心功能