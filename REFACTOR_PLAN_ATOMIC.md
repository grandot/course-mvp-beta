# 方案四原子化重構計劃

## 🧬 第一性原則指導思想

**核心理念**: 單一職責 + 契約驅動 + 逐層驗證  
**拆分原則**: 每個步驟只修改一個原子模組，立即建立測試，確保契約正確  
**失敗策略**: 任一步驟失敗立即回滾，不影響其他模組  

---

## 📋 原子化步驟規劃

### 🎯 Step 1: TimeService 契約標準化 (基礎層)
**目標**: 建立時間處理的統一契約  
**原子範圍**: 僅 `src/utils/timeService.js`  
**風險等級**: 🟢 最低 (純工具函數)

#### 1.1 添加標準化方法
```javascript
// 新增方法，不修改現有方法
static createTimeInfo(parsedTime) {
  if (!parsedTime) return null;
  return {
    display: this.formatForDisplay(parsedTime),
    date: this.formatForStorage(parsedTime), 
    raw: parsedTime,
    timestamp: new Date(parsedTime).getTime()
  };
}

static formatForDisplay(isoTime) {
  // MM/DD HH:MM AM/PM 格式
}

static formatForStorage(isoTime) {
  // YYYY-MM-DD 格式
}

static validateTimeInfo(timeInfo) {
  // 契約驗證
}
```

#### 1.2 創建原子測試
```javascript
// __tests__/timeService.atomic.test.js
describe('TimeService Atomic Tests', () => {
  test('createTimeInfo contract', () => {
    const result = TimeService.createTimeInfo('2025-07-26T14:30:00.000Z');
    expect(result).toHaveProperty('display');
    expect(result).toHaveProperty('date');
    expect(result).toHaveProperty('raw');
    expect(result.display).toMatch(/\d{2}\/\d{2} \d{1,2}:\d{2} (AM|PM)/);
  });
});
```

**驗證標準**: 新測試通過 + 現有 TimeService 測試不受影響

---

### 🎯 Step 2: SemanticService 輸出契約重構 (語義層)
**目標**: 統一 SemanticService 的輸出格式  
**原子範圍**: 僅 `src/services/semanticService.js` 輸出格式  
**依賴**: Step 1 完成

#### 2.1 修改 analyzeMessage 輸出契約
```javascript
// 修改返回結構，將時間信息整合到 entities
return {
  success: true,
  intent: ruleResult.intent,
  confidence: ruleResult.confidence,
  entities: {
    course_name: entities.course_name,
    location: entities.location,
    teacher: entities.teacher,
    // ✅ 使用 TimeService 標準化時間信息
    timeInfo: timeInfo?.parsed_time 
      ? TimeService.createTimeInfo(timeInfo.parsed_time)
      : null
  },
  context,
  analysis_time: Date.now(),
};
```

#### 2.2 創建契約驗證測試
```javascript
// __tests__/semanticService.contract.test.js
describe('SemanticService Contract Tests', () => {
  test('analyzeMessage output contract', async () => {
    const result = await semanticService.analyzeMessage('明天2點數學課', 'test-user');
    expect(result).toHaveProperty('entities');
    expect(result.entities).toHaveProperty('course_name');
    expect(result.entities).toHaveProperty('timeInfo');
    
    if (result.entities.timeInfo) {
      expect(TimeService.validateTimeInfo(result.entities.timeInfo)).toBe(true);
    }
  });
});
```

**驗證標準**: 新契約測試通過 + TimeService 測試保持通過

---

### 🎯 Step 3: 創建 TaskService 原子模組 (任務層)
**目標**: 創建任務執行協調層  
**原子範圍**: 新建 `src/services/taskService.js`  
**依賴**: Step 2 完成

#### 3.1 創建 TaskService 基礎結構
```javascript
// src/services/taskService.js
class TaskService {
  static async executeIntent(intent, entities, userId) {
    // 使用新的契約格式：entities.timeInfo
    switch (intent) {
      case 'record_course':
        return this.handleRecordCourse(entities, userId);
      default:
        return { success: false, error: 'Unknown intent' };
    }
  }

  static async handleRecordCourse(entities, userId) {
    // 驗證新的數據契約
    if (!entities.course_name || !entities.timeInfo) {
      return {
        success: false,
        error: 'Missing required course information'
      };
    }

    // 使用 dataService，時間已經格式化
    return dataService.createCourse({
      student_id: userId,
      course_name: entities.course_name,
      schedule_time: entities.timeInfo.display,
      course_date: entities.timeInfo.date,
      location: entities.location,
      teacher: entities.teacher,
    });
  }
}
```

#### 3.2 創建 TaskService 原子測試
```javascript
// __tests__/taskService.atomic.test.js
describe('TaskService Atomic Tests', () => {
  test('handleRecordCourse with correct contract', async () => {
    const entities = {
      course_name: '數學',
      timeInfo: {
        display: '07/26 2:30 PM',
        date: '2025-07-26',
        raw: '2025-07-26T14:30:00.000Z'
      }
    };
    
    const result = await TaskService.handleRecordCourse(entities, 'test-user');
    expect(result.success).toBe(true);
  });
});
```

**驗證標準**: TaskService 測試通過 + 之前所有測試保持通過

---

### 🎯 Step 4: LineController 原子重構 (控制層)
**目標**: 修改 Controller 使用新的數據契約  
**原子範圍**: 僅 `src/controllers/lineController.js` 的數據使用部分  
**依賴**: Step 3 完成

#### 4.1 修改 handleTextMessage 使用新契約
```javascript
// 只修改數據使用部分，其他邏輯保持不變
static async handleTextMessage(event) {
  // ... 語義分析部分不變 ...
  
  const { intent, entities, confidence } = analysis;
  
  // ✅ 使用 TaskService 統一處理
  const result = await TaskService.executeIntent(intent, entities, userId);

  // ... 回覆處理邏輯不變 ...
}
```

#### 4.2 創建端到端原子測試
```javascript
// __tests__/lineController.e2e.test.js
describe('LineController E2E Atomic Tests', () => {
  test('end-to-end with real semantic service', async () => {
    const event = {
      message: { text: '明天晚上十點半法語課' },
      source: { userId: 'test-user-123' }
    };
    
    const result = await LineController.handleTextMessage(event);
    expect(result.success).toBe(true);
    expect(result.intent).toBe('record_course');
  });
});
```

**驗證標準**: E2E 測試通過 + 功能完全正常

---

### 🎯 Step 5: 測試重構與清理 (測試層)
**目標**: 更新所有測試使用正確的數據契約  
**原子範圍**: 測試文件逐個更新  
**依賴**: Step 4 完成

#### 5.1 更新 lineController 測試
```javascript
// 修改 __tests__/lineController.test.js
semanticService.analyzeMessage.mockResolvedValue({
  success: true,
  intent: 'record_course',
  confidence: 0.85,
  entities: {
    course_name: '數學',
    location: null,
    teacher: null,
    timeInfo: {  // ✅ 正確的契約結構
      display: '07/26 2:00 PM',
      date: '2025-07-26',
      raw: '2025-07-26T14:00:00.000Z'
    }
  }
});
```

#### 5.2 逐個驗證測試文件
- `__tests__/semanticService.test.js` 
- `__tests__/timeService.test.js`
- `__tests__/courseService.test.js`
- 每修改一個立即運行測試確保不破壞

**驗證標準**: 所有 188 個測試更新後仍然通過

---

### 🎯 Step 6: 重複邏輯清理 (優化層)
**目標**: 清理重複的時間提取邏輯  
**原子範圍**: SemanticService 內部邏輯優化  
**依賴**: Step 5 完成

#### 6.1 消除重複時間提取
```javascript
// 在 SemanticService 中統一時間處理
static async analyzeMessage(text, userId, context = {}) {
  // 使用規則引擎或 OpenAI
  // 統一在這裡調用 TimeService.createTimeInfo
  // 移除 extractTimeInfo 的重複調用
}
```

#### 6.2 驗證性能和邏輯
```javascript
// __tests__/performance.test.js
test('no duplicate time extraction', () => {
  // 驗證只調用一次時間解析
});
```

**驗證標準**: 邏輯更清晰 + 性能沒有下降 + 所有測試通過

---

## 🛡️ 失敗恢復策略

### 原子回滾機制
```bash
# 每個 Step 建立 Git 檢查點
git checkout -b step-1-timeservice-contract
# ... 完成 Step 1 ...
git add . && git commit -m "Step 1: TimeService contract standardization"

# 如果 Step 2 失敗
git checkout main  # 回到安全狀態
git branch -D step-2-failed  # 清理失敗分支
```

### 驗證檢查點
每個 Step 完成後必須通過：
1. ✅ **單元測試**: 當前模組測試通過
2. ✅ **回歸測試**: 之前所有測試保持通過  
3. ✅ **契約測試**: 新契約符合預期
4. ✅ **功能測試**: 核心功能正常工作

---

## 📊 實施時間估算

| Step | 模組 | 開發時間 | 測試時間 | 總計 |
|------|------|----------|----------|------|
| 1 | TimeService 契約 | 30分鐘 | 30分鐘 | 1小時 |
| 2 | SemanticService 重構 | 45分鐘 | 30分鐘 | 1.25小時 |
| 3 | TaskService 創建 | 60分鐘 | 45分鐘 | 1.75小時 |
| 4 | LineController 重構 | 30分鐘 | 45分鐘 | 1.25小時 |
| 5 | 測試更新 | 45分鐘 | 60分鐘 | 1.75小時 |
| 6 | 邏輯清理 | 30分鐘 | 15分鐘 | 0.75小時 |
| **總計** | | **3.5小時** | **3.25小時** | **6.75小時** |

---

## ✅ 成功標準

### 技術指標
1. **測試覆蓋**: 所有 188+ 測試通過
2. **架構合規**: ESLint 無違規警告
3. **功能驗證**: "明天晚上十點半法語課" 成功執行
4. **性能指標**: 響應時間不超過 500ms

### 業務指標  
1. **數據完整**: 時間信息正確提取和格式化
2. **錯誤處理**: 邊界情況妥善處理
3. **用戶體驗**: 回覆信息准確清晰

### 架構指標
1. **契約清晰**: 每層數據格式明確定義
2. **職責分離**: 每個模組職責單一明確  
3. **擴展性**: 新功能易於添加
4. **可維護**: 代碼邏輯清晰，易於理解

---

**文檔版本**: v1.0  
**創建時間**: 2025-07-25  
**預計完成**: 2025-07-25 (同日)  
**狀態**: 計劃已制定，等待執行確認