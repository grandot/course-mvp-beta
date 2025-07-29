# 多子女課程管理 - 4小時實施計劃

## 🎯 實施概述

採用語義嵌入法，通過最小改動實現多子女課程管理功能。總預計時間：4小時。

## 📋 實施步驟

### Phase 1: 語義識別增強（2小時）

#### Task 1.1: 更新 SemanticService（1.5小時）
**文件**: `src/services/semanticService.js`

**具體改動**:
```javascript
// 新增方法：提取子女名稱
static extractChildName(text) {
  // 匹配 2-4 個中文字符作為子女名稱
  const patterns = [
    /^([小大][一-龯]{1,2})\s/,     // 小明、小美、大寶等
    /^([一-龯]{2,3})\s/,           // 明明、美美、志強等
  ];
  
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match && this.isValidChildName(match[1])) {
      return match[1];
    }
  }
  return null;
}

// 修改 extractCourseEntities 方法
static async extractCourseEntities(text, userId, intent) {
  const childName = this.extractChildName(text);
  let processedText = text;
  
  if (childName) {
    // 移除子女名稱，處理剩餘部分
    processedText = text.substring(childName.length).trim();
  }
  
  // 原有邏輯提取課程信息
  const entities = await this.originalExtractLogic(processedText, userId, intent);
  
  // 如果有子女名稱，嵌入到課程名稱中
  if (childName && entities.course_name) {
    entities.course_name = `${childName}${entities.course_name}`;
  }
  
  return entities;
}
```

**測試要點**:
- ✅ "小明明天下午兩點鋼琴課" → course_name: "小明鋼琴課"
- ✅ "小美每週三早上十點法語課" → course_name: "小美法語課"
- ✅ "明天下午兩點鋼琴課" → course_name: "鋼琴課"（無子女名稱）

#### Task 1.2: 優化顯示邏輯（0.5小時）
**文件**: `src/scenario/templates/CourseManagementScenarioTemplate.js`

**具體改動**:
```javascript
// 優化課程顯示格式
formatCourseDisplay(course) {
  const { course_name, schedule_time, course_date } = course;
  
  // 智能識別並分離子女名稱
  const childPattern = /^([小大][一-龯]{1,2}|[一-龯]{2,3})(.+)/;
  const match = course_name.match(childPattern);
  
  if (match) {
    const [_, childName, courseName] = match;
    return `👦 ${childName}: ${courseName}\n🕒 時間：${schedule_time}`;
  }
  
  return `📚 ${course_name}\n🕒 時間：${schedule_time}`;
}
```

### Phase 2: 測試與驗證（1.5小時）

#### Task 2.1: 單元測試（0.5小時）
**文件**: `tests/semantic-child-name.test.js`

```javascript
describe('子女名稱語義識別', () => {
  test('應正確提取子女名稱', () => {
    const cases = [
      { input: '小明明天下午兩點鋼琴課', childName: '小明', courseName: '小明鋼琴課' },
      { input: '小美每週三早上十點法語課', childName: '小美', courseName: '小美法語課' },
      { input: '志強下週一游泳課', childName: '志強', courseName: '志強游泳課' },
      { input: '明天下午兩點鋼琴課', childName: null, courseName: '鋼琴課' },
    ];
    
    // 測試邏輯
  });
});
```

#### Task 2.2: 集成測試（0.5小時）
- 測試完整的訊息流程
- 驗證數據存儲正確性
- 確認顯示格式符合預期

#### Task 2.3: 手動測試（0.5小時）
- 在本地環境測試真實場景
- 驗證向後兼容性
- 收集優化反饋

### Phase 3: 文檔更新（0.5小時）

#### Task 3.1: 更新 CHANGELOG.md
```markdown
## [v10.2.0] - 2025-07-30

### Added
- **多子女課程管理（精簡版）**: 支持在自然語言中包含子女名稱
  - 自動識別 2-4 個中文字符的子女名稱
  - 課程顯示時智能分離子女信息
  - 零架構改動，完全向後兼容
  - 實現「小明明天下午兩點鋼琴課」等自然表達
```

#### Task 3.2: 更新用戶指南
- 添加多子女使用示例
- 說明支持的名稱格式
- 提供最佳實踐建議

## 🚀 部署計劃

### 部署前檢查
- [ ] 所有測試通過
- [ ] 向後兼容性確認
- [ ] 性能影響評估

### 部署步驟
1. 在測試環境驗證（10分鐘）
2. 部署到生產環境（5分鐘）
3. 監控系統表現（15分鐘）

## 📊 風險管理

### 低風險項目
1. **名稱識別準確性**
   - 緩解：使用保守的匹配規則
   - 影響：極少數特殊名稱可能無法識別

2. **顯示格式調整**
   - 緩解：保持原有格式作為後備
   - 影響：用戶需要適應新的顯示方式

### 零風險項目
- 數據結構：無改動
- API 接口：無改動
- 現有功能：完全不受影響

## ✅ 完成標準

1. **功能完成**
   - [ ] 子女名稱識別功能實現
   - [ ] 課程顯示優化完成
   - [ ] 測試案例全部通過

2. **質量標準**
   - [ ] 代碼改動 < 200 行
   - [ ] 測試覆蓋率 > 90%
   - [ ] 性能影響 < 5%

3. **文檔完成**
   - [ ] CHANGELOG 更新
   - [ ] 用戶指南更新
   - [ ] 代碼註釋完整

## 🎯 時間線

```
09:00 - 10:30  Phase 1: 語義識別增強
10:30 - 12:00  Phase 2: 測試與驗證  
12:00 - 12:30  Phase 3: 文檔更新
12:30 - 13:00  部署和監控
```

總計：4小時完成全部實施。