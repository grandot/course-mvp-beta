# 多子女課程管理 - 技術設計

## 🏗️ 架構設計

### 核心理念：語義嵌入法
將子女信息作為課程名稱的一部分，在語義層處理，保持數據層不變。

```
用戶輸入 → 語義處理（提取子女+課程） → 合併為課程名稱 → 存儲 → 智能顯示
```

## 🔧 技術實現細節

### 1. 語義層增強

#### 1.1 子女名稱識別邏輯

```javascript
// src/services/semanticService.js

class SemanticService {
  // 子女名稱模式定義
  static CHILD_NAME_PATTERNS = [
    {
      pattern: /^([小大][一-龯]{1,2})(?:\s|的|今天|明天|下週|每)/,
      description: '小/大 + 1-2個中文字符',
      examples: ['小明', '小美', '大寶']
    },
    {
      pattern: /^([一-龯]{2,3})(?:\s|的|今天|明天|下週|每)/,
      description: '2-3個中文字符', 
      examples: ['明明', '志強', '美美']
    }
  ];

  // 驗證是否為有效的子女名稱
  static isValidChildName(name) {
    // 排除明顯的非人名詞彙
    const excludeWords = ['今天', '明天', '下週', '每週', '每天', '週一', '週二'];
    if (excludeWords.includes(name)) return false;
    
    // 長度檢查
    if (name.length < 2 || name.length > 4) return false;
    
    // 只包含中文字符
    return /^[一-龯]+$/.test(name);
  }

  // 提取子女名稱
  static extractChildName(text) {
    for (const { pattern } of this.CHILD_NAME_PATTERNS) {
      const match = text.match(pattern);
      if (match && this.isValidChildName(match[1])) {
        return {
          name: match[1],
          remainingText: text.substring(match.index + match[1].length).trim()
        };
      }
    }
    return null;
  }

  // 增強的實體提取
  static async extractCourseEntities(text, userId, intent) {
    console.log('🔍 [SemanticService] 開始提取實體:', text);
    
    // Step 1: 嘗試提取子女名稱
    const childInfo = this.extractChildName(text);
    let processedText = text;
    let childName = null;
    
    if (childInfo) {
      childName = childInfo.name;
      processedText = childInfo.remainingText;
      console.log(`👶 [SemanticService] 識別到子女: ${childName}`);
    }
    
    // Step 2: 使用原有邏輯提取其他實體
    const entities = await this.originalExtractCourseEntities(processedText, userId, intent);
    
    // Step 3: 如果有子女名稱且有課程名稱，進行合併
    if (childName && entities.course_name) {
      // 避免重複（如果課程名已包含子女名）
      if (!entities.course_name.startsWith(childName)) {
        entities.course_name = `${childName}${entities.course_name}`;
      }
      
      // 保留原始子女信息供顯示使用
      entities._child_name = childName;
    }
    
    console.log('✅ [SemanticService] 實體提取完成:', entities);
    return entities;
  }
}
```

#### 1.2 邊界情況處理

```javascript
// 特殊情況處理
static handleSpecialCases(text) {
  // 處理所有格：「小明的鋼琴課」
  text = text.replace(/^([一-龯]{2,4})的/, '$1 ');
  
  // 處理連接詞：「幫小明安排」
  text = text.replace(/^幫([一-龯]{2,4})/, '$1 ');
  
  return text;
}
```

### 2. 顯示層優化

#### 2.1 智能顯示分離

```javascript
// src/scenario/templates/CourseManagementScenarioTemplate.js

formatCourseForDisplay(course) {
  const { course_name, schedule_time, course_date, is_recurring } = course;
  
  // 嘗試分離子女名稱
  const childInfo = this.extractChildFromCourseName(course_name);
  
  let displayText = '';
  
  if (childInfo.hasChild) {
    // 有子女信息的顯示格式
    displayText = `👦 ${childInfo.childName}\n`;
    displayText += `📚 ${childInfo.courseName}\n`;
  } else {
    // 無子女信息的顯示格式（保持原樣）
    displayText = `📚 ${course_name}\n`;
  }
  
  // 添加時間信息
  displayText += `🕒 時間：${schedule_time}`;
  
  // 添加重複標記
  if (is_recurring) {
    displayText += ' 🔄';
  }
  
  return displayText;
}

// 從課程名稱中提取子女信息
extractChildFromCourseName(courseName) {
  // 使用與語義層相同的模式
  const patterns = [
    /^([小大][一-龯]{1,2})(.+)$/,
    /^([一-龯]{2,3})(.+)$/
  ];
  
  for (const pattern of patterns) {
    const match = courseName.match(pattern);
    if (match) {
      return {
        hasChild: true,
        childName: match[1],
        courseName: match[2]
      };
    }
  }
  
  return {
    hasChild: false,
    childName: null,
    courseName: courseName
  };
}
```

### 3. 查詢優化

#### 3.1 支持子女篩選（未來擴展）

```javascript
// 預留接口，未來可支持按子女查詢
async queryCoursesByChild(userId, childName) {
  const allCourses = await this.queryEntities({ /* ... */ }, userId);
  
  // 篩選包含特定子女名稱的課程
  return allCourses.filter(course => 
    course.course_name.startsWith(childName)
  );
}
```

## 🔒 設計約束

### 1. 保持架構純淨
- ✅ 不修改數據層（DataService）
- ✅ 不修改數據結構（courses 集合）
- ✅ 不增加新的服務層
- ✅ 遵守 Single Source of Truth

### 2. 向後兼容性
- ✅ 現有課程數據可正常顯示
- ✅ 不含子女名稱的輸入正常處理
- ✅ API 接口簽名不變
- ✅ 所有現有功能保持

### 3. 性能考量
- 正則匹配性能影響：< 1ms
- 顯示格式化開銷：可忽略
- 無額外數據庫查詢
- 無網絡請求增加

## 📊 測試策略

### 1. 單元測試重點

```javascript
describe('子女名稱處理', () => {
  describe('extractChildName', () => {
    it('應識別「小X」格式', () => {
      const result = SemanticService.extractChildName('小明明天下午兩點鋼琴課');
      expect(result.name).toBe('小明');
    });
    
    it('應識別2-3字中文名', () => {
      const result = SemanticService.extractChildName('志強下週游泳課');
      expect(result.name).toBe('志強');
    });
    
    it('應排除時間詞彙', () => {
      const result = SemanticService.extractChildName('明天下午兩點鋼琴課');
      expect(result).toBeNull();
    });
  });
});
```

### 2. 集成測試案例

| 輸入 | 預期 course_name | 預期顯示 |
|------|------------------|----------|
| 小明明天下午兩點鋼琴課 | 小明鋼琴課 | 👦 小明<br>📚 鋼琴課 |
| 小美每週三早上十點法語課 | 小美法語課 | 👦 小美<br>📚 法語課 |
| 明天下午兩點鋼琴課 | 鋼琴課 | 📚 鋼琴課 |
| 幫志強安排游泳課 | 志強游泳課 | 👦 志強<br>📚 游泳課 |

## 🚀 未來擴展點

### 1. 最小擴展（如需要）
```javascript
// 在 courses 添加可選標籤
courses: {
  // ... 現有字段
  child_tag: "小明"  // 可選，用於精確查詢
}
```

### 2. 漸進式增強
- 支持更複雜的名稱模式
- 添加子女別名支持
- 實現模糊匹配容錯

### 3. 保持簡潔原則
- 避免過度抽象
- 拒絕不必要的複雜性
- 始終優先考慮用戶體驗

## ✅ 關鍵成功因素

1. **實現簡潔** - 總改動 < 200 行代碼
2. **風險可控** - 不觸及核心架構
3. **體驗自然** - 用戶無需學習
4. **擴展友好** - 未來可平滑升級