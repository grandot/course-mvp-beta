# 重複課程功能技術設計（動態計算架構）

## 技術設計概述

基於動態計算式架構，重複課程功能不預先創建課程實例，而是在查詢時根據重複規則即時計算。採用布林欄位標註重複類型，並實現智能起始日期判斷機制。

## 核心設計原則

### 1. 動態計算架構
- **核心理念**：不預先創建課程實例，查詢時動態計算
- **計算時機**：用戶查詢課程時即時生成顯示資料
- **儲存策略**：只儲存重複規則，不儲存具體時間實例

### 2. 重複類型標註
- **標註方式**：使用布林欄位 `daily_recurring`、`weekly_recurring`、`monthly_recurring`
- **標註時機**：新增、修改、查詢重複課程時顯示標註
- **互斥性**：同一課程只能有一種重複類型為 true

### 3. 起始日期智能判斷
- **判斷原則**：根據當前時間與課程時間比較決定起始日期
- **避免過期**：確保重複課程不會從已過期的時間開始
- **即時計算**：每次查詢時重新計算起始點

## 資料模型設計

### 擴展現有 courses 集合

```javascript
{
  // 現有欄位
  id: "course_id",
  student_id: "user_id", 
  course_name: "英文課",
  course_date: "2025-07-29",
  schedule_time: "下午3點",
  location: "教室A",
  teacher: "李老師",
  status: "scheduled",

  // 新增重複課程標註欄位
  daily_recurring: false,     // 每天重複
  weekly_recurring: true,     // 每週重複  
  monthly_recurring: false,   // 每月重複

  // 重複詳細資訊
  recurrence_details: {
    days_of_week: [3],        // 週三（0=週日）
    time_of_day: "15:00",     // 固定時間
    start_date: "2025-07-30", // 智能計算的起始日期
    end_condition: {
      type: "never" | "count" | "date",
      value: null | 10 | "2025-12-31"
    }
  }
}
```

### 資料一致性規則

```javascript
// 重複類型互斥檢查
const validateRecurrenceType = (course) => {
  const types = [course.daily_recurring, course.weekly_recurring, course.monthly_recurring];
  const trueCount = types.filter(Boolean).length;
  
  if (trueCount > 1) {
    throw new Error('課程只能有一種重複類型');
  }
  
  const hasRecurrence = trueCount === 1;
  const hasDetails = course.recurrence_details != null;
  
  if (hasRecurrence !== hasDetails) {
    throw new Error('重複類型與詳細資訊不一致');
  }
};
```

## 核心技術實現

### 1. 起始日期智能判斷

```javascript
class RecurringCourseCalculator {
  static calculateStartDate(recurrenceType, timeOfDay, currentTime) {
    const now = new Date(currentTime);
    const [hour, minute] = timeOfDay.split(':').map(Number);
    
    switch (recurrenceType) {
      case 'daily':
        return this.calculateDailyStartDate(now, hour, minute);
      case 'weekly':
        return this.calculateWeeklyStartDate(now, hour, minute, daysOfWeek);
      case 'monthly':
        return this.calculateMonthlyStartDate(now, hour, minute, dayOfMonth);
    }
  }

  static calculateDailyStartDate(now, hour, minute) {
    const today = new Date(now);
    today.setHours(hour, minute, 0, 0);
    
    // 如果今天的時間已過，從明天開始
    if (now > today) {
      today.setDate(today.getDate() + 1);
    }
    
    return today.toISOString().split('T')[0];
  }

  static calculateWeeklyStartDate(now, hour, minute, daysOfWeek) {
    const targetDay = daysOfWeek[0]; // 假設只有一個星期幾
    const currentDay = now.getDay();
    
    let daysUntilTarget = targetDay - currentDay;
    if (daysUntilTarget < 0) daysUntilTarget += 7;
    
    const targetDate = new Date(now);
    targetDate.setDate(now.getDate() + daysUntilTarget);
    targetDate.setHours(hour, minute, 0, 0);
    
    // 如果是同一天但時間已過，移到下週
    if (daysUntilTarget === 0 && now > targetDate) {
      targetDate.setDate(targetDate.getDate() + 7);
    }
    
    return targetDate.toISOString().split('T')[0];
  }

  static calculateMonthlyStartDate(now, hour, minute, dayOfMonth) {
    const targetDate = new Date(now);
    targetDate.setDate(dayOfMonth);
    targetDate.setHours(hour, minute, 0, 0);
    
    // 如果本月的日期已過，移到下個月
    if (now > targetDate) {
      targetDate.setMonth(targetDate.getMonth() + 1);
    }
    
    return targetDate.toISOString().split('T')[0];
  }
}
```

### 2. 動態課程計算

```javascript
class RecurringCourseCalculator {
  static calculateFutureOccurrences(course, startDate, endDate, maxCount = 50) {
    const occurrences = [];
    const start = new Date(startDate);
    const end = new Date(endDate);
    const courseStartDate = new Date(course.recurrence_details.start_date);
    
    let current = new Date(Math.max(start, courseStartDate));
    let count = 0;
    
    while (current <= end && count < maxCount) {
      if (this.matchesRecurrenceRule(current, course)) {
        occurrences.push({
          date: current.toISOString().split('T')[0],
          course_name: course.course_name,
          schedule_time: course.schedule_time,
          recurring_label: this.getRecurrenceLabel(course),
          is_recurring_instance: true,
          original_course_id: course.id
        });
        count++;
      }
      
      current = this.getNextPossibleDate(current, course);
    }
    
    return occurrences;
  }

  static matchesRecurrenceRule(date, course) {
    const { recurrence_details } = course;
    const dayOfWeek = date.getDay();
    const dayOfMonth = date.getDate();
    
    if (course.daily_recurring) {
      return true; // 每天都符合
    }
    
    if (course.weekly_recurring) {
      return recurrence_details.days_of_week.includes(dayOfWeek);
    }
    
    if (course.monthly_recurring) {
      return dayOfMonth === recurrence_details.day_of_month;
    }
    
    return false;
  }

  static getNextPossibleDate(current, course) {
    const next = new Date(current);
    
    if (course.daily_recurring) {
      next.setDate(next.getDate() + 1);
    } else if (course.weekly_recurring) {
      next.setDate(next.getDate() + 1); // 逐日檢查
    } else if (course.monthly_recurring) {
      next.setDate(next.getDate() + 1); // 逐日檢查
    }
    
    return next;
  }

  static getRecurrenceLabel(course) {
    if (course.daily_recurring) return '🔄 每天';
    if (course.weekly_recurring) {
      const days = course.recurrence_details.days_of_week
        .map(d => ['週日', '週一', '週二', '週三', '週四', '週五', '週六'][d])
        .join('、');
      return `🔄 ${days}`;
    }
    if (course.monthly_recurring) {
      return `🔄 每月${course.recurrence_details.day_of_month}號`;
    }
    return '';
  }
}
```

### 3. 衝突檢測（動態計算）

```javascript
class RecurringConflictDetector {
  static async checkRecurringConflicts(newCourse, userId, weeksAhead = 4) {
    const conflicts = [];
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + (weeksAhead * 7));
    
    // 計算新重複課程的未來時間點
    const futureOccurrences = RecurringCourseCalculator.calculateFutureOccurrences(
      newCourse, 
      new Date().toISOString().split('T')[0],
      endDate.toISOString().split('T')[0]
    );
    
    // 檢查每個時間點是否與現有課程衝突
    for (const occurrence of futureOccurrences) {
      const dayConflicts = await this.checkSingleDateConflicts(
        userId, 
        occurrence.date, 
        newCourse.schedule_time
      );
      conflicts.push(...dayConflicts);
    }
    
    return conflicts;
  }

  static async checkSingleDateConflicts(userId, date, time) {
    // 檢查指定日期的現有課程
    const existingCourses = await DataService.queryCourses({
      student_id: userId,
      course_date: date,
      status: 'scheduled'
    });
    
    // 檢查重複課程在該日期是否有衝突
    const recurringCourses = await DataService.queryCourses({
      student_id: userId,
      $or: [
        { daily_recurring: true },
        { weekly_recurring: true },
        { monthly_recurring: true }
      ]
    });
    
    const recurringConflicts = recurringCourses.filter(course => 
      RecurringCourseCalculator.matchesRecurrenceRule(new Date(date), course) &&
      this.timesOverlap(time, course.schedule_time)
    );
    
    return [...existingCourses, ...recurringConflicts].filter(course =>
      this.timesOverlap(time, course.schedule_time)
    );
  }

  static timesOverlap(time1, time2) {
    // 簡化的時間重疊檢查 - 實際需要更複雜的邏輯
    return time1 === time2;
  }
}
```

## 語義處理擴展

### SemanticService 增強

```javascript
class SemanticService {
  static async analyzeRecurringCourse(text, context) {
    // 檢測重複模式關鍵詞
    const recurringPatterns = {
      daily: ['每天', '每日', '天天'],
      weekly: ['每週', '每星期', '週一', '週二', '週三', '週四', '週五', '週六', '週日'],
      monthly: ['每月', '每個月', '月初', '月中', '月底']
    };
    
    let recurrenceType = null;
    let daysOfWeek = [];
    let dayOfMonth = null;
    
    // 識別重複類型
    for (const [type, keywords] of Object.entries(recurringPatterns)) {
      if (keywords.some(keyword => text.includes(keyword))) {
        recurrenceType = type;
        
        if (type === 'weekly') {
          daysOfWeek = this.extractDaysOfWeek(text);
        } else if (type === 'monthly') {
          dayOfMonth = this.extractDayOfMonth(text);
        }
        
        break;
      }
    }
    
    // 提取時間資訊
    const timeInfo = await this.extractTimeInfo(text);
    
    // 計算智能起始日期
    const startDate = RecurringCourseCalculator.calculateStartDate(
      recurrenceType,
      timeInfo.time,
      new Date()
    );
    
    return {
      intent: 'create_recurring_course',
      entities: {
        courseName: this.extractCourseName(text),
        recurrenceType,
        timeInfo: {
          ...timeInfo,
          recurring: {
            type: recurrenceType,
            days_of_week: daysOfWeek,
            day_of_month: dayOfMonth,
            start_date: startDate
          }
        }
      }
    };
  }

  static extractDaysOfWeek(text) {
    const dayMap = {
      '週一': 1, '週二': 2, '週三': 3, '週四': 4, 
      '週五': 5, '週六': 6, '週日': 0
    };
    
    const days = [];
    for (const [day, num] of Object.entries(dayMap)) {
      if (text.includes(day)) {
        days.push(num);
      }
    }
    
    return days.length > 0 ? days : [1]; // 預設週一
  }

  static extractDayOfMonth(text) {
    // 提取月份中的日期（如：5號、15號）
    const match = text.match(/(\d{1,2})號/);
    return match ? parseInt(match[1]) : 1; // 預設1號
  }
}
```

## 業務邏輯實現

### TaskService 擴展

```javascript
class TaskService {
  async executeIntent(intent, entities, userId) {
    switch (intent) {
      case 'create_recurring_course':
        return await this.handleCreateRecurringCourse(entities, userId);
      case 'modify_recurring_course':
        return await this.handleModifyRecurringCourse(entities, userId);
      case 'stop_recurring_course':
        return await this.handleStopRecurringCourse(entities, userId);
      case 'query_courses':
        return await this.handleQueryCoursesWithRecurring(entities, userId);
    }
  }

  async handleCreateRecurringCourse(entities, userId) {
    const { courseName, recurrenceType, timeInfo } = entities;
    
    // 檢查動態衝突
    const conflicts = await RecurringConflictDetector.checkRecurringConflicts(
      { 
        course_name: courseName,
        schedule_time: timeInfo.display,
        [`${recurrenceType}_recurring`]: true,
        recurrence_details: timeInfo.recurring
      },
      userId
    );
    
    if (conflicts.length > 0) {
      return this.handleConflictResolution(conflicts);
    }
    
    // 創建重複課程記錄（不創建實例）
    const courseData = {
      student_id: userId,
      course_name: courseName,
      course_date: timeInfo.recurring.start_date,
      schedule_time: timeInfo.display,
      daily_recurring: recurrenceType === 'daily',
      weekly_recurring: recurrenceType === 'weekly',
      monthly_recurring: recurrenceType === 'monthly',
      recurrence_details: timeInfo.recurring,
      status: 'scheduled'
    };
    
    const result = await DataService.createCourse(courseData);
    
    return {
      success: true,
      message: `✅ 重複課程「${courseName}」已設定完成！🔄 ${this.getRecurrenceDescription(recurrenceType, timeInfo)}`,
      data: { courseId: result.id, recurrenceType }
    };
  }

  async handleQueryCoursesWithRecurring(entities, userId) {
    const { dateRange } = entities;
    const startDate = dateRange?.start || new Date().toISOString().split('T')[0];
    const endDate = dateRange?.end || this.getDateAfterDays(startDate, 7);
    
    // 查詢所有課程（包含重複和非重複）
    const allCourses = await DataService.queryCourses({
      student_id: userId
    });
    
    const results = [];
    
    // 處理非重複課程
    const nonRecurringCourses = allCourses.filter(course => 
      !course.daily_recurring && 
      !course.weekly_recurring && 
      !course.monthly_recurring &&
      course.course_date >= startDate && 
      course.course_date <= endDate
    );
    results.push(...nonRecurringCourses);
    
    // 處理重複課程（動態計算）
    const recurringCourses = allCourses.filter(course =>
      course.daily_recurring || course.weekly_recurring || course.monthly_recurring
    );
    
    for (const course of recurringCourses) {
      const occurrences = RecurringCourseCalculator.calculateFutureOccurrences(
        course, startDate, endDate
      );
      results.push(...occurrences);
    }
    
    // 按日期排序
    results.sort((a, b) => a.date?.localeCompare(b.date) || a.course_date?.localeCompare(b.course_date));
    
    return {
      success: true,
      message: this.formatCourseList(results, startDate, endDate),
      data: { courses: results, period: { startDate, endDate } }
    };
  }

  getRecurrenceDescription(type, timeInfo) {
    switch (type) {
      case 'daily':
        return `每天${timeInfo.display}`;
      case 'weekly':
        const days = timeInfo.recurring.days_of_week
          .map(d => ['週日', '週一', '週二', '週三', '週四', '週五', '週六'][d])
          .join('、');
        return `${days}${timeInfo.display}`;
      case 'monthly':
        return `每月${timeInfo.recurring.day_of_month}號${timeInfo.display}`;
    }
  }
}
```

## 資料服務擴展

### DataService 修改

```javascript
class DataService {
  static async createCourse(courseData) {
    // 驗證重複類型一致性
    this.validateRecurrenceType(courseData);
    
    // 原有創建邏輯
    const result = await FirebaseService.create('courses', courseData);
    
    console.log(`📝 Course created: ${courseData.course_name} (Recurring: ${this.getRecurrenceLabel(courseData)})`);
    
    return result;
  }

  static async queryCourses(criteria) {
    // 原有查詢邏輯保持不變
    return await FirebaseService.query('courses', criteria);
  }

  static validateRecurrenceType(courseData) {
    const types = [
      courseData.daily_recurring,
      courseData.weekly_recurring, 
      courseData.monthly_recurring
    ].filter(Boolean);
    
    if (types.length > 1) {
      throw new Error('課程只能有一種重複類型');
    }
    
    const hasRecurrence = types.length === 1;
    const hasDetails = courseData.recurrence_details != null;
    
    if (hasRecurrence && !hasDetails) {
      throw new Error('重複課程必須提供詳細資訊');
    }
  }

  static getRecurrenceLabel(courseData) {
    if (courseData.daily_recurring) return 'Daily';
    if (courseData.weekly_recurring) return 'Weekly';
    if (courseData.monthly_recurring) return 'Monthly';
    return 'None';
  }
}
```

## 錯誤處理策略

### 常見錯誤情境

1. **重複類型衝突**
```javascript
{
  success: false,
  error_type: "recurrence_type_conflict",
  message: "課程只能有一種重複類型，請確認是每天、每週還是每月重複",
  suggestions: ["明確指定重複類型", "檢查課程描述"]
}
```

2. **起始日期計算失敗**
```javascript
{
  success: false,
  error_type: "start_date_calculation_failed",
  message: "無法計算重複課程的起始日期，請提供更明確的時間資訊",
  suggestions: ["指定具體的星期幾或日期", "確認時間格式正確"]
}
```

3. **時間衝突檢測**
```javascript
{
  success: false,
  error_type: "recurring_time_conflict",
  message: "重複課程與現有課程時間衝突",
  conflicts: [
    { date: "2025-07-30", existing_course: "數學課", time: "下午3點" }
  ],
  suggestions: ["調整重複課程時間", "取消衝突的課程", "跳過衝突時段"]
}
```

## 性能與擴展性

### 查詢優化策略

```javascript
// Firestore 索引建議
const FIRESTORE_INDEXES = [
  // 重複課程查詢
  { collection: 'courses', fields: ['student_id', 'daily_recurring'] },
  { collection: 'courses', fields: ['student_id', 'weekly_recurring'] },
  { collection: 'courses', fields: ['student_id', 'monthly_recurring'] },
  
  // 日期範圍查詢
  { collection: 'courses', fields: ['student_id', 'course_date', 'status'] },
  
  // 複合查詢
  { collection: 'courses', fields: ['student_id', 'status', 'course_date'] }
];
```

### 計算性能限制

```javascript
const PERFORMANCE_LIMITS = {
  MAX_OCCURRENCES_PER_QUERY: 50,    // 單次查詢最多計算50個重複實例
  MAX_QUERY_RANGE_DAYS: 90,         // 最大查詢範圍90天
  MAX_RECURRING_COURSES_PER_USER: 20 // 每用戶最多20個重複課程
};
```

## 向後相容性

### 現有功能保護

1. **現有課程資料**
   - 所有現有課程預設三個重複欄位為 false
   - 查詢邏輯自動處理重複和非重複課程
   - 不影響現有單次課程功能

2. **API 相容性**
   - `record_course` intent 繼續處理單次課程
   - `query_courses` intent 自動包含重複課程計算
   - 新增專門的重複課程 intent

3. **漸進式啟用**
   - 使用功能開關控制重複課程功能
   - 可按用戶或環境逐步啟用
   - 出現問題時可快速回退

```javascript
// 功能開關示例
const FEATURE_FLAGS = {
  RECURRING_COURSES: process.env.RECURRING_COURSE_ENABLED === 'true',
  DYNAMIC_CALCULATION: process.env.DYNAMIC_CALC_ENABLED === 'true'
};
```

## 監控與日誌

### 關鍵指標

1. **功能使用統計**
   - 重複課程創建成功率
   - 各重複類型使用比例
   - 衝突檢測命中率

2. **性能指標**
   - 動態計算耗時（目標 < 100ms）
   - 查詢回應時間
   - 起始日期計算準確率

3. **錯誤統計**
   - 重複類型識別失敗率
   - 時間衝突頻率
   - 資料一致性問題

### 結構化日誌

```javascript
{
  timestamp: "2025-07-29T10:00:00Z",
  level: "INFO",
  component: "RecurringCourseCalculator",
  action: "calculate_future_occurrences",
  user_id: "user123",
  course_name: "英文課",
  recurrence_type: "weekly",
  calculated_instances: 4,
  query_range_days: 28,
  duration_ms: 45
}
```

## 測試策略

### 單元測試重點

1. **起始日期計算測試**
   - 各種時間情境的準確計算
   - 邊界條件（跨日、跨週、跨月）
   - 時區處理正確性

2. **動態計算邏輯測試**
   - 重複模式匹配準確性
   - 日期範圍計算正確性
   - 性能壓力測試

3. **衝突檢測測試**
   - 各種衝突情境覆蓋
   - 大量課程下的檢測效率
   - 誤報和漏報率

### 整合測試重點

1. **端到端流程測試**
   - 語義解析 → 計算 → 儲存 → 查詢完整流程
   - 多用戶並發操作
   - 複雜重複模式處理

2. **資料一致性測試**
   - 重複類型欄位一致性
   - 查詢結果正確性
   - 異常恢復機制

## 部署配置

### 環境變數

```bash
# 重複課程功能配置
RECURRING_COURSE_ENABLED=true
DYNAMIC_CALC_ENABLED=true
MAX_QUERY_RANGE_DAYS=90
MAX_OCCURRENCES_PER_QUERY=50

# 性能調優
RECURRING_CALCULATION_TIMEOUT=5000  # 5秒
CONFLICT_CHECK_ENABLED=true
```

### Firestore 規則

```javascript
// 安全規則確保重複類型一致性
match /courses/{courseId} {
  allow write: if validateRecurrenceType(resource.data);
}

function validateRecurrenceType(data) {
  let recurringTypes = [
    data.daily_recurring,
    data.weekly_recurring, 
    data.monthly_recurring
  ];
  
  let trueCount = recurringTypes.filter(type => type == true).size();
  
  return trueCount <= 1;
}
```