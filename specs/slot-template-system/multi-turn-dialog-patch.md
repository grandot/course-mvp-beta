# Multi-Turn Dialog Enhancement Patch 規劃

> 基於用戶反饋，針對 Slot Template System 進行多輪對話改進的詳細實作規劃

## 🎯 問題定義

### 當前問題案例

#### 案例 1: 多重格式問題
**用戶輸入**: "後台下午小美大提琴課"

**存在問題**:
1. "後台" 不是有效日期格式
2. "下午" 時間過於模糊，缺乏具體時間
3. 多個問題同時存在，系統行為不當

#### 案例 2: Slot 混雜提取問題 🚨 **新發現**
**用戶輸入**: "明天下午8點大提琴課"

**當前錯誤行為**:
- 課程名稱被錯誤提取為：`"課程：明天下午8點大提琴課"`
- 將時間、日期、角色都混雜進課程名稱中

**應該正確分離為**:
- 課程：大提琴課
- 日期：明天  
- 時間：下午8點

**根本問題**:
1. **混雜提取問題** - 將時間、日期、角色都塞進課程名稱
2. **缺乏智能分離** - 無法識別句子中的不同語義成分
3. **角色缺失處理** - 沒有角色時仍會混淆提取

### 期望行為規範
- **多問題 (≥2)**: 不記錄，提示重新輸入
- **單一問題**: 暫存正確信息，提問缺失部分
- **完整信息**: 直接記錄到 Firestore
- **必填欄位**: 課程名、日期、時間（未來：角色）

## 📋 實作任務分解

### 任務 1: 問題檢測與分類系統
**優先級**: P0 (最高)
**估時**: 2-3 天

#### 1.1 智能問題檢測器
- **文件**: `src/slot-template/slotProblemDetector.js`
- **職責**: 檢測 slot 填充中的各種問題類型

```javascript
class SlotProblemDetector {
  detectProblems(slotState, template) {
    return {
      invalidDate: [],      // 無效日期格式
      vagueTime: [],        // 模糊時間表達
      missingRequired: [],  // 缺失必填欄位
      formatErrors: [],     // 格式錯誤
      ambiguousValues: [],  // 歧義值
      mixedExtraction: []   // 混雜提取問題 🚨 新增
    };
  }
  
  // 🚨 新增：智能分離混雜的 slot 內容
  separateMixedSlots(slotState) {
    const separated = { ...slotState };
    
    // 檢查課程名稱是否包含時間/日期/角色信息
    if (separated.course && this.isMixedExtraction(separated.course)) {
      const separationResult = this.intelligentSlotSeparation(separated.course);
      return { ...separated, ...separationResult };
    }
    
    return separated;
  }
}
```

#### 1.2 問題類型定義
```javascript
const PROBLEM_TYPES = {
  INVALID_DATE: {
    code: 'invalid_date',
    severity: 'high',
    examples: ['後台', '昨天的明天', '不知道']
  },
  VAGUE_TIME: {
    code: 'vague_time', 
    severity: 'medium',
    examples: ['下午', '晚上', '早上', '中午']
  },
  MISSING_REQUIRED: {
    code: 'missing_required',
    severity: 'high',
    fields: ['course', 'date', 'time'] // 未來可加入 'student'
  },
  MIXED_EXTRACTION: {  // 🚨 新增問題類型
    code: 'mixed_extraction',
    severity: 'high',
    description: '課程名稱包含時間、日期或角色信息，需要智能分離',
    patterns: {
      timeInCourse: /.*[0-9]+點.*課$|.*下午.*課$|.*晚上.*課$/,
      dateInCourse: /.*明天.*課$|.*後天.*課$|.*今天.*課$/,
      mixedContent: /.*[明後今]天.*[0-9]+點.*課$|.*[下晚早中]午.*課$/
    }
  }
};
```

#### 1.3 檢測邏輯實作
- **日期檢測**: 使用正則表達式 + TimeService 驗證
- **時間檢測**: 識別模糊時間詞彙，檢查具體時間格式
- **必填欄位**: 根據模板定義動態檢查
- **混雜提取檢測**: 🚨 **新增功能**
  - 檢測課程名稱是否包含時間/日期/角色信息
  - 智能分離混雜內容為正確的 slot 值
  - 使用正則表達式模式匹配識別

**測試用例**:
```javascript
// 多問題檢測
input: "後台下午小美大提琴課"
expected: { 
  invalidDate: ['後台'], 
  vagueTime: ['下午'],
  problemCount: 2 
}

// 單一問題檢測  
input: "明天小美大提琴課"
expected: {
  vagueTime: ['沒有具體時間'],
  problemCount: 1
}

// 🚨 混雜提取問題檢測
input: "明天下午8點大提琴課"
expected: {
  mixedExtraction: {
    course: "明天下午8點大提琴課", // 錯誤的混雜提取
    should_be: {
      course: "大提琴課",
      date: "明天", 
      time: "下午8點"
    }
  },
  problemCount: 1
}

// 時間混雜檢測
input: "下午小提琴課"
expected: {
  mixedExtraction: {
    course: "下午小提琴課",
    should_be: {
      course: "小提琴課",
      time: "下午"
    }
  },
  problemCount: 1
}
```

---

### 任務 2: 多輪對話狀態管理
**優先級**: P0 (最高)
**估時**: 2-3 天

#### 2.1 暫存狀態管理器
- **文件**: `src/slot-template/tempSlotStateManager.js`
- **職責**: 管理暫時的 slot 狀態，支援多輪對話

```javascript
class TempSlotStateManager {
  // 創建暫存狀態
  async createTempState(userId, validSlots, problems) {
    return {
      tempId: generateTempId(),
      userId,
      validSlots,      // 已驗證的正確 slots
      problems,        // 檢測到的問題
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 30 * 60 * 1000), // 30分鐘過期
      status: 'pending_completion'
    };
  }

  // 合併補充信息
  async mergeSupplementInfo(tempId, newSlots) {
    // 將新的 slot 信息與暫存狀態合併
  }

  // 檢查是否完整
  isComplete(tempState, template) {
    // 檢查是否所有必填欄位都已填充
  }
}
```

#### 2.2 狀態存儲策略
- **記憶體快取**: 短期暫存 (LRU Cache, 最多100個)
- **Redis備選**: 生產環境可選用 Redis
- **自動清理**: 30分鐘過期機制

#### 2.3 上下文檢測邏輯
```javascript
// 檢測用戶是否在補充信息
async detectSupplementIntent(userId, userInput) {
  const tempState = await this.getTempState(userId);
  if (!tempState) return null;
  
  // 分析用戶輸入是否為補充信息
  const isSupplementing = await this.analyzeSupplementPattern(userInput, tempState.problems);
  return isSupplementing ? tempState : null;
}
```

**測試用例**:
```javascript
// 暫存狀態創建
user: "明天小美大提琴課" (缺具體時間)
tempState: {
  validSlots: { course: "大提琴課", student: "小美", date: "2025-07-29" },
  problems: [{ type: "missing_time", message: "請提供具體時間" }]
}

// 補充信息合併
user: "下午3點"
merged: { ...validSlots, time: "15:00" }
```

---

### 任務 3: 智能提示訊息生成
**優先級**: P1 (高)
**估時**: 1-2 天

#### 3.1 人性化提示生成器
- **文件**: `src/slot-template/humanPromptGenerator.js`
- **職責**: 根據問題類型生成人性化提示

```javascript
class HumanPromptGenerator {
  generateMultiProblemPrompt(problems, validSlots) {
    return {
      type: 'multi_problem',
      message: this.buildFriendlyMessage(problems),
      suggestions: this.generateSuggestions(problems),
      examples: this.getExamples(problems)
    };
  }

  generateSingleProblemPrompt(problem, validSlots) {
    return {
      type: 'single_problem',  
      confirmation: this.confirmValidInfo(validSlots),
      question: this.askMissingInfo(problem),
      examples: this.getSpecificExamples(problem.type)
    };
  }
}
```

#### 3.2 提示訊息模板
```javascript
const PROMPT_TEMPLATES = {
  MULTI_PROBLEM: {
    prefix: "我需要一些更清楚的資訊才能幫您安排課程：",
    format: "• {problem_description}\n",
    footer: "請重新完整輸入課程資訊，例如：「明天下午3點小美大提琴課」"
  },
  
  SINGLE_PROBLEM: {
    confirmation: "我已記錄：{confirmed_info}",
    question: "還需要確認：{missing_info}",
    example: "例如可以回覆：{example}"
  },

  PROBLEM_DESCRIPTIONS: {
    invalid_date: "日期資訊不清楚（「{value}」無法識別為有效日期）",
    vague_time: "時間需要更具體（「{value}」請提供確切時間）",
    missing_required: "缺少{field_name}資訊"
  }
};
```

#### 3.3 上下文感知提示
- **確認已收集資訊**: "✅ 已記錄：大提琴課、小美、明天"
- **明確詢問缺失**: "🕐 還需要確認上課時間"
- **提供具體範例**: "例如：下午3點、晚上7點半、19:30"

**測試用例**:
```javascript
// 多問題提示
problems: [{ type: 'invalid_date', value: '後台' }, { type: 'vague_time', value: '下午' }]
expected: "我需要一些更清楚的資訊才能幫您安排課程：\n• 日期資訊不清楚（「後台」無法識別為有效日期）\n• 時間需要更具體（「下午」請提供確切時間）\n\n請重新完整輸入課程資訊，例如：「明天下午3點小美大提琴課」"

// 單一問題提示  
validSlots: { course: "大提琴課", student: "小美", date: "2025-07-29" }
problem: { type: "missing_time" }
expected: "✅ 已記錄：大提琴課、小美、明天\n🕐 還需要確認上課時間\n例如可以回覆：下午3點、晚上7點半、19:30"
```

---

### 任務 4: 流程控制邏輯整合
**優先級**: P0 (最高)
**估時**: 2-3 天

#### 4.1 主控制器增強
- **文件**: `src/slot-template/slotTemplateManager.js` (修改)
- **新增方法**: `processWithProblemDetection()`
- **🚨 新增功能**: Slot 智能分離邏輯

```javascript
class SlotTemplateManager {
  async processWithProblemDetection(userId, semanticResult) {
    // Step 1: 檢查是否為補充信息
    const tempState = await this.tempStateManager.detectSupplementIntent(userId, semanticResult.text);
    
    if (tempState) {
      return await this.handleSupplementInfo(userId, tempState, semanticResult);
    }
    
    // Step 2: 正常 slot 處理
    const slotResult = await this.processSemanticResult(userId, semanticResult);
    
    // Step 3: 問題檢測
    const problems = await this.problemDetector.detectProblems(slotResult.slot_state, slotResult.template);
    
    // Step 4: 根據問題數量決定處理策略
    return await this.handleProblemsStrategy(userId, slotResult, problems);
  }

  async handleProblemsStrategy(userId, slotResult, problems) {
    const problemCount = this.countUniqueProblems(problems);
    
    // 🚨 檢查是否有混雜提取問題，優先處理
    const mixedProblem = problems.find(p => p.type === 'mixed_extraction');
    if (mixedProblem) {
      const separatedSlots = await this.separateMixedSlots(slotResult.slot_state, mixedProblem);
      // 重新處理分離後的 slots
      return await this.processWithProblemDetection(userId, { 
        ...semanticResult, 
        entities: separatedSlots 
      });
    }
    
    if (problemCount === 0) {
      // 完整信息，直接執行任務
      return await this.executeTask(userId, slotResult);
    } else if (problemCount === 1) {
      // 單一問題，創建暫存狀態
      return await this.createTempStateAndPrompt(userId, slotResult, problems);
    } else {
      // 多問題，要求重新輸入
      return await this.generateMultiProblemPrompt(problems, slotResult.slot_state);
    }
  }

  // 🚨 新增方法：智能分離混雜的 Slot 內容
  async separateMixedSlots(slotState, mixedProblem) {
    const { course } = slotState;
    const separatedSlots = { ...slotState };
    
    // 使用正則表達式和語意分析分離內容
    const separationResult = await this.intelligentSlotSeparation(course);
    
    // 更新分離後的 slots
    if (separationResult.pureCourse) {
      separatedSlots.course = separationResult.pureCourse;
    }
    if (separationResult.extractedDate) {
      separatedSlots.date = separationResult.extractedDate;
    }
    if (separationResult.extractedTime) {
      separatedSlots.time = separationResult.extractedTime;
    }
    
    return separatedSlots;
  }

  // 智能語義分離核心邏輯
  async intelligentSlotSeparation(mixedCourse) {
    // 使用 Claude API 進行智能分離（僅在 SemanticService 調用）
    // 或者使用規則引擎進行基本分離
    return {
      pureCourse: this.extractPureCourse(mixedCourse),
      extractedDate: this.extractDateFromCourse(mixedCourse),
      extractedTime: this.extractTimeFromCourse(mixedCourse)
    };
  }
}
```

#### 4.2 補充信息處理邏輯
```javascript
async handleSupplementInfo(userId, tempState, semanticResult) {
  // 合併新信息到暫存狀態
  const mergedState = await this.tempStateManager.mergeSupplementInfo(
    tempState.tempId, 
    semanticResult.entities
  );
  
  // 重新檢查問題
  const remainingProblems = await this.problemDetector.detectProblems(
    mergedState.validSlots, 
    tempState.template
  );
  
  if (remainingProblems.length === 0) {
    // 信息完整，執行任務並清理暫存
    const result = await this.executeTask(userId, mergedState);
    await this.tempStateManager.clearTempState(tempState.tempId);
    return result;
  } else {
    // 仍有問題，繼續等待補充
    return await this.generateSingleProblemPrompt(remainingProblems[0], mergedState.validSlots);
  }
}
```

#### 4.3 SemanticService 整合點修改
- **文件**: `src/services/semanticService.js` (修改)
- **修改**: `analyzeMessageWithSlotTemplate()` 方法

```javascript
// 在 Step 2 後加入問題檢測邏輯
if (enableSlotTemplate && this.slotTemplateEnabled && semanticResult.success) {
  const slotResult = await this.slotTemplateManager.processWithProblemDetection(
    userId, 
    { ...semanticResult, text: text }
  );
  
  return {
    ...semanticResult,
    slotTemplate: slotResult,
    usedProblemDetection: true
  };
}
```

---

### 任務 5: 必填欄位驗證增強
**優先級**: P1 (高)
**估時**: 1 天

#### 5.1 動態必填欄位配置
- **文件**: `config/slot-templates/course-management.json` (修改)
- **新增配置**:

```json
{
  "completion_rules": {
    "minimum_required": ["course", "date", "time"],
    "future_required": ["student"],
    "validation_rules": {
      "date": {
        "format": "YYYY-MM-DD",
        "allow_relative": true,
        "invalid_patterns": ["後台", "前台", "那邊", "這裡"]
      },
      "time": {
        "format": "HH:mm",
        "vague_patterns": ["下午", "晚上", "早上", "中午", "傍晚"],
        "require_specific": true
      }
    }
  }
}
```

#### 5.2 SlotValidator 增強
- **文件**: `src/slot-template/slotValidator.js` (修改)
- **新增方法**: `validateWithProblemDetection()`

```javascript
validateWithProblemDetection(slotState, template) {
  const problems = [];
  
  // 檢查必填欄位
  for (const required of template.completion_rules.minimum_required) {
    if (!slotState[required] || slotState[required] === null) {
      problems.push({
        type: 'missing_required',
        field: required,
        severity: 'high'
      });
    }
  }
  
  // 檢查欄位品質
  problems.push(...this.validateFieldQuality(slotState, template));
  
  return problems;
}
```

---

### 任務 6: 測試與驗證
**優先級**: P1 (高)
**估時**: 2 天

#### 6.1 端到端測試場景
```javascript
describe('Multi-Turn Dialog Enhancement', () => {
  test('多問題處理 - 不記錄要求重新輸入', async () => {
    const input = "後台下午小美大提琴課";
    const result = await processMessage(input, userId);
    
    expect(result.type).toBe('multi_problem_prompt');
    expect(result.recorded).toBe(false);
    expect(result.message).toContain('我需要一些更清楚的資訊');
  });

  test('單一問題處理 - 暫存並詢問', async () => {
    const input = "明天小美大提琴課";
    const result = await processMessage(input, userId);
    
    expect(result.type).toBe('single_problem_prompt');
    expect(result.tempState).toBeDefined();
    expect(result.message).toContain('已記錄');
    expect(result.message).toContain('還需要確認');
  });

  test('補充信息處理 - 合併並完成', async () => {
    // 先創建暫存狀態
    await processMessage("明天小美大提琴課", userId);
    
    // 補充時間信息
    const result = await processMessage("下午3點", userId);
    
    expect(result.type).toBe('task_completed');
    expect(result.course.course_name).toBe('大提琴課');
    expect(result.course.schedule_time).toBe('15:00');
  });

  // 🚨 新增混雜提取測試用例
  test('混雜提取問題檢測與自動分離', async () => {
    const input = "明天下午8點大提琴課";
    const result = await processMessage(input, userId);
    
    expect(result.type).toBe('task_completed'); // 自動分離後完成
    expect(result.course.course_name).toBe('大提琴課'); // 純課程名
    expect(result.course.date).toBe('2025-07-29'); // 分離出的日期
    expect(result.course.schedule_time).toBe('20:00'); // 分離出的時間
  });

  test('時間混雜提取檢測', async () => {
    const input = "下午小提琴課";
    const result = await processMessage(input, userId);
    
    expect(result.type).toBe('single_problem_prompt'); // 時間模糊需要確認
    expect(result.tempState.validSlots.course).toBe('小提琴課'); // 分離出純課程名
    expect(result.tempState.validSlots.time).toContain('下午'); // 保留模糊時間待確認
  });

  test('複雜混雜提取 - 多重分離', async () => {
    const input = "明天下午小美鋼琴課";
    const result = await processMessage(input, userId);
    
    expect(result.type).toBe('single_problem_prompt'); // 時間模糊需要確認
    expect(result.tempState.validSlots.course).toBe('鋼琴課');
    expect(result.tempState.validSlots.student).toBe('小美');
    expect(result.tempState.validSlots.date).toBe('2025-07-29');
    expect(result.message).toContain('還需要確認上課時間');
  });
});
```

#### 6.2 性能測試
- **暫存狀態管理**: 支援 100+ 並發用戶
- **問題檢測延遲**: < 100ms
- **記憶體使用**: 暫存狀態 < 10MB

#### 6.3 用戶體驗測試
- **提示訊息清晰度**: A/B 測試不同提示模板
- **學習曲線**: 用戶首次使用成功率 > 80%
- **完成率**: 多輪對話任務完成率 > 90%

---

## 🎯 開發優先級與里程碑

### Phase 1: 核心檢測系統 (第1-3天)
- ✅ SlotProblemDetector 實作
- ✅ TempSlotStateManager 基礎功能
- ✅ 基本問題檢測邏輯

### Phase 2: 流程整合 (第4-6天)  
- ✅ SlotTemplateManager 增強
- ✅ SemanticService 整合點修改
- ✅ 多輪對話邏輯完成

### Phase 3: 用戶體驗優化 (第7-8天)
- ✅ HumanPromptGenerator 實作
- ✅ 提示訊息模板優化
- ✅ 端到端測試完成

## 🔧 技術債務與注意事項

### 向後兼容性
- 保持現有 API 不變
- 透過功能開關漸進部署
- 降級策略：出錯時回到原始邏輯

### 性能考量
- 暫存狀態自動清理機制
- 問題檢測快取優化  
- 並發處理限制

### 監控與觀測
- 多輪對話成功率統計
- 問題檢測準確度監控
- 用戶放棄率追蹤

---

**總估時**: 8-10 天
**關鍵成功指標**: 
- 多問題檢測準確率 > 95%
- 單一問題暫存成功率 > 90%  
- 🚨 **混雜提取檢測準確率 > 95%** 
- 🚨 **Slot 智能分離成功率 > 90%**
- 🚨 **預防混雜提取復發率 < 5%**
- 用戶體驗滿意度提升 30%

## 🚨 混雜提取問題解決方案總結

### 問題根因分析
1. **語意解析階段缺陷** - Claude API 未能正確識別句子中的語義成分
2. **Slot 填充邏輯缺陷** - 缺乏智能分離機制，直接將混雜內容填入課程名稱
3. **後處理驗證不足** - 沒有檢測和修正混雜提取的機制

### 解決策略
1. **檢測階段** - 在 `SlotProblemDetector` 中加入 `MIXED_EXTRACTION` 檢測
2. **分離階段** - 在 `SlotTemplateManager` 中實作智能分離邏輯
3. **預防階段** - 在 `SemanticService` 中改進語意解析品質
4. **驗證階段** - 通過測試確保分離準確性

### 技術實作重點
- **正則表達式模式匹配** - 快速識別混雜內容
- **智能語義分離** - 提取純淨的 slot 值
- **遞迴處理機制** - 分離後重新檢測問題
- **降級處理策略** - 分離失敗時的 fallback 機制

---

## 📋 Task Monitoring Checklist

### 任務 1: 問題檢測與分類系統 (2-3天)
- [x] **1.1.1** 創建 `slotProblemDetector.js` 文件
- [x] **1.1.2** 實作 `detectProblems()` 核心方法
- [x] **1.1.3** 實作 `separateMixedSlots()` 智能分離方法
- [x] **1.1.4** 實作 `intelligentSlotSeparation()` 語義分離邏輯
- [x] **1.2.1** 定義所有問題類型常數 (`PROBLEM_TYPES`)
- [x] **1.2.2** 新增 `MIXED_EXTRACTION` 問題類型
- [x] **1.2.3** 配置混雜提取正則表達式模式
- [x] **1.3.1** 實作日期檢測邏輯
- [x] **1.3.2** 實作時間檢測邏輯
- [x] **1.3.3** 實作混雜提取檢測邏輯
- [x] **1.3.4** 編寫問題檢測測試用例 (多問題、單一問題、混雜提取)

### 任務 2: 多輪對話狀態管理 (2-3天)
- [x] **2.1.1** 創建 `tempSlotStateManager.js` 文件
- [x] **2.1.2** 實作 `createTempState()` 方法
- [x] **2.1.3** 實作 `mergeSupplementInfo()` 方法
- [x] **2.1.4** 實作 `isComplete()` 檢查方法
- [x] **2.1.5** 實作 `clearTempState()` 清理方法
- [x] **2.2.1** 設置 LRU 記憶體快取系統
- [x] **2.2.2** 實作 30分鐘自動過期機制
- [x] **2.2.3** 實作自動清理過期狀態
- [x] **2.3.1** 實作 `detectSupplementIntent()` 方法
- [x] **2.3.2** 實作 `analyzeSupplementPattern()` 補充信息識別
- [x] **2.3.3** 編寫暫存狀態管理測試用例

### 任務 3: 智能提示訊息生成 (1-2天)
- [x] **3.1.1** 創建 `humanPromptGenerator.js` 文件
- [x] **3.1.2** 實作 `generateMultiProblemPrompt()` 方法
- [x] **3.1.3** 實作 `generateSingleProblemPrompt()` 方法
- [x] **3.2.1** 定義提示訊息模板 (`PROMPT_TEMPLATES`)
- [x] **3.2.2** 實作問題描述模板 (`PROBLEM_DESCRIPTIONS`)
- [x] **3.2.3** 實作範例生成邏輯
- [x] **3.3.1** 實作確認已收集資訊功能
- [x] **3.3.2** 實作明確詢問缺失功能
- [x] **3.3.3** 實作具體範例提供功能
- [x] **3.3.4** 編寫提示訊息生成測試用例

### 任務 4: 流程控制邏輯整合 (2-3天)
- [x] **4.1.1** 修改 `slotTemplateManager.js` 添加 `processWithProblemDetection()` 方法
- [x] **4.1.2** 實作 `handleProblemsStrategy()` 問題處理策略
- [x] **4.1.3** 實作混雜提取優先處理邏輯
- [x] **4.1.4** 實作 `separateMixedSlots()` 整合方法
- [x] **4.1.5** 實作 `intelligentSlotSeparation()` 核心分離邏輯
- [x] **4.2.1** 實作 `handleSupplementInfo()` 補充信息處理
- [x] **4.2.2** 實作狀態合併與重新檢測邏輯
- [x] **4.2.3** 實作任務完成與暫存清理邏輯
- [x] **4.3.1** 修改 `semanticService.js` 整合檢測邏輯
- [x] **4.3.2** 更新 `analyzeMessageWithSlotTemplate()` 方法
- [x] **4.3.3** 添加問題檢測結果返回機制

### 任務 5: 必填欄位驗證增強 (1天)
- [x] **5.1.1** 修改 `course-management.json` 模板配置
- [x] **5.1.2** 添加動態必填欄位配置
- [x] **5.1.3** 添加驗證規則配置 (`validation_rules`)
- [x] **5.1.4** 配置無效日期和模糊時間模式
- [x] **5.2.1** 修改 `slotValidator.js` 添加 `validateWithProblemDetection()` 方法
- [x] **5.2.2** 實作必填欄位檢查邏輯
- [x] **5.2.3** 實作欄位品質驗證邏輯
- [x] **5.2.4** 編寫驗證增強測試用例

### 任務 6: 測試與驗證 (2天)
- [x] **6.1.1** 編寫多問題處理端到端測試
- [x] **6.1.2** 編寫單一問題暫存測試
- [x] **6.1.3** 編寫補充信息合併測試
- [x] **6.1.4** 編寫混雜提取檢測與自動分離測試
- [x] **6.1.5** 編寫時間混雜提取檢測測試
- [x] **6.1.6** 編寫複雜混雜提取多重分離測試
- [x] **6.2.1** 性能測試 - 暫存狀態管理 (100+ 用戶)
- [x] **6.2.2** 性能測試 - 問題檢測延遲 (< 100ms)
- [x] **6.2.3** 性能測試 - 記憶體使用 (< 10MB)
- [x] **6.3.1** 用戶體驗測試 - 提示訊息清晰度
- [x] **6.3.2** 用戶體驗測試 - 學習曲線 (> 80% 成功率)
- [x] **6.3.3** 用戶體驗測試 - 完成率 (> 90% 多輪對話)

### 部署與監控
- [ ] **D.1** 設置功能開關漸進部署
- [ ] **D.2** 配置向後兼容性確保
- [ ] **D.3** 實作降級策略機制
- [ ] **D.4** 建立多輪對話成功率監控
- [ ] **D.5** 建立問題檢測準確度監控
- [ ] **D.6** 建立用戶放棄率追蹤

### 成功指標驗證
- [ ] **KPI.1** 多問題檢測準確率 > 95%
- [ ] **KPI.2** 單一問題暫存成功率 > 90%
- [ ] **KPI.3** 混雜提取檢測準確率 > 95%
- [ ] **KPI.4** Slot 智能分離成功率 > 90%
- [ ] **KPI.5** 預防混雜提取復發率 < 5%
- [ ] **KPI.6** 用戶體驗滿意度提升 30%

---

**總任務數**: 62 個子任務  
**預估工時**: 8-10 天  
**完成進度**: 0/62 (0%)