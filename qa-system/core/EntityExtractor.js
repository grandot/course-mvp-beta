/**
 * 實體提取器 - 自動識別測試中的學生、課程等實體
 */

class EntityExtractor {
  constructor() {
    // 動作關鍵詞規則
    this.actionRules = {
      creates: ['新增', '創建', '建立', '安排', '設定', '每週', '每天', '每月'],
      queries: ['查詢', '查看', '顯示', '看一下', '有什麼課', '課表', '安排'],
      modifies: ['修改', '更改', '調整', '改到', '改成'],
      deletes: ['刪除', '取消', '移除', '停止', '不要'],
      confirms: ['確認', '好的', '是的', '對']
    };
    
    // 實體識別模式
    this.entityPatterns = {
      students: [
        /測試(\w+)(?=的|每|要|明天|今天|昨天)/g,
        /(\w+)(?=每週|每天|每月|的課程|今天|明天)/g
      ],
      courses: [
        /測試(\w+課)/g,
        /(\w+課)(?=的|要|安排|時間)/g,
        /(數學課|鋼琴課|英文課|游泳課|晨練課|瑜伽課|評鑑)/g
      ],
      timeExpressions: [
        /(每週[一二三四五六日])/g,
        /(每天|每日|天天)/g,
        /(每月|每個月)/g,
        /(明天|今天|昨天)/g,
        /(上午|下午|晚上)\s*(\d+[：:]\d+|\d+點)/g
      ]
    };
  }
  
  /**
   * 從測試案例中提取實體
   */
  extractEntities(testCase) {
    const entities = {
      students: [],
      courses: [],
      timeExpressions: [],
      actions: [],
      creates: [],
      requires: [],
      confidence: 0
    };
    
    // 1. 優先使用明確標註
    if (testCase.annotations) {
      if (testCase.annotations.creates) {
        entities.creates = testCase.annotations.creates;
      }
      if (testCase.annotations.requires) {
        entities.requires = testCase.annotations.requires;
      }
    }
    
    // 2. 如果沒有明確標註，進行自動推導
    if (entities.creates.length === 0 && entities.requires.length === 0) {
      const extracted = this.extractFromText(testCase.input || testCase.content);
      Object.assign(entities, extracted);
      
      // 3. 根據測試組別推導依賴關係
      this.inferDependencies(testCase, entities);
    }
    
    // 4. 計算信心度
    entities.confidence = this.calculateConfidence(entities, testCase);
    
    return entities;
  }
  
  /**
   * 從文本中提取實體
   */
  extractFromText(text) {
    const entities = {
      students: [],
      courses: [],
      timeExpressions: [],
      actions: []
    };
    
    if (!text) return entities;
    
    // 提取學生
    this.entityPatterns.students.forEach(pattern => {
      const matches = [...text.matchAll(pattern)];
      matches.forEach(match => {
        const student = match[1];
        if (student && !entities.students.includes(student)) {
          entities.students.push(student);
        }
      });
    });
    
    // 提取課程
    this.entityPatterns.courses.forEach(pattern => {
      const matches = [...text.matchAll(pattern)];
      matches.forEach(match => {
        const course = match[1];
        if (course && !entities.courses.includes(course)) {
          entities.courses.push(course);
        }
      });
    });
    
    // 提取時間表達式
    this.entityPatterns.timeExpressions.forEach(pattern => {
      const matches = [...text.matchAll(pattern)];
      matches.forEach(match => {
        const timeExpr = match[0];
        if (timeExpr && !entities.timeExpressions.includes(timeExpr)) {
          entities.timeExpressions.push(timeExpr);
        }
      });
    });
    
    // 識別動作
    for (const [action, keywords] of Object.entries(this.actionRules)) {
      if (keywords.some(keyword => text.includes(keyword))) {
        entities.actions.push(action);
      }
    }
    
    return entities;
  }
  
  /**
   * 根據測試組別推導依賴關係
   */
  inferDependencies(testCase, entities) {
    const group = testCase.group;
    const studentNames = entities.students;
    const courseNames = entities.courses;
    
    // 生成實體ID
    const studentIds = studentNames.map(name => `test_student_${name.toLowerCase()}`);
    const courseIds = courseNames.map(name => `test_course_${this.normalizeName(name)}`);
    
    if (group === 'A') {
      // Group A: 創建基礎實體
      entities.creates = [...studentIds, ...courseIds];
      entities.requires = [];
      
    } else if (group === 'B') {
      // Group B: 使用 Group A 創建的實體
      entities.creates = [];
      entities.requires = [...studentIds, ...courseIds];
      
      // 如果是查詢操作，可能還需要課程記錄
      if (entities.actions.includes('queries')) {
        entities.requires.push('basic_courses');
      }
      
    } else if (group === 'C') {
      // Group C: 使用前面階段的實體，可能創建修改記錄
      entities.requires = [...studentIds, ...courseIds];
      
      if (entities.actions.includes('modifies')) {
        entities.creates = ['modified_courses'];
      } else if (entities.actions.includes('deletes')) {
        entities.creates = ['cancelled_courses'];
      }
    }
  }
  
  /**
   * 標準化名稱
   */
  normalizeName(name) {
    // 移除"測試"前綴和"課"後綴
    return name
      .replace(/^測試/, '')
      .replace(/課$/, '')
      .toLowerCase()
      .replace(/[^\w]/g, '_');
  }
  
  /**
   * 計算提取信心度
   */
  calculateConfidence(entities, testCase) {
    let score = 0;
    const maxScore = 100;
    
    // 有明確標註 (+40)
    if (entities.creates.length > 0 || entities.requires.length > 0) {
      score += 40;
    }
    
    // 識別到學生 (+20)
    if (entities.students.length > 0) {
      score += 20;
    }
    
    // 識別到課程 (+20) 
    if (entities.courses.length > 0) {
      score += 20;
    }
    
    // 識別到動作 (+10)
    if (entities.actions.length > 0) {
      score += 10;
    }
    
    // 有測試輸入 (+10)
    if (testCase.input) {
      score += 10;
    }
    
    return Math.min(score, maxScore) / 100;
  }
  
  /**
   * 驗證實體提取結果
   */
  validateExtraction(entities) {
    const issues = [];
    
    // 檢查基本完整性
    if (entities.creates.length === 0 && entities.requires.length === 0) {
      issues.push('未識別到任何實體依賴關係');
    }
    
    // 檢查實體命名
    [...entities.creates, ...entities.requires].forEach(entity => {
      if (!entity.startsWith('test_') && !entity.includes('_')) {
        issues.push(`實體命名可能不規範: ${entity}`);
      }
    });
    
    // 檢查信心度
    if (entities.confidence < 0.5) {
      issues.push(`實體提取信心度過低: ${entities.confidence}`);
    }
    
    return {
      isValid: issues.length === 0,
      issues: issues,
      confidence: entities.confidence
    };
  }
  
  /**
   * 生成實體摘要
   */
  generateSummary(entities) {
    return {
      totalEntities: entities.creates.length + entities.requires.length,
      creates: entities.creates,
      requires: entities.requires,
      students: entities.students,
      courses: entities.courses,
      actions: entities.actions,
      confidence: entities.confidence
    };
  }
}

module.exports = { EntityExtractor };