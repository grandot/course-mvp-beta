# 重複課程功能完善技術設計

## 技術設計概述

基於已確認的需求規格，本設計將完善重複課程功能，包括自動生成、語意識別、衝突處理和管理介面。設計遵循專案的 MVP 混合模式開發策略，優先採用「高速車道」實現新功能。

## 關鍵設計決策

### 1. 重複課程生成策略
- **生成範圍**：提前生成 4 週的課程實例
- **生成時機**：創建重複課程時立即生成、每週自動補充
- **資料結構**：共享 `recurring_group_id`，個別 `course_id`

### 2. 衝突處理策略
- **檢測邏輯**：創建時檢查現有課程時間衝突
- **處理方式**：要求用戶手動選擇處理方式（調整時間/取消衝突課程）
- **衝突範圍**：同一用戶的所有課程（包括單次和重複課程）

### 3. 重複模式支援
- **基礎模式**：每天、每週特定日期
- **複雜模式**：多日重複（如週二+週四）留待後續版本
- **結束條件**：指定次數或結束日期

### 4. 歷史課程處理
- **原則**：已完成的課程記錄保持不變
- **修改範圍**：只影響未來的課程實例
- **狀態管理**：區分已上課程和未來課程

## 資料模型設計

### 重複課程群組 (Recurring Course Group)

```typescript
interface RecurringCourseGroup {
  id: string;                          // 重複課程群組ID
  student_id: string;                  // 學生ID
  course_name: string;                 // 課程名稱
  teacher: string;                     // 老師
  location: string;                    // 地點
  
  // 重複模式配置
  recurrence_pattern: {
    type: 'daily' | 'weekly' | 'monthly';
    interval: number;                  // 間隔（如每2週）
    days_of_week?: number[];           // 週幾 (0=週日, 1=週一...)
    day_of_month?: number;             // 月份中的第幾天
  };
  
  // 時間資訊
  schedule_time: string;               // 時間描述（如"下午2點到3點"）
  time_info: {
    start: string;                     // ISO格式開始時間
    end: string;                       // ISO格式結束時間
  };
  
  // 結束條件
  end_condition: {
    type: 'count' | 'date';
    value: number | string;            // 次數或結束日期
  };
  
  // 狀態管理
  status: 'active' | 'paused' | 'stopped' | 'completed';
  created_at: string;
  updated_at: string;
  
  // 生成統計
  generation_stats: {
    last_generated_date: string;       // 最後生成到的日期
    total_generated: number;           // 已生成總數
    total_completed: number;           // 已完成數量
  };
}
```

### 課程實例 (Course Instance)

```typescript
interface CourseInstance {
  id: string;                          // 課程實例ID
  student_id: string;                  // 學生ID
  course_name: string;                 // 課程名稱
  teacher: string;                     // 老師
  location: string;                    // 地點
  
  // 時間資訊
  course_date: string;                 // 課程日期 (YYYY-MM-DD)
  schedule_time: string;               // 時間描述
  time_info: {
    start: string;                     // ISO格式開始時間
    end: string;                       // ISO格式結束時間
  };
  
  // 重複課程關聯
  is_recurring: boolean;               // 是否為重複課程
  recurring_group_id?: string;        // 所屬重複課程群組ID
  sequence_number?: number;            // 在重複序列中的編號
  
  // 狀態管理
  status: 'scheduled' | 'completed' | 'cancelled' | 'rescheduled';
  created_at: string;
  updated_at: string;
  
  // 修改歷史
  modification_history?: Array<{
    timestamp: string;
    operation: string;
    changes: Object;
  }>;
}
```

## API 設計

### 新增 Intent 處理

在 `TaskService.executeIntent()` 中新增以下 case：

```javascript
case 'create_recurring_course':
  return await this.handleCreateRecurringCourse(entities, userId);

case 'modify_recurring_course':
  return await this.handleModifyRecurringCourse(entities, userId);

case 'stop_recurring_course':
  return await this.handleStopRecurringCourse(entities, userId);

case 'query_recurring_courses':
  return await this.handleQueryRecurringCourses(entities, userId);
```

### 核心業務邏輯方法

#### 1. 創建重複課程

```javascript
async handleCreateRecurringCourse(entities, userId) {
  // 1. 驗證和解析重複模式
  const recurrencePattern = this.parseRecurrencePattern(entities);
  
  // 2. 檢查時間衝突
  const conflicts = await this.checkRecurringConflicts(entities, userId);
  if (conflicts.length > 0) {
    return this.handleConflictResolution(conflicts);
  }
  
  // 3. 創建重複課程群組
  const groupId = await DataService.createRecurringGroup(groupData);
  
  // 4. 生成4週的課程實例
  const instances = await this.generateCourseInstances(groupId, 4);
  
  // 5. 批量創建課程實例
  await DataService.createCourseInstances(instances);
  
  return { success: true, groupId, generatedCount: instances.length };
}
```

#### 2. 重複模式解析

```javascript
parseRecurrencePattern(entities) {
  const { timeInfo, courseName } = entities;
  
  // 從語意解析結果中提取重複模式
  if (timeInfo.recurring) {
    return {
      type: timeInfo.recurring.type,      // 'daily', 'weekly', 'monthly'
      interval: timeInfo.recurring.interval || 1,
      days_of_week: timeInfo.recurring.days_of_week || [],
      day_of_month: timeInfo.recurring.day_of_month
    };
  }
  
  throw new Error('無法識別重複模式');
}
```

#### 3. 衝突檢測與處理

```javascript
async checkRecurringConflicts(entities, userId) {
  const { timeInfo } = entities;
  const conflicts = [];
  
  // 生成接下來4週的時間點
  const futureTimeSlots = this.generateTimeSlots(timeInfo, 4);
  
  for (const timeSlot of futureTimeSlots) {
    const dayConflicts = await CourseService.checkTimeConflicts(
      userId, 
      timeSlot.date, 
      timeSlot.time
    );
    conflicts.push(...dayConflicts);
  }
  
  return conflicts;
}

handleConflictResolution(conflicts) {
  return {
    success: false,
    action: 'conflict_detected',
    conflicts: conflicts.map(c => ({
      date: c.course_date,
      time: c.schedule_time,
      course: c.course_name
    })),
    message: '檢測到時間衝突，請選擇處理方式：\n' +
             '1. 調整重複課程時間\n' +
             '2. 取消衝突的課程\n' +
             '3. 跳過衝突時段',
    resolution_options: ['adjust_time', 'cancel_conflicts', 'skip_conflicts']
  };
}
```

#### 4. 課程實例生成器

```javascript
generateCourseInstances(groupData, weeksAhead = 4) {
  const instances = [];
  const { recurrence_pattern, time_info } = groupData;
  
  const startDate = new Date();
  const endDate = new Date();
  endDate.setDate(startDate.getDate() + (weeksAhead * 7));
  
  switch (recurrence_pattern.type) {
    case 'daily':
      instances.push(...this.generateDailyInstances(groupData, startDate, endDate));
      break;
      
    case 'weekly':
      instances.push(...this.generateWeeklyInstances(groupData, startDate, endDate));
      break;
      
    case 'monthly':
      instances.push(...this.generateMonthlyInstances(groupData, startDate, endDate));
      break;
  }
  
  return instances;
}

generateWeeklyInstances(groupData, startDate, endDate) {
  const instances = [];
  const { recurrence_pattern } = groupData;
  
  for (const dayOfWeek of recurrence_pattern.days_of_week) {
    let currentDate = this.getNextWeekday(startDate, dayOfWeek);
    let sequenceNumber = 1;
    
    while (currentDate <= endDate) {
      instances.push({
        ...groupData,
        id: this.generateCourseId(),
        course_date: currentDate.toISOString().split('T')[0],
        sequence_number: sequenceNumber++,
        status: 'scheduled'
      });
      
      currentDate.setDate(currentDate.getDate() + 7);
    }
  }
  
  return instances;
}
```

### 5. 重複課程管理

#### 修改重複課程

```javascript
async handleModifyRecurringCourse(entities, userId) {
  const { courseName, modifications, scope } = entities;
  
  // 1. 找到重複課程群組
  const group = await DataService.findRecurringGroup(userId, courseName);
  if (!group) {
    return { success: false, message: '找不到指定的重複課程' };
  }
  
  // 2. 根據修改範圍處理
  switch (scope) {
    case 'all_future':
      return await this.modifyAllFutureCourses(group, modifications);
      
    case 'single_instance':
      return await this.modifySingleCourse(entities, userId);
      
    case 'pattern_change':
      return await this.changeRecurrencePattern(group, modifications);
      
    default:
      return await this.askModificationScope(group);
  }
}

async askModificationScope(group) {
  return {
    success: false,
    action: 'clarify_modification_scope',
    message: `您想要修改「${group.course_name}」的：\n` +
             '1. 所有未來課程\n' +
             '2. 單次課程\n' +
             '3. 重複模式',
    options: ['all_future', 'single_instance', 'pattern_change']
  };
}
```

#### 停止重複課程

```javascript
async handleStopRecurringCourse(entities, userId) {
  const { courseName } = entities;
  
  // 1. 找到重複課程群組
  const group = await DataService.findRecurringGroup(userId, courseName);
  
  // 2. 更新群組狀態
  await DataService.updateRecurringGroup(group.id, { status: 'stopped' });
  
  // 3. 取消所有未來的課程實例
  const futureCourses = await DataService.getFutureCourseInstances(group.id);
  const cancelledCount = await DataService.cancelCourseInstances(
    futureCourses.map(c => c.id)
  );
  
  return {
    success: true,
    action: 'stop_recurring_course',
    message: `✅ 已停止「${courseName}」的重複課程，取消了 ${cancelledCount} 堂未來課程`,
    cancelledCount
  };
}
```

## 語意解析擴展

### SemanticService 增強

需要在 `SemanticService` 中增加重複課程相關的語意識別能力：

```javascript
// 在 SemanticService 的 prompt 中增加重複課程相關指導
const RECURRING_COURSE_PATTERNS = {
  create_recurring: [
    "每週", "每天", "每個月", "定期", "固定時間",
    "重複", "持續", "規律", "例行"
  ],
  
  time_patterns: {
    daily: ["每天", "每日", "天天"],
    weekly: ["每週", "每星期", "週一", "週二", "週三", "週四", "週五", "週六", "週日"],
    monthly: ["每月", "每個月", "月初", "月中", "月底"]
  },
  
  end_conditions: {
    count: ["次", "堂", "節", "回"],
    date: ["到", "直到", "截止", "結束"]
  }
};
```

### 語意解析範例

```javascript
// 輸入："每週一下午2點上數學課，重複4次"
// 預期輸出：
{
  intent: "create_recurring_course",
  entities: {
    courseName: "數學",
    teacher: null,
    location: null,
    timeInfo: {
      recurring: {
        type: "weekly",
        days_of_week: [1], // 週一
        interval: 1
      },
      start: "2025-07-28T14:00:00Z",
      end: "2025-07-28T15:00:00Z",
      end_condition: {
        type: "count",
        value: 4
      }
    }
  },
  confidence: 0.9
}
```

## 資料服務擴展

### DataService 新增方法

```javascript
class DataService {
  // 重複課程群組管理
  static async createRecurringGroup(groupData) { /* 實作 */ }
  static async updateRecurringGroup(groupId, updateData) { /* 實作 */ }
  static async deleteRecurringGroup(groupId) { /* 實作 */ }
  static async findRecurringGroup(userId, courseName) { /* 實作 */ }
  static async getUserRecurringGroups(userId) { /* 實作 */ }
  
  // 課程實例批量管理
  static async createCourseInstances(instances) { /* 實作 */ }
  static async getFutureCourseInstances(groupId) { /* 實作 */ }
  static async cancelCourseInstances(courseIds) { /* 實作 */ }
  
  // 重複課程查詢
  static async getRecurringGroupStats(groupId) { /* 實作 */ }
  static async getRecurringCoursesByDate(userId, date) { /* 實作 */ }
}
```

## 背景任務設計

### 自動生成任務

```javascript
// 新增檔案：src/services/recurringCourseScheduler.js
class RecurringCourseScheduler {
  static async generateUpcomingCourses() {
    // 1. 找到所有活躍的重複課程群組
    const activeGroups = await DataService.getActiveRecurringGroups();
    
    // 2. 檢查每個群組是否需要生成新的課程實例
    for (const group of activeGroups) {
      const needsGeneration = await this.checkGenerationNeeded(group);
      if (needsGeneration) {
        await this.generateNewInstances(group);
      }
    }
  }
  
  static async checkGenerationNeeded(group) {
    const { last_generated_date } = group.generation_stats;
    const today = new Date();
    const lastGenerated = new Date(last_generated_date);
    
    // 如果最後生成日期距離今天少於2週，需要生成新課程
    const daysDiff = Math.floor((today - lastGenerated) / (1000 * 60 * 60 * 24));
    return daysDiff >= 14; // 2週
  }
}
```

## 錯誤處理策略

### 常見錯誤情境

1. **時間衝突錯誤**
   - 檢測：創建重複課程時與現有課程衝突
   - 處理：提供衝突詳情和解決選項
   - 回覆：友好的衝突處理指導

2. **重複模式錯誤**
   - 檢測：無法識別用戶描述的重複模式
   - 處理：請求用戶提供更明確的描述
   - 回覆：引導用戶使用支援的時間表達方式

3. **資料一致性錯誤**
   - 檢測：重複課程群組與實例不一致
   - 處理：自動修復或標記需要手動處理
   - 回覆：通知用戶資料已修復或需要聯繫支援

### 錯誤回應格式

```javascript
{
  success: false,
  error_type: "time_conflict" | "pattern_unrecognized" | "data_inconsistency",
  error_code: "RC001",
  message: "用戶友好的錯誤描述",
  details: {
    // 具體錯誤詳情
  },
  suggestions: [
    // 解決建議列表
  ]
}
```

## 效能考量

### 資料庫索引策略

```javascript
// Firestore 複合索引建議
const FIRESTORE_INDEXES = [
  // 重複課程群組查詢
  { collection: 'recurring_groups', fields: ['student_id', 'status'] },
  { collection: 'recurring_groups', fields: ['student_id', 'course_name'] },
  
  // 課程實例查詢
  { collection: 'courses', fields: ['student_id', 'course_date', 'status'] },
  { collection: 'courses', fields: ['recurring_group_id', 'sequence_number'] },
  { collection: 'courses', fields: ['student_id', 'is_recurring', 'course_date'] },
];
```

### 批量操作優化

```javascript
// 批量創建課程實例（避免過多單次寫入）
static async createCourseInstances(instances) {
  const BATCH_SIZE = 10; // Firestore 批量寫入限制
  const batches = [];
  
  for (let i = 0; i < instances.length; i += BATCH_SIZE) {
    const batch = instances.slice(i, i + BATCH_SIZE);
    batches.push(this.batchCreateCourses(batch));
  }
  
  const results = await Promise.all(batches);
  return results.flat();
}
```

## 測試策略

### 單元測試重點

1. **重複模式解析測試**
   - 測試各種時間表達方式的正確解析
   - 邊界條件測試（無效模式、模糊描述）

2. **課程實例生成測試**
   - 驗證不同重複模式的正確生成
   - 跨月份、跨年份的時間計算

3. **衝突檢測測試**
   - 多種衝突情境的準確檢測
   - 效能測試（大量課程下的衝突檢測速度）

### 整合測試重點

1. **完整流程測試**
   - 從語意解析到課程生成的端到端測試
   - 多用戶並發操作測試

2. **資料一致性測試**
   - 重複課程群組與實例的一致性驗證
   - 異常情況下的資料完整性保護

## 部署配置

### 環境變數

```bash
# 重複課程功能配置
RECURRING_COURSE_ENABLED=true
RECURRING_GENERATION_WEEKS=4
RECURRING_SCHEDULER_INTERVAL=86400000  # 24小時，毫秒
MAX_RECURRING_INSTANCES=100

# 衝突檢測配置
CONFLICT_CHECK_ENABLED=true
CONFLICT_TIME_TOLERANCE=15  # 分鐘
```

### 定期任務設定

```javascript
// 在 app.js 中設定定期任務
if (process.env.RECURRING_COURSE_ENABLED === 'true') {
  const RecurringCourseScheduler = require('./services/recurringCourseScheduler');
  
  // 每天檢查是否需要生成新的重複課程實例
  setInterval(async () => {
    try {
      await RecurringCourseScheduler.generateUpcomingCourses();
      console.log('✅ Recurring course generation completed');
    } catch (error) {
      console.error('❌ Recurring course generation failed:', error);
    }
  }, parseInt(process.env.RECURRING_SCHEDULER_INTERVAL || '86400000'));
}
```

## 向後相容性

### 現有功能保護

1. **現有課程資料**
   - 所有現有課程保持 `is_recurring: false`
   - 新增欄位使用預設值，不影響現有邏輯

2. **API 相容性**
   - 現有的 `record_course` intent 繼續支援單次課程
   - 新的重複課程功能使用新的 intent

3. **資料遷移**
   - 無需遷移現有資料
   - 新功能採用漸進式啟用

### 功能開關

```javascript
// 功能開關控制
const FEATURE_FLAGS = {
  RECURRING_COURSES: process.env.RECURRING_COURSE_ENABLED === 'true',
  CONFLICT_DETECTION: process.env.CONFLICT_CHECK_ENABLED === 'true',
  AUTOMATIC_GENERATION: process.env.AUTO_GENERATION_ENABLED === 'true'
};

// 在 TaskService 中使用功能開關
if (FEATURE_FLAGS.RECURRING_COURSES && intent === 'create_recurring_course') {
  return await this.handleCreateRecurringCourse(entities, userId);
}
```

## 監控與日誌

### 關鍵指標監控

1. **功能使用統計**
   - 重複課程創建數量
   - 自動生成成功率
   - 衝突檢測命中率

2. **效能指標**
   - 課程生成耗時
   - 衝突檢測耗時
   - 資料庫查詢效能

3. **錯誤統計**
   - 語意解析失敗率
   - 時間衝突錯誤頻率
   - 資料一致性問題

### 日誌格式

```javascript
// 結構化日誌範例
{
  timestamp: "2025-07-27T10:00:00Z",
  level: "INFO",
  component: "RecurringCourseService",
  action: "create_recurring_course",
  user_id: "user123",
  course_name: "數學",
  recurrence_type: "weekly",
  generated_instances: 16,
  duration_ms: 450
}
```