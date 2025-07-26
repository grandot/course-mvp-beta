# 🔧 調試日誌管理文檔

## 📋 概述

本文檔記錄了 IntentOS Course MVP 系統中所有調試日誌插入點，便於開發期間快速定位問題，以及正式上線前統一移除調試信息。

## 🎯 日誌插入策略

### 📊 日誌級別定義
- **🔧 DEBUG**: 開發調試信息（上線前需移除）
- **ℹ️ INFO**: 業務流程信息（可保留）
- **⚠️ WARN**: 警告信息（保留）
- **❌ ERROR**: 錯誤信息（保留）

### 🏗️ 日誌插入原則
- **請求入口點**：記錄請求開始和結束
- **服務層邊界**：記錄跨服務調用
- **數據庫操作**：記錄 CRUD 操作
- **外部 API 調用**：記錄 OpenAI、LINE API 調用
- **異常處理點**：詳細錯誤信息
- **業務邏輯關鍵點**：重要決策和狀態變化

---

## 📁 文件級日誌插入點

### 1. 控制器層 (Controllers)

#### `/src/controllers/lineController.js`
**職責**：LINE Webhook 請求處理

| 位置 | 類型 | 當前狀態 | 日誌內容 | 移除標記 |
|------|------|----------|----------|----------|
| `handleTextMessage()` 入口 | 🔧 DEBUG | ✅ 已存在 | 接收到的用戶消息和回覆 token | `[REMOVE_ON_PROD]` |
| 語義分析結果 | 🔧 DEBUG | ✅ 已存在 | Intent、entities、confidence | `[REMOVE_ON_PROD]` |
| TaskService 執行結果 | 🔧 DEBUG | ✅ 已存在 | 完整執行結果 JSON | `[REMOVE_ON_PROD]` |
| LINE 回覆發送 | 🔧 DEBUG | ✅ 已存在 | 發送的回覆內容 | `[REMOVE_ON_PROD]` |
| `webhook()` 簽名驗證 | 🔧 DEBUG | ✅ 已存在 | 簽名驗證詳細過程 | `[REMOVE_ON_PROD]` |
| 異常捕獲 | ❌ ERROR | ✅ 已存在 | 錯誤堆疊和詳細信息 | **保留** |

**建議新增**：
```javascript
// 在 handleTextMessage() 開始
console.log(`🔧 [DEBUG] 開始處理文字消息 - UserID: ${userId}, Message: ${userMessage}`);

// 在回覆發送後
console.log(`🔧 [DEBUG] 回覆發送完成 - Success: ${replyResult.success}`);
```

### 2. 任務服務層 (Task Service)

#### `/src/services/taskService.js`
**職責**：業務邏輯協調

| 位置 | 類型 | 當前狀態 | 日誌內容 | 移除標記 |
|------|------|----------|----------|----------|
| `executeIntent()` 入口 | 🔧 DEBUG | ❌ 缺失 | Intent 類型和實體信息 | `[REMOVE_ON_PROD]` |
| 各個 handler 入口 | 🔧 DEBUG | ❌ 缺失 | 處理開始和參數信息 | `[REMOVE_ON_PROD]` |
| 業務邏輯執行結果 | 🔧 DEBUG | ❌ 缺失 | 每個步驟的執行結果 | `[REMOVE_ON_PROD]` |
| 異常捕獲 | ❌ ERROR | ✅ 已存在 | 基本錯誤信息 | **保留** |

**建議新增**：
```javascript
// executeIntent() 開始
console.log(`🔧 [DEBUG] TaskService.executeIntent - Intent: ${intent}, UserId: ${userId}`);
console.log(`🔧 [DEBUG] TaskService.executeIntent - Entities:`, entities);

// 每個 handler 開始
console.log(`🔧 [DEBUG] TaskService.handleRecordCourse - 開始處理新增課程`);

// 執行結果
console.log(`🔧 [DEBUG] TaskService.executeIntent - 執行完成:`, result);
```

### 3. 語義服務層 (Semantic Service)

#### `/src/services/semanticService.js`
**職責**：自然語言理解

| 位置 | 類型 | 當前狀態 | 日誌內容 | 移除標記 |
|------|------|----------|----------|----------|
| `analyzeMessage()` 入口 | 🔧 DEBUG | ❌ 缺失 | 分析開始和用戶輸入 | `[REMOVE_ON_PROD]` |
| 規則引擎結果 | 🔧 DEBUG | ❌ 缺失 | 規則匹配結果 | `[REMOVE_ON_PROD]` |
| OpenAI API 調用 | 🔧 DEBUG | ❌ 缺失 | AI 分析請求和回應 | `[REMOVE_ON_PROD]` |
| 實體提取結果 | 🔧 DEBUG | ❌ 缺失 | 提取到的課程名稱、時間等 | `[REMOVE_ON_PROD]` |
| 時間解析失敗 | ⚠️ WARN | ✅ 已存在 | 時間解析警告 | **保留** |

**建議新增**：
```javascript
// analyzeMessage() 開始
console.log(`🔧 [DEBUG] SemanticService.analyzeMessage - 開始分析: "${text}"`);

// 規則引擎結果
console.log(`🔧 [DEBUG] SemanticService - 規則引擎結果:`, ruleResult);

// AI 分析結果
console.log(`🔧 [DEBUG] SemanticService - AI 分析結果:`, aiResult);

// 最終實體提取
console.log(`🔧 [DEBUG] SemanticService - 實體提取完成:`, entities);
```

### 4. 課程服務層 (Course Service)

#### `/src/services/courseService.js`
**職責**：課程業務邏輯

| 位置 | 類型 | 當前狀態 | 日誌內容 | 移除標記 |
|------|------|----------|----------|----------|
| `modifyCourse()` 詳細調試 | 🔧 DEBUG | ✅ 已存在 | 完整修改流程 | `[REMOVE_ON_PROD]` |
| `createCourse()` 參數 | 🔧 DEBUG | ❌ 缺失 | 創建課程參數 | `[REMOVE_ON_PROD]` |
| `deleteCourse()` 操作 | 🔧 DEBUG | ❌ 缺失 | 刪除課程操作 | `[REMOVE_ON_PROD]` |
| 時間衝突檢查 | 🔧 DEBUG | ✅ 已存在 | 衝突檢查結果 | `[REMOVE_ON_PROD]` |
| 異常處理 | ❌ ERROR | ✅ 已存在 | 詳細錯誤信息 | **保留** |

**建議新增**：
```javascript
// createCourse() 開始
console.log(`🔧 [DEBUG] CourseService.createCourse - 參數:`, {
  studentId, courseName, scheduleTime, courseDate, options
});

// 成功創建
console.log(`🔧 [DEBUG] CourseService.createCourse - 創建成功: ${result.courseId}`);
```

### 5. 數據服務層 (Data Service)

#### `/src/services/dataService.js`
**職責**：數據存取統一入口

| 位置 | 類型 | 當前狀態 | 日誌內容 | 移除標記 |
|------|------|----------|----------|----------|
| `updateCourse()` 調試 | 🔧 DEBUG | ✅ 已存在 | 完整更新流程 | `[REMOVE_ON_PROD]` |
| `queryCourses()` 調試 | 🔧 DEBUG | ✅ 已存在 | 查詢條件和結果 | `[REMOVE_ON_PROD]` |
| `getCourseById()` 調試 | 🔧 DEBUG | ✅ 已存在 | 課程查找過程 | `[REMOVE_ON_PROD]` |
| `createCourse()` 調試 | 🔧 DEBUG | ❌ 缺失 | 課程創建過程 | `[REMOVE_ON_PROD]` |
| `deleteCourse()` 調試 | 🔧 DEBUG | ❌ 缺失 | 課程刪除過程 | `[REMOVE_ON_PROD]` |
| 異常處理 | ❌ ERROR | ✅ 已存在 | 數據庫操作錯誤 | **保留** |

**建議新增**：
```javascript
// createCourse() 調試
console.log(`🔧 [DEBUG] DataService.createCourse - 輸入:`, courseData);
console.log(`🔧 [DEBUG] DataService.createCourse - 結果:`, result);

// deleteCourse() 調試
console.log(`🔧 [DEBUG] DataService.deleteCourse - CourseId: ${courseId}`);
```

### 6. Firebase 服務層 (Firebase Service)

#### `/src/internal/firebaseService.js`
**職責**：數據庫操作實現

| 位置 | 類型 | 當前狀態 | 日誌內容 | 移除標記 |
|------|------|----------|----------|----------|
| Firebase 初始化 | ℹ️ INFO | ✅ 已存在 | 初始化成功信息 | **保留** |
| 文檔操作錯誤 | ❌ ERROR | ✅ 已存在 | 數據庫操作錯誤 | **保留** |
| CRUD 操作調試 | 🔧 DEBUG | ❌ 缺失 | 每個操作的詳細信息 | `[REMOVE_ON_PROD]` |

**建議新增**：
```javascript
// 所有操作開始前
console.log(`🔧 [DEBUG] FirebaseService.${operation} - Collection: ${collection}, DocId: ${docId}`);

// 操作完成後
console.log(`🔧 [DEBUG] FirebaseService.${operation} - 操作完成: ${success}`);
```

### 7. OpenAI 服務層 (OpenAI Service)

#### `/src/internal/openaiService.js`
**職責**：AI 語義理解

| 位置 | 類型 | 當前狀態 | 日誌內容 | 移除標記 |
|------|------|----------|----------|----------|
| API 調用失敗回退 | ⚠️ WARN | ✅ 已存在 | API 失敗警告 | **保留** |
| AI 分析請求 | 🔧 DEBUG | ❌ 缺失 | 發送的 prompt 和參數 | `[REMOVE_ON_PROD]` |
| AI 回應處理 | 🔧 DEBUG | ❌ 缺失 | 接收的回應和解析結果 | `[REMOVE_ON_PROD]` |
| Token 使用統計 | ℹ️ INFO | ❌ 缺失 | Token 消耗統計 | **保留** |

**建議新增**：
```javascript
// API 調用開始
console.log(`🔧 [DEBUG] OpenAI API 調用 - Model: ${model}, MaxTokens: ${maxTokens}`);
console.log(`🔧 [DEBUG] OpenAI Prompt:`, prompt);

// API 回應
console.log(`🔧 [DEBUG] OpenAI 回應 - Tokens: ${usage.total_tokens}, Content:`, content);
```

### 8. 時間服務層 (Time Service)

#### `/src/services/timeService.js`
**職責**：時間處理統一入口

| 位置 | 類型 | 當前狀態 | 日誌內容 | 移除標記 |
|------|------|----------|----------|----------|
| 時間解析失敗 | ⚠️ WARN | ❌ 缺失 | 無法解析的時間格式 | **保留** |
| 時間解析調試 | 🔧 DEBUG | ❌ 缺失 | 解析過程詳細信息 | `[REMOVE_ON_PROD]` |

**建議新增**：
```javascript
// parseTimeString() 調試
console.log(`🔧 [DEBUG] TimeService.parseTimeString - 輸入: "${timeString}"`);
console.log(`🔧 [DEBUG] TimeService.parseTimeString - 解析結果:`, result);

// parseTimeComponent() 調試
console.log(`🔧 [DEBUG] TimeService.parseTimeComponent - 組件解析:`, {hour, minute});
```

---

## 🎯 LINE Bot 回覆中的日誌插入策略

### 📱 回覆消息增強

在 `lineController.js` 的回覆消息中添加簡化日誌信息：

#### 成功回覆格式
```javascript
// 開發模式回覆格式
const debugInfo = process.env.NODE_ENV === 'development' ? 
  `\n\n🔧 [DEBUG]\nIntent: ${intent} (${confidence})\nEntities: ${JSON.stringify(entities, null, 2)}\nExecution: ${result.success ? '✅' : '❌'}` : '';

replyMessage = `${baseReplyMessage}${debugInfo}`;
```

#### 錯誤回覆格式
```javascript
// 開發模式錯誤回覆格式
const errorDebugInfo = process.env.NODE_ENV === 'development' ? 
  `\n\n❌ [ERROR]\nType: ${error.name || 'Unknown'}\nMessage: ${error.message}\nStep: ${currentStep}` : '';

replyMessage = `${userFriendlyMessage}${errorDebugInfo}`;
```

### 📊 關鍵執行步驟標記

在每個主要服務的回覆中添加執行步驟標記：

```javascript
// TaskService 執行標記
const executionSteps = process.env.NODE_ENV === 'development' ? [
  `1. 語義分析: ${semanticResult.success ? '✅' : '❌'}`,
  `2. 實體提取: ${entities ? '✅' : '❌'}`,
  `3. 業務執行: ${businessResult.success ? '✅' : '❌'}`,
  `4. 數據存儲: ${saveResult.success ? '✅' : '❌'}`
].join('\n') : '';
```

---

## 🚀 實施計劃

### Phase 1: 立即實施 (高優先級日誌)
- [ ] TaskService 所有方法入口日誌
- [ ] 所有異常處理增強日誌
- [ ] LINE Bot 回覆消息調試信息
- [ ] 關鍵業務邏輯執行結果

### Phase 2: 完善實施 (中優先級日誌)
- [ ] 所有服務層邊界調用日誌
- [ ] 數據庫操作詳細日誌
- [ ] OpenAI API 調用詳細日誌
- [ ] 時間解析過程日誌

### Phase 3: 優化實施 (低優先級日誌)
- [ ] 性能監控日誌
- [ ] 用戶行為分析日誌
- [ ] 系統健康檢查日誌

---

## 📋 生產環境清理檢查清單

### 🔍 搜索和替換模式

#### 1. 移除開發調試日誌
```bash
# 搜索所有 DEBUG 標記的日誌
grep -r "🔧 \[DEBUG\]" src/
grep -r "console\.log.*🔧" src/

# 搜索所有 REMOVE_ON_PROD 標記
grep -r "\[REMOVE_ON_PROD\]" src/
```

#### 2. 保留的日誌類型
- ✅ `❌ [ERROR]` - 錯誤日誌
- ✅ `⚠️ [WARN]` - 警告日誌  
- ✅ `ℹ️ [INFO]` - 信息日誌
- ✅ Firebase 初始化成功
- ✅ 服務啟動信息

#### 3. 環境變數控制
```javascript
// 使用環境變數控制調試輸出
const DEBUG_MODE = process.env.NODE_ENV === 'development';

if (DEBUG_MODE) {
  console.log(`🔧 [DEBUG] ${message}`);
}
```

### 📝 清理腳本建議

創建自動化清理腳本：

```bash
#!/bin/bash
# scripts/remove-debug-logs.sh

echo "移除生產環境調試日誌..."

# 移除所有 DEBUG 標記的 console.log
find src/ -name "*.js" -exec sed -i '' '/🔧.*DEBUG/d' {} \;

# 移除 REMOVE_ON_PROD 標記的代碼塊
find src/ -name "*.js" -exec sed -i '' '/\[REMOVE_ON_PROD\]/d' {} \;

echo "調試日誌清理完成！"
```

---

## 📈 監控和分析

### 📊 日誌分析工具建議
- **本地開發**: Console 輸出 + 文件日誌
- **測試環境**: ELK Stack 或 Winston Logger
- **生產環境**: CloudWatch 或 Datadog

### 🎯 關鍵指標監控
- 請求處理時間
- 成功/失敗率
- OpenAI API 調用統計
- 數據庫操作性能
- 用戶行為模式

---

**⚠️ 重要提醒**：
1. 所有 `🔧 [DEBUG]` 標記的日誌都需要在生產環境移除
2. 所有 `[REMOVE_ON_PROD]` 標記的代碼都需要清理
3. 保留所有 `❌ ERROR`、`⚠️ WARN`、`ℹ️ INFO` 級別的日誌
4. 使用環境變數控制調試輸出的開關

**更新時間**: 2025-07-26  
**版本**: v1.0