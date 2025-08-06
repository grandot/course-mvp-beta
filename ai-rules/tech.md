# 技術架構與實作指南

本文件說明系統的架構設計決策、技術選型理由、開發環境限制，以及實作細節。

## 1. 核心設計決策

### 為什麼選擇 Google Calendar + Firebase？

**設計原則：不重複造輪子**

我們面臨的核心挑戰是處理複雜的時間邏輯：
- 重複課程規則（每週三、每月第一個週一等）
- 時間衝突檢測
- 提醒機制

**技術選型分析**：

| 方案 | 優點 | 缺點 |
|------|------|------|
| 純 Firebase | 完全自主控制 | 需自行實現所有時間邏輯 |
| Google Calendar + Firebase | Calendar 處理時間邏輯成熟可靠 | 需整合兩個系統 |

**最終決策**：採用 Google Calendar 處理時間邏輯，Firebase 儲存業務資料，理由是：
1. Google Calendar 的重複規則引擎經過多年驗證
2. 避免重新實現複雜的時區和夏令時處理
3. 專注於業務邏輯開發，而非基礎設施

**⚠️ 重要設計理念：協作關係，非主從關係**
- Google Calendar 和 Firebase **不是主從關係**，而是**分工協作關係**
- Google Calendar：專精時間邏輯處理（重複規則、衝突檢測、時區計算）
- Firebase：專精業務資料管理（用戶資訊、課程內容、提醒設定）
- 兩者各司其職，互相補強，共同完成完整的業務功能
- 不應將 Google Calendar 視為「衍生表現層」，這樣會失去其時間處理的核心價值

### 為什麼使用 Firebase Scheduled Functions 而非 Google Calendar 提醒？

經過技術調研發現：
- Google Calendar Webhook 只能通知「資源變更」，無法在「事件開始時」觸發
- 使用 Firebase Scheduled Functions 可以精確控制提醒邏輯
- 便於加入自定義的提醒規則（如只提醒標記的課程）

## 2. 開發環境限制（必讀）⚠️

### 部署環境本質
**我們的部署環境：Render（無狀態 Serverless）**

#### 環境特性（第一性原則）
1. **無狀態**：每個 HTTP 請求可能由不同的實例處理
2. **短生命週期**：實例隨時可能被終止和重啟
3. **無持久記憶體**：程序記憶體會隨實例消失
4. **水平擴展**：多個實例同時運行，無法共享記憶體

| 特性 | 說明 | 影響 |
|------|------|------|
| **無狀態** | 每個請求可能由不同實例處理 | 不能依賴程序記憶體 |
| **自動休眠** | 15分鐘無活動後休眠 | 冷啟動延遲 |
| **隨機重啟** | 部署、更新、故障時重啟 | 記憶體資料遺失 |
| **水平擴展** | 可能同時運行多個實例 | 實例間無法共享狀態 |

#### ❌ 絕對不可使用的方案
- **Map() / Object**：存在記憶體中，重啟就消失
- **全域變數**：每個實例有自己的副本，無法同步
- **本地檔案系統**：檔案系統是臨時的，會被清除
- **SQLite**：需要本地檔案，不適合無狀態環境

```javascript
// 錯誤：使用記憶體儲存
const cache = new Map();
const users = {};
let globalState = null;

// 錯誤：使用本地檔案
const fs = require('fs');
fs.writeFileSync('./data.json', data);

// 錯誤：假設單一實例
class Singleton {
  static instance = null;
}
```

#### ✅ 必須使用的方案
- **Redis**：短期狀態管理（對話上下文、快取）
- **Firebase Firestore**：業務資料持久化儲存
- **Firebase Storage**：檔案和圖片儲存
- **Google Calendar**：時間邏輯和排程管理

```javascript
// 正確：使用 Redis
const redis = new Redis(process.env.REDIS_URL);
await redis.set('key', value);

// 正確：使用資料庫
await firebaseService.saveData(data);

// 正確：無狀態設計
function processRequest(input) {
  // 每次都從外部獲取狀態
  const state = await redis.get(userId);
  // 處理邏輯
  await redis.set(userId, newState);
}
```

### 架構設計檢查清單
在設計任何功能前，必須確認：
- [ ] 是否需要跨請求保存狀態？
- [ ] 狀態儲存是否獨立於應用實例？
- [ ] 服務重啟後功能是否正常？
- [ ] 多實例並行時是否會有競爭條件？
- [ ] 是否有適當的錯誤處理和降級方案？

### 必要的外部服務

1. **Redis**（對話狀態管理）
   - 用途：暫存對話上下文
   - 服務：Upstash 或 Redis Labs
   - TTL：30分鐘自動過期

2. **Firebase**（業務資料）
   - 用途：課程、用戶、記錄
   - 持久化：永久儲存

3. **Google Calendar**（時間邏輯）
   - 用途：排程、重複規則
   - API：無狀態呼叫

## 3. 環境變數配置

### 基本配置
```bash
# Redis（必需）- Upstash 格式
REDIS_HOST=xxx.upstash.io
REDIS_PORT=6379
REDIS_PASSWORD=default:your_upstash_token_here
REDIS_TLS=true

# Firebase（必需）
FIREBASE_PROJECT_ID=xxx
FIREBASE_CLIENT_EMAIL=xxx
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"

# LINE Bot（必需）
LINE_CHANNEL_ACCESS_TOKEN=xxx
LINE_CHANNEL_SECRET=xxx

# 部署環境
NODE_ENV=production
PORT=3000
```

### Upstash Redis 連接配置 ⚠️ 重要

Upstash 需要特殊的認證格式：

```javascript
const Redis = require('ioredis');

const redis = new Redis({
  host: process.env.REDIS_HOST,
  port: parseInt(process.env.REDIS_PORT),
  username: 'default',  // Upstash 固定使用 'default'
  password: process.env.REDIS_PASSWORD.replace('default:', ''),  // 移除前綴
  tls: {},  // Upstash 必需 TLS
  family: 4,
  retryStrategy: (times) => Math.min(times * 50, 2000)
});
```

**環境變數格式**：
- ✅ 正確：`REDIS_PASSWORD=default:ATpyAAI...`（保留前綴）
- ❌ 錯誤：`REDIS_PASSWORD=ATpyAAI...`（不要手動移除前綴）

### 開發時注意事項

1. **本地開發 vs 生產環境**
   ```javascript
   // ❌ 錯誤：開發環境絕對不能用 Map
   // 因為部署環境是無狀態的，本地測試必須與生產一致
   const storage = new RedisStorage();  // 永遠使用 Redis
   ```

2. **錯誤處理**
   ```javascript
   // 外部服務可能失敗，需要降級
   try {
     const context = await redis.get(key);
   } catch (error) {
     console.error('Redis failed, degrading...');
     // 降級為無狀態處理
   }
   ```

3. **冷啟動優化**
   ```javascript
   // 延遲初始化，避免啟動時連接所有服務
   let redis;
   function getRedis() {
     if (!redis) redis = new Redis();
     return redis;
   }
   ```

### 部署前檢查清單

- [ ] 沒有使用 Map() 或全域變數儲存狀態
- [ ] 沒有依賴本地檔案系統
- [ ] 所有狀態都儲存在外部服務
- [ ] 有適當的錯誤處理和降級方案
- [ ] 環境變數都已正確設定
- [ ] 考慮了冷啟動的影響

### 常見錯誤案例

1. **對話管理器使用 Map**
   - 問題：服務重啟後對話上下文消失
   - 解法：改用 Redis

2. **檔案上傳到本地**
   - 問題：檔案會被清除
   - 解法：直接上傳到 Firebase Storage

3. **使用 setTimeout 做定時任務**
   - 問題：服務可能在執行前重啟
   - 解法：使用 Firebase Scheduled Functions

## 4. 系統架構

### 🎯 核心架構

**目標**：快速上線，驗證產品概念

**技術特徵**：
- 規則優先的意圖識別（減少 API 成本）
- 簡化的資料模型
- 單體式架構，便於部署

**架構圖**：
```
LINE Bot → Express Server → Intent Parser → Task Handler → Google Calendar
                                                        ↘
                                                         Firebase
```

### Feature Flag 策略

#### 設計理念
透過 Feature Flag 實現漸進式發布，降低風險。

#### 實作方式
```javascript
// src/config/features.js
const FEATURES = {
  SLOT_TEMPLATE_SYSTEM: {
    enabled: false,
    phase: 'Phase 2',
    rolloutPercentage: 0,  // 灰度發布百分比
    enabledUsers: []       // 白名單用戶
  }
};
```

#### 升級流程
1. **開發階段**：enabled = false，僅開發環境測試
2. **灰度發布**：rolloutPercentage = 10，10% 用戶體驗新功能
3. **全面發布**：enabled = true，所有用戶使用新功能

## 5. 技術債務管理

### 當前已知的技術債務
1. **缺乏自動化測試**
   - 影響：重構風險高
   - 計畫：加入單元測試和整合測試

2. **錯誤處理不夠完善**
   - 影響：用戶體驗不佳
   - 計畫：建立統一的錯誤處理中間件

3. **日誌系統簡陋**
   - 影響：問題追蹤困難
   - 計畫：整合 Cloud Logging

### 償還策略
- 每個 Sprint 分配 20% 時間處理技術債務
- 優先處理影響用戶體驗的項目
- 建立技術債務追蹤看板

詳細的技術債記錄請參考 [technical-debt.md](../doc/technical-debt.md)

主要技術債項目：
1. **LINE Bot 圖片下載 404 錯誤** - 高優先級，影響圖片上傳功能
2. **對話狀態持久化** - 中優先級，影響用戶體驗
3. **錯誤恢復機制** - 中優先級，影響資料一致性

## 6. 擴展性考量

### 垂直擴展
- 當前架構支援到 ~1000 活躍用戶
- 瓶頸：單一 Google Service Account 的 API 配額

### 水平擴展策略
1. **多 Service Account**：突破 API 限制
2. **讀寫分離**：Firebase 查詢優化
3. **區域部署**：降低延遲

### 成本優化
- 使用 Firestore 查詢索引減少讀取次數
- 實施 API 呼叫快取機制
- 採用 Cloud Scheduler 取代高頻輪詢

## 7. 安全性設計

### 當前實施
- LINE Signature 驗證
- 環境變數管理敏感資訊
- Firebase Security Rules

### 未來加強
- API Rate Limiting
- 用戶資料加密
- 定期安全審計

## 8. 監控與可觀測性

### 基礎監控（當前）
- Console 日誌
- 基本錯誤追蹤

### 進階監控（未來）
- Application Performance Monitoring
- 自定義指標儀表板
- 告警機制

### 智慧運維（長期）
- 預測性告警
- 自動化問題診斷
- SLA 監控

## 9. 關鍵設計決策與實作細節

本節澄清文檔間的矛盾，提供明確的實作指引。

### 9.1 提醒系統架構

**決策：採用獨立 `/reminders` 集合**

```javascript
// Firebase 結構
/reminders/{reminderId}: {
  courseId: "課程ID",
  userId: "LINE用戶ID",
  studentName: "學生名稱",
  courseName: "課程名稱",
  reminderTime: 30, // 提前幾分鐘
  triggerTime: "2025-01-15T13:30:00+08:00",
  executed: false
}

/courses/{courseId}: {
  hasReminder: true  // 僅作為 UI 標記
}
```

### 9.2 資料同步策略

**決策：即時寫入為主，定時同步為輔**

- **即時寫入**：新增/修改/刪除課程時同步更新兩邊
- **定時同步**：每日凌晨校驗資料一致性，不覆蓋只標記

### 9.3 統一命名規範

| 概念 | 正確用詞 | 禁用詞 |
|------|----------|---------|
| 學生 | student, studentName | child, kid |
| 課程 | course, courseName | lesson, class |
| 時間 | scheduleTime | time, classTime |

### 9.4 Calendar 識別碼澄清

- **calendarId**：Google 自動生成（如 `x7i2...@group.calendar.google.com`）
- **summary**：顯示名稱（如 "小明的課程表"）

### 9.5 錯誤處理策略

**圖片上傳失敗**：
- 文字內容優先保存
- 圖片容許部分失敗
- 返回部分成功訊息

**資料不一致**：
- Google 成功 Firebase 失敗：重試3次
- Firebase 成功 Google 失敗：回滾操作

### 9.6 意圖優先級邏輯

1. 關鍵詞匹配評分（越多越優先）
2. 相同分數看 priority（數字越小越優先）
3. 無法判斷時呼叫 OpenAI

### 9.7 對話狀態管理設計

**基礎結構**：
```javascript
// Redis 短期儲存，30分鐘超時
const conversationState = new Map();

// 完整的對話狀態結構
{
  userId: {
    lastIntent: "query_schedule",
    lastActivity: Date.now(),
    context: {
      // 核心實體
      studentName: "小明",
      courseName: "數學課",
      courseDate: "2025-01-15",
      
      // 對話歷史（最多保留3輪）
      history: [
        { role: "user", message: "小明今天有課嗎？" },
        { role: "bot", message: "小明今天有數學課和英文課" }
      ],
      
      // 最後提到的實體
      lastMentioned: {
        students: ["小明"],
        courses: ["數學課", "英文課"],
        dates: ["今天"]
      }
    }
  }
}
```

**上下文傳遞邏輯**：
```javascript
// 從上下文補充缺失的 slots
function enrichSlotsFromContext(slots, context) {
  // 1. 如果缺少 studentName，從最後提到的學生取得
  if (!slots.studentName && context.lastMentioned.students.length > 0) {
    slots.studentName = context.lastMentioned.students[0];
  }
  
  // 2. 如果缺少 courseName，根據關鍵詞匹配
  if (!slots.courseName && context.lastMentioned.courses.length > 0) {
    // 例如用戶說「記錄數學課」，匹配「數學」
    for (const course of context.lastMentioned.courses) {
      if (userMessage.includes(course.substring(0, 2))) {
        slots.courseName = course;
        break;
      }
    }
  }
  
  // 3. 時間參考繼承
  if (!slots.courseDate && context.courseDate) {
    slots.courseDate = context.courseDate;
  }
  
  return slots;
}

// 對話狀態超時處理
function handleExpiredContext(userId, newIntent) {
  const state = conversationState.get(userId);
  
  if (!state || Date.now() - state.lastActivity > 30 * 60 * 1000) {
    // 超時或無狀態
    return {
      needsFullInfo: true,
      message: "您好，讓我們重新開始。請告訴我完整的資訊。"
    };
  }
  
  // 檢查是否需要之前的上下文
  const contextDependentIntents = ['record_content', 'set_reminder', 'cancel_course'];
  if (contextDependentIntents.includes(newIntent) && !state.context.studentName) {
    return {
      needsFullInfo: true,
      message: "請告訴我是哪位學生的哪門課程？"
    };
  }
  
  return { needsFullInfo: false };
}
```

### 9.8 課程時間衝突處理

**衝突檢測規則**：
```javascript
// 衝突檢測配置
const CONFLICT_RULES = {
  bufferTime: 30,        // 課程間隔緩衝時間（分鐘）
  overlapAllowed: false, // 是否允許時間重疊
  transportTime: {       // 不同地點間的交通時間
    "default": 30,
    "same_location": 0
  }
};

// 衝突檢測函式
async function checkTimeConflict(studentName, newCourse) {
  const startTime = new Date(`${newCourse.date}T${newCourse.time}:00`);
  const endTime = new Date(startTime.getTime() + newCourse.duration * 60000);
  
  // 查詢前後各 2 小時的課程
  const rangeStart = new Date(startTime.getTime() - 2 * 60 * 60000);
  const rangeEnd = new Date(endTime.getTime() + 2 * 60 * 60000);
  
  const existingCourses = await queryCoursesInRange(studentName, rangeStart, rangeEnd);
  
  const conflicts = [];
  for (const course of existingCourses) {
    const courseStart = new Date(`${course.date}T${course.time}:00`);
    const courseEnd = new Date(courseStart.getTime() + course.duration * 60000);
    
    // 檢查時間重疊
    if (startTime < courseEnd && endTime > courseStart) {
      conflicts.push({
        type: 'overlap',
        course: course,
        message: `與 ${course.courseName} 時間重疊`
      });
    }
    // 檢查間隔時間
    else if (Math.abs(startTime - courseEnd) < CONFLICT_RULES.bufferTime * 60000) {
      conflicts.push({
        type: 'buffer',
        course: course,
        message: `與 ${course.courseName} 間隔不足 ${CONFLICT_RULES.bufferTime} 分鐘`
      });
    }
  }
  
  return conflicts;
}
```

**衝突處理流程**：
```javascript
// 處理使用者回應
async function handleConflictDecision(conflicts, userDecision, newCourse) {
  if (userDecision === 'continue') {
    // 1. 標記為「有衝突但使用者確認」
    newCourse.hasConflict = true;
    newCourse.conflictDetails = conflicts;
    
    // 2. 在 Google Calendar 事件描述中加入衝突提示
    newCourse.description = `⚠️ 注意：${conflicts[0].message}\n${newCourse.description || ''}`;
    
    // 3. 正常建立課程
    return await createCourse(newCourse);
  } 
  else if (userDecision === 'modify') {
    // 返回建議的可用時段
    return {
      success: false,
      suggestions: await findAvailableTimeSlots(newCourse.studentName, newCourse.date)
    };
  }
  else { // cancel
    return {
      success: false,
      message: "已取消新增課程"
    };
  }
}
```

**重複課程的特殊處理**：
```javascript
// 檢查重複課程的所有實例
async function checkRecurringConflicts(pattern, duration = 4) {
  // 檢查未來 4 週的衝突
  const conflicts = [];
  const instances = generateRecurringInstances(pattern, duration);
  
  for (const instance of instances) {
    const instanceConflicts = await checkTimeConflict(instance.studentName, instance);
    if (instanceConflicts.length > 0) {
      conflicts.push({
        date: instance.date,
        conflicts: instanceConflicts
      });
    }
  }
  
  // 如果超過 20% 的實例有衝突，提醒使用者
  if (conflicts.length > instances.length * 0.2) {
    return {
      hasConflicts: true,
      conflictRate: conflicts.length / instances.length,
      details: conflicts,
      message: `此重複課程在未來 ${duration} 週內有 ${conflicts.length} 次時間衝突`
    };
  }
  
  return { hasConflicts: false };
}
```

## 總結

本架構設計遵循以下原則：
1. **無狀態優先**：所有狀態儲存在外部服務
2. **技術債務可控**：定期評估和償還
3. **成本效益平衡**：選擇合適的技術，而非最新的技術
4. **可維護性優先**：代碼清晰比效能優化更重要（在合理範圍內）

詳細的實作指南請參考 [Developer Guide](../doc/developer-guide.md)。

---

## 參考資料

- [Render 文檔 - 無狀態應用](https://render.com/docs/web-services)
- [Vercel 文檔 - Serverless Functions](https://vercel.com/docs/functions)
- [Redis 最佳實踐](https://redis.io/docs/manual/patterns/)