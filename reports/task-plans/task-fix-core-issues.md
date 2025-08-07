# 任務：修復 LINE 課程管理機器人核心問題（簡化版）

## 功能概述
修復測試報告中識別的4個核心問題，將系統測試通過率從50%提升至90%+

**設計原則**：最小化修復，避免過度工程化

## 技術要點
- **目標通過率**: 90%+ (從目前50% 4/8提升)
- **修復範圍**: 確認操作、unknown意圖、查詢邏輯
- **實施策略**: 2階段實施，專注核心問題
- **代碼量**: 預計 ~100 行（vs 原方案 500+ 行）

## 實施任務清單

### Phase 1: 核心修復 (目標: 90%+ 7-8/8)
解決根本問題，預計 1 天完成

- [ ] **1. 修復確認操作上下文管理**
  - [ ] 1.1 修改 parseIntent.js 檢查期待輸入狀態
  - [ ] 1.2 修改任務函式設置確認狀態（簡化版）
  - [ ] 1.3 測試確認操作流程

- [ ] **2. 創建 unknown 意圖處理器**
  - [ ] 2.1 創建 handle_unknown_task.js
  - [ ] 2.2 修改 webhook.js 調用處理器
  - [ ] 2.3 測試 unknown 回應

- [ ] **3. 修復查詢邏輯（簡化版）**
  - [ ] 3.1 修改預設時間範圍 'today' → 'week'
  - [ ] 3.2 測試查詢結果

### Phase 2: 驗證與穩定化 (目標: 穩定運行)
確保修復穩定，預計 0.5 天完成

- [ ] **4. 回歸測試**
  - [ ] 4.1 運行完整測試套件
  - [ ] 4.2 驗證通過率達到90%+
  - [ ] 4.3 性能基線測試

---

## 詳細實施規格

### 任務 1.1: 修改 parseIntent.js 檢查期待輸入狀態

**文件**: `/src/intent/parseIntent.js`

**具體修改**:
在現有邏輯中增加確認關鍵詞檢測：

```javascript
// 在適當位置插入（約 line 231 前）
// 檢查是否為確認關鍵詞（在期待輸入狀態下）
if (userId) {
  const { getConversationManager } = require('../conversation/ConversationManager');
  const conversationManager = getConversationManager();
  
  const context = await conversationManager.getContext(userId);
  if (context?.state?.expectingInput?.includes('confirmation')) {
    const confirmKeywords = ['確認', '好', '是', 'yes', '同意', '對', 'ok', 'OK'];
    if (confirmKeywords.some(keyword => cleanMessage.toLowerCase().includes(keyword.toLowerCase()))) {
      console.log('✅ 檢測到確認關鍵詞:', cleanMessage);
      return 'confirm_action';
    }
  }
}
```

**驗證標準**: 在有上下文的情況下，輸入「確認」能識別為 confirm_action

---

### 任務 1.2: 修改任務函式設置確認狀態（簡化版）

**受影響文件**:
- `/src/tasks/handle_add_course_task.js`
- `/src/tasks/handle_query_schedule_task.js`

**具體修改**:
在任務成功後直接設置期待輸入狀態：

```javascript
// 在 return 語句前添加
// 設定期待確認狀態（簡化版）
if (result.success && result.quickReply) {
  const { getConversationManager } = require('../conversation/ConversationManager');
  const conversationManager = getConversationManager();
  
  const context = await conversationManager.getContext(userId);
  context.state.expectingInput = ['confirmation', 'modification'];
  context.state.pendingData = {
    lastOperation: { intent, slots, result },
    timestamp: Date.now()
  };
  await conversationManager.saveContext(userId, context);
}
```

**驗證標準**: 操作成功後設置期待確認狀態

---

### 任務 2.1: 創建 handle_unknown_task.js

**文件**: `/src/tasks/handle_unknown_task.js` (新建)

```javascript
/**
 * 處理無法識別意圖的任務 - 簡化版
 */

async function handle_unknown_task(slots, userId, messageEvent = null) {
  try {
    console.log('❓ 處理無法識別的意圖');

    const helpMessage = `😊 不太理解您的意思，試試這些功能：

• 新增課程：「小明明天上午10點英文課」
• 查詢課程：「查詢小明的課表」  
• 記錄內容：「記錄昨天數學課的內容」
• 設定提醒：「設定提醒」

💡 您也可以直接告訴我想要做什麼，我會盡力幫助您！`;

    return {
      success: true,
      message: helpMessage,
      quickReply: [
        { label: '📅 新增課程', text: '新增課程' },
        { label: '📋 查詢課表', text: '查詢課表' },
        { label: '📝 記錄內容', text: '記錄內容' },
        { label: '⏰ 設定提醒', text: '設定提醒' }
      ]
    };
  } catch (error) {
    console.error('❌ 處理unknown意圖失敗:', error);
    return {
      success: false,
      message: '😅 系統暫時無法理解您的需求，請稍後再試。'
    };
  }
}

module.exports = handle_unknown_task;
```

---

### 任務 2.2: 修改 webhook.js 調用處理器

**文件**: `/src/bot/webhook.js`

**修改位置**: 替換現有的 unknown 處理邏輯

```javascript
// 替換現有 unknown 處理部分
if (intent === 'unknown') {
  const result = await executeTask('unknown', {}, userId, event);
  
  await conversationManager.recordBotResponse(userId, result.message, {
    quickReply: result.quickReply
  });

  if (result.quickReply) {
    await currentLineService.replyMessageWithQuickReply(replyToken, result.message, result.quickReply);
  } else {
    await currentLineService.replyMessage(replyToken, result.message);
  }
  return;
}
```

---

### 任務 3.1: 修改查詢邏輯預設時間範圍（簡化版）

**文件**: `/src/tasks/handle_query_schedule_task.js`

**具體修改**:
找到 calculateDateRange 調用處，修改預設值：

```javascript
// 原本：
const dateRange = calculateDateRange(
  timeReference || 'today',
  slots.specificDate
);

// 修改為：
const dateRange = calculateDateRange(
  timeReference || 'week',  // 改這一個字就夠了
  slots.specificDate
);
```

**驗證標準**: 查詢「課程」時能找到週五的重複課程

---

## 驗證方法

### 快速驗證
每個修復完成後立即測試：

```bash
# 測試確認操作
node tools/send-test-message.js "小明數學課" "確認"

# 測試unknown處理  
node tools/send-test-message.js "今天天氣如何"

# 測試查詢邏輯
node tools/send-test-message.js "小明每週五鋼琴課" "查詢課程"
```

### 完整回歸測試
```bash
node tools/test-actual-responses.js
```

---

## 成功標準

### 技術指標
- ✅ 測試通過率：50% → 90%+
- ✅ 代碼複雜度：大幅降低
- ✅ 維護成本：最小化

### 功能指標  
- ✅ 確認操作測試通過
- ✅ Unknown 意圖友善回應
- ✅ 查詢能找到週五課程

---

## 設計理念

**第一性原則**：
1. 問題根因 = 缺少上下文狀態 + 處理器缺失 + 查詢範圍太窄
2. 最簡解決 = 設置狀態 + 創建處理器 + 擴大範圍  
3. 避免過度 = 不解決不存在的問題

**實施原則**：
- 修復核心問題，不添加非必要功能
- 使用現有架構，避免大幅重構
- 保持代碼簡潔，降低維護成本

此方案將以最小的代碼變更達到最大的問題解決效果。