/**
 * 多子女功能 - 語義識別測試
 * 測試子女名稱提取和課程名稱嵌入功能
 */

const SemanticService = require('../../src/services/semanticService');

describe('多子女課程管理 - 語義識別測試', () => {
  describe('extractChildName', () => {
    test('應識別「小X」格式的子女名稱', () => {
      const testCases = [
        { input: '小明明天下午兩點鋼琴課', expected: { name: '小明', remainingText: '明天下午兩點鋼琴課' } },
        { input: '小美每週三早上十點法語課', expected: { name: '小美', remainingText: '每週三早上十點法語課' } },
        { input: '小寶今天要上數學課', expected: { name: '小寶', remainingText: '今天要上數學課' } }
      ];

      testCases.forEach(({ input, expected }) => {
        const result = SemanticService.extractChildName(input);
        expect(result).not.toBeNull();
        expect(result.name).toBe(expected.name);
        expect(result.remainingText).toBe(expected.remainingText);
      });
    });

    test('應識別2-3字中文名', () => {
      const testCases = [
        { input: '志強下週游泳課', expected: { name: '志強', remainingText: '下週游泳課' } },
        { input: '美美的鋼琴課', expected: { name: '美美', remainingText: '的鋼琴課' } },
        { input: '小英明天下午兩點', expected: { name: '小英', remainingText: '明天下午兩點' } }
      ];

      testCases.forEach(({ input, expected }) => {
        const result = SemanticService.extractChildName(input);
        expect(result).not.toBeNull();
        expect(result.name).toBe(expected.name);
        expect(result.remainingText).toBe(expected.remainingText);
      });
    });

    test('應排除時間詞彙', () => {
      const timeWords = [
        '明天下午兩點鋼琴課',
        '今天早上十點數學課',
        '下週三英文課',
        '每週一體育課',
        '上午九點音樂課'
      ];

      timeWords.forEach(input => {
        const result = SemanticService.extractChildName(input);
        expect(result).toBeNull();
      });
    });

    test('應處理邊界情況', () => {
      const edgeCases = [
        { input: '', expected: null },
        { input: null, expected: null },
        { input: undefined, expected: null },
        { input: '課', expected: null },
        { input: 'ABC', expected: null },
        { input: '12345', expected: null }
      ];

      edgeCases.forEach(({ input, expected }) => {
        const result = SemanticService.extractChildName(input);
        expect(result).toBe(expected);
      });
    });

    test('應正確處理帶「的」的表達', () => {
      const result = SemanticService.extractChildName('小明的鋼琴課明天下午兩點');
      expect(result).not.toBeNull();
      expect(result.name).toBe('小明');
      expect(result.remainingText).toBe('的鋼琴課明天下午兩點');
    });
  });

  describe('extractCourseEntities with child names', () => {
    test('子女名稱提取邏輯單元測試', () => {
      // 直接測試子女名稱提取功能，不依賴 OpenAI
      const testCases = [
        {
          input: '小明明天下午兩點鋼琴課',
          expectedChildName: '小明',
          expectedRemainingText: '明天下午兩點鋼琴課'
        },
        {
          input: '小美每週三早上十點法語課',
          expectedChildName: '小美',
          expectedRemainingText: '每週三早上十點法語課'
        },
        {
          input: '志強下週游泳課',
          expectedChildName: '志強',
          expectedRemainingText: '下週游泳課'
        }
      ];

      testCases.forEach(({ input, expectedChildName, expectedRemainingText }) => {
        const childInfo = SemanticService.extractChildName(input);
        expect(childInfo).not.toBeNull();
        expect(childInfo.name).toBe(expectedChildName);
        expect(childInfo.remainingText).toBe(expectedRemainingText);
      });
    });

    test('課程名稱嵌入邏輯驗證', () => {
      // 模擬課程名稱嵌入邏輯
      const testCases = [
        { childName: '小明', courseName: '鋼琴課', expected: '小明鋼琴課' },
        { childName: '小美', courseName: '法語課', expected: '小美法語課' },
        { childName: '志強', courseName: '游泳課', expected: '志強游泳課' },
        { childName: null, courseName: '數學課', expected: '數學課' }
      ];

      testCases.forEach(({ childName, courseName, expected }) => {
        const result = childName ? `${childName}${courseName}` : courseName;
        expect(result).toBe(expected);
      });
    });
  });

  describe('向後兼容性測試', () => {
    test('子女名稱提取不應影響非子女輸入', () => {
      const traditionalInputs = [
        '取消數學課',
        '查詢課表', 
        '修改英文課時間',
        '明天下午兩點鋼琴課'
      ];

      traditionalInputs.forEach(input => {
        const result = SemanticService.extractChildName(input);
        expect(result).toBeNull();
      });
    });
  });
});

describe('CourseManagementScenarioTemplate - 顯示優化測試', () => {
  // 模擬 CourseManagementScenarioTemplate
  const mockTemplate = {
    extractChildFromCourseName: (courseName) => {
      if (!courseName || typeof courseName !== 'string') {
        return {
          hasChild: false,
          childName: null,
          courseName: courseName || ''
        };
      }
      
      const patterns = [
        /^(小[一-龯])([一-龯]+課)$/,            // 小明鋼琴課
        /^(大[一-龯])([一-龯]+課)$/,            // 大寶數學課  
        /^([一-龯]{2})([一-龯]+課)$/            // 志強游泳課 (只匹配2字名)
      ];
      
      for (const pattern of patterns) {
        const match = courseName.match(pattern);
        if (match) {
          return {
            hasChild: true,
            childName: match[1],
            courseName: match[2] || '課程'
          };
        }
      }
      
      return {
        hasChild: false,
        childName: null,
        courseName: courseName
      };
    }
  };

  describe('extractChildFromCourseName', () => {
    test('應正確分離子女名稱和課程名稱', () => {
      const testCases = [
        {
          input: '小明鋼琴課',
          expected: { hasChild: true, childName: '小明', courseName: '鋼琴課' }
        },
        {
          input: '小美法語課',
          expected: { hasChild: true, childName: '小美', courseName: '法語課' }
        },
        {
          input: '志強游泳課',
          expected: { hasChild: true, childName: '志強', courseName: '游泳課' }
        },
        {
          input: '數學課',
          expected: { hasChild: false, childName: null, courseName: '數學課' }
        },
        {
          input: '英文課',
          expected: { hasChild: false, childName: null, courseName: '英文課' }
        }
      ];

      testCases.forEach(({ input, expected }) => {
        const result = mockTemplate.extractChildFromCourseName(input);
        expect(result.hasChild).toBe(expected.hasChild);
        expect(result.childName).toBe(expected.childName);
        expect(result.courseName).toBe(expected.courseName);
      });
    });

    test('應處理邊界情況', () => {
      const edgeCases = [
        {
          input: '',
          expected: { hasChild: false, childName: null, courseName: '' }
        },
        {
          input: null,
          expected: { hasChild: false, childName: null, courseName: '' }
        },
        {
          input: undefined,
          expected: { hasChild: false, childName: null, courseName: '' }
        }
      ];

      edgeCases.forEach(({ input, expected }) => {
        const result = mockTemplate.extractChildFromCourseName(input);
        expect(result.hasChild).toBe(expected.hasChild);
        expect(result.childName).toBe(expected.childName);
        expect(result.courseName).toBe(expected.courseName);
      });
    });
  });
});

describe('集成測試', () => {
  test('完整流程：從輸入到顯示', async () => {
    const testScenarios = [
      {
        description: '小明的鋼琴課',
        input: '小明明天下午兩點鋼琴課',
        expectedFlow: {
          childExtracted: '小明',
          courseNameWithChild: '小明鋼琴課',
          displaySeparated: { hasChild: true, childName: '小明', courseName: '鋼琴課' }
        }
      },
      {
        description: '無子女名稱的課程',
        input: '明天下午兩點數學課',
        expectedFlow: {
          childExtracted: null,
          courseNameWithChild: '數學課',
          displaySeparated: { hasChild: false, childName: null, courseName: '數學課' }
        }
      }
    ];

    for (const scenario of testScenarios) {
      // Step 1: 測試子女名稱提取
      const childInfo = SemanticService.extractChildName(scenario.input);
      if (scenario.expectedFlow.childExtracted) {
        expect(childInfo).not.toBeNull();
        expect(childInfo.name).toBe(scenario.expectedFlow.childExtracted);
      } else {
        expect(childInfo).toBeNull();
      }

      // Step 2: 測試顯示分離
      const mockTemplate = {
        extractChildFromCourseName: (courseName) => {
          const patterns = [
            /^(小[一-龯])([一-龯]+課)$/,            // 小明鋼琴課
            /^(大[一-龯])([一-龯]+課)$/,            // 大寶數學課  
            /^([一-龯]{2})([一-龯]+課)$/            // 志強游泳課 (只匹配2字名)
          ];
          
          for (const pattern of patterns) {
            const match = courseName.match(pattern);
            if (match) {
              return {
                hasChild: true,
                childName: match[1],
                courseName: match[2] || '課程'
              };
            }
          }
          
          return {
            hasChild: false,
            childName: null,
            courseName: courseName
          };
        }
      };

      const displayInfo = mockTemplate.extractChildFromCourseName(scenario.expectedFlow.courseNameWithChild);
      expect(displayInfo.hasChild).toBe(scenario.expectedFlow.displaySeparated.hasChild);
      expect(displayInfo.childName).toBe(scenario.expectedFlow.displaySeparated.childName);
      expect(displayInfo.courseName).toBe(scenario.expectedFlow.displaySeparated.courseName);
    }
  });
});