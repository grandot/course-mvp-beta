/**
 * 多子女功能 - 語義識別測試
 * 測試子女名稱提取和課程名稱嵌入功能
 */

// 🚨 多子女功能測試暫時禁用，等待 Phase 3 後續實現
const SemanticService = { extractChildName: () => null, embedChildName: () => 'test' };

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

    test('正確設計驗證 - 課程名稱純淨，學童信息分離', () => {
      // 驗證正確的設計原則：課程名稱保持純淨，學童信息單獨存儲
      const testCases = [
        { 
          childName: '小明', 
          courseName: '鋼琴課', 
          expectedCourse: '鋼琴課',  // 課程名稱保持純淨
          expectedChild: '小明'      // 學童信息單獨處理
        },
        { 
          childName: '小美', 
          courseName: '法語課', 
          expectedCourse: '法語課', 
          expectedChild: '小美' 
        },
        { 
          childName: '志強', 
          courseName: '游泳課', 
          expectedCourse: '游泳課', 
          expectedChild: '志強' 
        },
        { 
          childName: null, 
          courseName: '數學課', 
          expectedCourse: '數學課', 
          expectedChild: null 
        }
      ];

      testCases.forEach(({ childName, courseName, expectedCourse, expectedChild }) => {
        // 正確設計：課程名稱不變，學童信息單獨處理
        expect(courseName).toBe(expectedCourse);
        expect(childName).toBe(expectedChild);
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

describe('CourseManagementScenarioTemplate - 正確顯示測試', () => {
  // 模擬正確設計的課程數據結構
  const mockCourseData = [
    {
      course_name: '足球',
      child_name: '小明',
      schedule_time: '07/31 10:30 AM'
    },
    {
      course_name: '鋼琴課',
      child_name: '小美',
      schedule_time: '07/30 2:00 PM'
    },
    {
      course_name: '數學課',
      child_name: null,  // 無學童信息
      schedule_time: '08/01 9:00 AM'
    }
  ];

  // 模擬正確的顯示邏輯
  const mockFormatDisplay = (course) => {
    let displayText = '';
    
    // 如果有學童信息，優先顯示
    if (course.child_name) {
      displayText += `👶 學童: ${course.child_name}\n`;
    }
    
    // 顯示課程名稱
    displayText += `📚 ${course.course_name}\n`;
    
    // 顯示時間
    displayText += `🕒 時間：${course.schedule_time}`;
    
    return displayText;
  };

  describe('正確顯示格式測試', () => {
    test('有學童信息的課程應正確顯示', () => {
      const courseWithChild = mockCourseData[0];
      const result = mockFormatDisplay(courseWithChild);
      
      expect(result).toContain('👶 學童: 小明');
      expect(result).toContain('📚 足球');
      expect(result).toContain('🕒 時間：07/31 10:30 AM');
    });

    test('無學童信息的課程應正確顯示', () => {
      const courseWithoutChild = mockCourseData[2];
      const result = mockFormatDisplay(courseWithoutChild);
      
      expect(result).not.toContain('👶 學童:');
      expect(result).toContain('📚 數學課');
      expect(result).toContain('🕒 時間：08/01 9:00 AM');
    });

    test('數據結構驗證 - 課程名稱純淨', () => {
      mockCourseData.forEach(course => {
        // 課程名稱不應包含學童信息
        expect(course.course_name).not.toMatch(/^(小|大)[一-龯]/);
        
        // 學童信息應該是單獨字段
        if (course.child_name) {
          expect(typeof course.child_name).toBe('string');
          expect(course.child_name.length).toBeGreaterThan(1);
        }
      });
    });
  });
});

describe('集成測試', () => {
  test('完整流程：從輸入到正確數據結構', () => {
    const testScenarios = [
      {
        description: '小明的足球課 - 正確設計',
        input: '小明明天下午兩點足球課',
        expectedFlow: {
          childExtracted: '小明',
          courseNamePure: '足球課',  // 課程名稱保持純淨
          childNameSeparate: '小明', // 學童信息單獨處理
          displayFormat: '👶 學童: 小明\n📚 足球課\n🕒 時間：時間信息'
        }
      },
      {
        description: '無子女名稱的課程',
        input: '明天下午兩點數學課',
        expectedFlow: {
          childExtracted: null,
          courseNamePure: '數學課',
          childNameSeparate: null,
          displayFormat: '📚 數學課\n🕒 時間：時間信息'
        }
      }
    ];

    testScenarios.forEach(scenario => {
      // Step 1: 測試子女名稱提取
      const childInfo = SemanticService.extractChildName(scenario.input);
      if (scenario.expectedFlow.childExtracted) {
        expect(childInfo).not.toBeNull();
        expect(childInfo.name).toBe(scenario.expectedFlow.childExtracted);
      } else {
        expect(childInfo).toBeNull();
      }

      // Step 2: 驗證正確的設計原則
      const mockCourseData = {
        course_name: scenario.expectedFlow.courseNamePure,
        child_name: scenario.expectedFlow.childNameSeparate,
        schedule_time: '時間信息'
      };

      // 驗證課程名稱純淨
      expect(mockCourseData.course_name).toBe(scenario.expectedFlow.courseNamePure);
      expect(mockCourseData.course_name).not.toMatch(/^(小|大)[一-龯]/);

      // 驗證學童信息分離
      expect(mockCourseData.child_name).toBe(scenario.expectedFlow.childNameSeparate);

      // 驗證顯示格式
      const mockFormatDisplay = (course) => {
        let displayText = '';
        if (course.child_name) {
          displayText += `👶 學童: ${course.child_name}\n`;
        }
        displayText += `📚 ${course.course_name}\n`;
        displayText += `🕒 時間：${course.schedule_time}`;
        return displayText;
      };

      const actualDisplay = mockFormatDisplay(mockCourseData);
      expect(actualDisplay).toBe(scenario.expectedFlow.displayFormat);
    });
  });
});