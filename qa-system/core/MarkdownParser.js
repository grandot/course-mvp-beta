/**
 * Markdown 解析器 - 從 test-plan.md 提取測試場景
 */

const fs = require('fs').promises;
const path = require('path');

class MarkdownParser {
  constructor() {
    this.testCasePattern = /^##### ([ABC]\d\.\d-[A-Z])\s+(.+?)(?:\s+✅|⚠️)?\s*（測試目的：(.+?)）$/;
    this.inputPattern = /- \*\*測試輸入\*\*[：:]?\s*[「"]([^」"]+)[」"]/;
    this.expectedPattern = /- \*\*預期回覆\*\*[：:]?\s*[「"]([^」"]+)[」"]/;
    this.expectedFinalPattern = /- \*\*預期最終回覆\*\*[：:]?\s*[「"]([^」"]+)[」"]/;
    this.sequenceStartPattern = /^- \*\*測試序列\*\*/;
    this.sequenceStepPattern = /^(?:\d+)[\.\)]\s*(?:輸入|input)[：:]?\s*[「"]([^」"]+)[」"]/i;
    this.annotationPattern = /<!-- @(\w+):\s*(.+?) -->/g;
  }
  
  /**
   * 解析測試計劃 Markdown 文件
   */
  async parse(testPlanPath) {
    try {
      const content = await fs.readFile(testPlanPath, 'utf-8');
      const testCases = this.extractTestCases(content);
      
      console.log(`📋 解析完成，找到 ${testCases.length} 個測試案例`);
      return testCases;
      
    } catch (error) {
      console.error('❌ Markdown 解析失敗:', error.message);
      throw error;
    }
  }
  
  /**
   * 提取測試案例
   */
  extractTestCases(content) {
    const lines = content.split('\n');
    const testCases = [];
    let currentTestCase = null;
    let currentSection = '';
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      // 識別測試案例標題
      const testCaseMatch = line.match(this.testCasePattern);
      if (testCaseMatch) {
        // 保存上一個測試案例
        if (currentTestCase) {
          testCases.push(this.finalizeTestCase(currentTestCase));
        }
        
        // 開始新的測試案例
        currentTestCase = {
          id: testCaseMatch[1],
          name: testCaseMatch[2],
          purpose: testCaseMatch[3],
          group: testCaseMatch[1].charAt(0), // A, B, or C
          phase: this.determinePhase(testCaseMatch[1].charAt(0)),
          content: '',
          annotations: {},
          input: '',
          expectedOutput: '',
          expectedFinalOutput: '',
          expectedKeywords: [],
          expectedSuccess: null,
          steps: []
        };
        currentSection = 'content';
        continue;
      }
      
      // 收集當前測試案例的內容
      if (currentTestCase) {
        currentTestCase.content += line + '\n';
        
        // 提取測試輸入
        const inputMatch = line.match(this.inputPattern);
        if (inputMatch) {
          currentTestCase.input = inputMatch[1];
        }
        
        // 提取預期回覆
        const expectedMatch = line.match(this.expectedPattern);
        if (expectedMatch) {
          currentTestCase.expectedOutput = expectedMatch[1];
          currentTestCase.expectedKeywords = this.extractKeywords(expectedMatch[1]);
        }

        // 提取預期最終回覆（多輪）
        const expectedFinalMatch = line.match(this.expectedFinalPattern);
        if (expectedFinalMatch) {
          currentTestCase.expectedFinalOutput = expectedFinalMatch[1];
        }

        // 解析測試序列起始
        if (this.sequenceStartPattern.test(line)) {
          currentSection = 'sequence';
        }
        // 解析測試序列步驟
        if (currentSection === 'sequence') {
          const stepMatch = line.match(this.sequenceStepPattern);
          if (stepMatch) {
            currentTestCase.steps.push({ input: stepMatch[1] });
          }
        }
        
        // 提取標註
        let annotationMatch;
        while ((annotationMatch = this.annotationPattern.exec(line)) !== null) {
          const key = annotationMatch[1];
          const value = annotationMatch[2];
          
          if (key === 'creates' || key === 'requires') {
            currentTestCase.annotations[key] = value.split(',').map(s => s.trim());
          } else if (key === 'expectedSuccess') {
            const v = value.trim().toLowerCase();
            currentTestCase.expectedSuccess = (v === 'true' || v === '1' || v === 'yes');
          } else if (key === 'expectedCode') {
            currentTestCase.expectedCode = value.trim();
          } else {
            currentTestCase.annotations[key] = value;
          }
        }
      }
    }
    
    // 保存最後一個測試案例
    if (currentTestCase) {
      testCases.push(this.finalizeTestCase(currentTestCase));
    }
    
    return testCases;
  }
  
  /**
   * 完善測試案例資訊
   */
  finalizeTestCase(testCase) {
    // 如果沒有明確的預期關鍵詞，嘗試從測試目的推斷
    if (testCase.expectedKeywords.length === 0 && testCase.purpose) {
      testCase.expectedKeywords = this.inferKeywordsFromPurpose(testCase.purpose);
    }
    
    // 預估 expectedSuccess （若未由標註給定）
    if (testCase.expectedSuccess === null) {
      const exp = testCase.expectedFinalOutput || testCase.expectedOutput || '';
      const successHints = ['成功', '✅', '已安排', '設定完成', '已取消', '完成'];
      const failureHints = ['❓', '請提供', '錯誤', '無法', '失敗'];
      if (successHints.some(k => exp.includes(k))) testCase.expectedSuccess = true;
      else if (failureHints.some(k => exp.includes(k))) testCase.expectedSuccess = false;
      else testCase.expectedSuccess = null; // 未知，交由語義規則判定
    }

    // 若仍無關鍵詞，給預設（但不強制成功類用詞）
    if (testCase.expectedKeywords.length === 0) {
      testCase.expectedKeywords = this.getDefaultKeywords(testCase.group, testCase.expectedSuccess);
    }
    
    return testCase;
  }
  
  /**
   * 從預期回覆中提取關鍵詞
   */
  extractKeywords(expectedOutput) {
    const keywords = [];
    
    // 常見的成功/失敗指標
    const successPatterns = ['成功', '✅', '已安排', '完成', '確認', '設定完成', '已取消'];
    const failurePatterns = ['❓', '請提供', '錯誤', '無法', '失敗', '時間衝突'];
    const coursePatterns = ['課程', '數學課', '鋼琴課', '英文課'];
    const studentPatterns = ['小明', 'Lumi', '小光', '小美'];
    
    successPatterns.forEach(pattern => {
      if (expectedOutput.includes(pattern)) {
        keywords.push(pattern);
      }
    });
    failurePatterns.forEach(pattern => {
      if (expectedOutput.includes(pattern)) {
        keywords.push(pattern);
      }
    });
    
    coursePatterns.forEach(pattern => {
      if (expectedOutput.includes(pattern)) {
        keywords.push('課程');
      }
    });
    
    studentPatterns.forEach(pattern => {
      if (expectedOutput.includes(pattern)) {
        keywords.push(pattern);
      }
    });
    
    return [...new Set(keywords)]; // 去重
  }
  
  /**
   * 從測試目的推斷關鍵詞
   */
  inferKeywordsFromPurpose(purpose) {
    const keywords = [];
    
    if (purpose.includes('驗證標準格式') || purpose.includes('創建') || purpose.includes('新增')) {
      keywords.push('課程', '成功');
    }
    
    if (purpose.includes('查詢') || purpose.includes('顯示')) {
      keywords.push('課程');
    }
    
    if (purpose.includes('錯誤') || purpose.includes('校驗')) {
      keywords.push('錯誤', '重新');
    }
    
    if (purpose.includes('重複') || purpose.includes('循環')) {
      keywords.push('課程', '重複');
    }
    
    return keywords;
  }
  
  /**
   * 獲取預設關鍵詞
   */
  getDefaultKeywords(group, expectedSuccess = null) {
    // 若明確預期失敗/提示，使用非成功類的關鍵詞
    if (expectedSuccess === false) {
      return ['❓', '請提供'];
    }
    const defaultKeywords = {
      'A': ['課程'], // 避免默認強制 "成功"
      'B': ['課程'],
      'C': ['課程']
    };
    return defaultKeywords[group] || ['課程'];
  }
  
  /**
   * 確定測試階段
   */
  determinePhase(group) {
    const phases = {
      'A': 'group_a',
      'B': 'group_b', 
      'C': 'group_c'
    };
    
    return phases[group] || 'unknown';
  }
  
  /**
   * 獲取測試統計
   */
  getStatistics(testCases) {
    const stats = {
      total: testCases.length,
      byGroup: { A: 0, B: 0, C: 0 },
      withAnnotations: 0,
      withExpectedKeywords: 0
    };
    
    testCases.forEach(testCase => {
      stats.byGroup[testCase.group]++;
      
      if (Object.keys(testCase.annotations).length > 0) {
        stats.withAnnotations++;
      }
      
      if (testCase.expectedKeywords.length > 0) {
        stats.withExpectedKeywords++;
      }
    });
    
    return stats;
  }
}

module.exports = { MarkdownParser };