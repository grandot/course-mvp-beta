/**
 * SmartQueryEngine - 智能查詢引擎
 * 三層語意記憶系統 - Layer 3 實現
 * 
 * 職責：
 * - 資料實時查詢
 * - 採用明確語句進行資料回應
 * - 檢測明確查詢意圖，直接回應不經語意處理
 * - 與 DataService 整合，提供高效查詢服務
 */

class SmartQueryEngine {
  constructor(dataService = null) {
    this.dataService = dataService;
    
    // 查詢模式 regex patterns - 更精確的匹配
    this.queryPatterns = {
      schedule: [
        /^(查看|查詢|看看|顯示).*(課程|時間表|行程)/,
        /^(今天|明天|這週|本週).*(有什麼課|課程|時間表)/,
        /^.*課程.*時間表$/,
        /^什麼時候.*課$/,
        /^.*時間表$/
      ],
      course_list: [
        /^有哪些課程/,
        /^課程列表/,
        /^所有.*課程/,
        /^.*都有什麼課$/,
        /^列出.*課程/
      ],
      teacher_courses: [
        /^.*老師.*(課程|教什麼)/,
        /^.*老師.*教.*課/,
        /^哪個老師.*課/
      ],
      student_courses: [
        /^.*學生.*課程$/,
        /^.*(小\w+|學生).*(上什麼課|課程安排)/,
        /^.*上什麼課$/,
        /^.*課程安排$/
      ],
      recent_activities: [
        /^最近.*(活動|記錄)/,
        /^歷史記錄$/,
        /^查看.*記錄/
      ]
    };
    
    console.log('🔍 SmartQueryEngine 初始化完成');
    console.log(`   查詢類型數量: ${Object.keys(this.queryPatterns).length}`);
    console.log(`   總查詢模式數: ${Object.values(this.queryPatterns).reduce((sum, patterns) => sum + patterns.length, 0)}`);
  }

  /**
   * 🔍 處理明確查詢 - 核心方法
   * @param {string} text 用戶輸入文本
   * @param {string} userId 用戶ID
   * @returns {Promise<Object|null>} 查詢結果或null
   */
  async handleExplicitQuery(text, userId) {
    try {
      // 1. 檢測是否為明確查詢
      if (!this.isExplicitQuery(text)) {
        return null;
      }

      console.log(`🎯 檢測到明確查詢: "${text}"`);

      // 2. 確定查詢類型
      const queryType = this.detectQueryType(text);
      if (!queryType) {
        console.log(`⚠️ 無法確定查詢類型: ${text}`);
        return null;
      }

      console.log(`📋 查詢類型: ${queryType}`);

      // 3. 執行查詢
      const result = await this.executeQuery(queryType, userId, text);
      
      if (result) {
        console.log(`✅ 查詢執行成功: ${queryType}, 結果數量: ${this.getResultCount(result)}`);
        return {
          type: 'smart_query_response',
          queryType,
          data: result,
          bypassSemanticProcessing: true,
          responseTime: Date.now()
        };
      }
      
      return null;
    } catch (error) {
      console.error(`❌ SmartQuery 處理失敗:`, error.message);
      return null;
    }
  }

  /**
   * 檢測是否為明確查詢
   * @param {string} text 用戶輸入
   * @returns {boolean} 是否為明確查詢
   */
  isExplicitQuery(text) {
    // 檢查所有查詢模式
    const allPatterns = Object.values(this.queryPatterns).flat();
    
    return allPatterns.some(pattern => {
      const match = pattern.test(text);
      if (match) {
        console.log(`🔍 匹配查詢模式: ${pattern}`);
      }
      return match;
    });
  }

  /**
   * 檢測查詢類型
   * @param {string} text 用戶輸入
   * @returns {string|null} 查詢類型
   */
  detectQueryType(text) {
    // 按優先級檢查查詢類型
    for (const [queryType, patterns] of Object.entries(this.queryPatterns)) {
      for (const pattern of patterns) {
        if (pattern.test(text)) {
          return queryType;
        }
      }
    }
    return null;
  }

  /**
   * 執行查詢
   * @param {string} queryType 查詢類型
   * @param {string} userId 用戶ID
   * @param {string} originalText 原始查詢文本
   * @returns {Promise<Object|null>} 查詢結果
   */
  async executeQuery(queryType, userId, originalText = '') {
    if (!this.dataService) {
      console.warn('⚠️ DataService 未初始化，返回模擬數據');
      return this.getMockQueryResult(queryType, userId);
    }

    try {
      switch (queryType) {
        case 'schedule':
          return await this.querySchedule(userId, originalText);
          
        case 'course_list':
          return await this.queryCourseList(userId);
          
        case 'teacher_courses':
          return await this.queryTeacherCourses(userId, originalText);
          
        case 'student_courses':
          return await this.queryStudentCourses(userId, originalText);
          
        case 'recent_activities':
          return await this.queryRecentActivities(userId);
          
        default:
          console.warn(`⚠️ 不支援的查詢類型: ${queryType}`);
          return null;
      }
    } catch (error) {
      console.error(`❌ 查詢執行失敗 [${queryType}]:`, error.message);
      return null;
    }
  }

  /**
   * 查詢課程時間表
   * @param {string} userId 用戶ID
   * @param {string} text 查詢文本
   * @returns {Promise<Object>} 課程時間表
   */
  async querySchedule(userId, text) {
    // 解析時間範圍
    const timeRange = this.parseTimeRange(text);
    
    if (this.dataService && this.dataService.getUserSchedule) {
      return await this.dataService.getUserSchedule(userId, timeRange);
    }
    
    // 模擬數據
    return {
      timeRange,
      schedule: [
        {
          date: '2025-07-31',
          courses: [
            { time: '14:00', courseName: '數學課', student: '小明', teacher: '張老師' }
          ]
        }
      ]
    };
  }

  /**
   * 查詢課程列表
   * @param {string} userId 用戶ID
   * @returns {Promise<Object>} 課程列表
   */
  async queryCourseList(userId) {
    if (this.dataService && this.dataService.getUserCourses) {
      return await this.dataService.getUserCourses(userId);
    }
    
    // 模擬數據
    return {
      totalCourses: 3,
      courses: [
        { courseName: '數學課', frequency: 'weekly', teacher: '張老師' },
        { courseName: '英文課', frequency: 'weekly', teacher: '李老師' },
        { courseName: '鋼琴課', frequency: 'weekly', teacher: '王老師' }
      ]
    };
  }

  /**
   * 按老師查詢課程
   * @param {string} userId 用戶ID
   * @param {string} text 查詢文本
   * @returns {Promise<Object>} 老師課程列表
   */
  async queryTeacherCourses(userId, text) {
    // 提取老師姓名
    const teacherName = this.extractTeacherName(text);
    
    if (this.dataService && this.dataService.getCoursesByTeacher) {
      return await this.dataService.getCoursesByTeacher(userId, teacherName);
    }
    
    // 模擬數據
    return {
      teacher: teacherName || '張老師',
      courses: [
        { courseName: '數學課', student: '小明', time: '週三 14:00' }
      ]
    };
  }

  /**
   * 查詢學生課程
   * @param {string} userId 用戶ID
   * @param {string} text 查詢文本
   * @returns {Promise<Object>} 學生課程列表
   */
  async queryStudentCourses(userId, text) {
    // 提取學生姓名
    const studentName = this.extractStudentName(text);
    
    if (this.dataService && this.dataService.getCoursesByStudent) {
      return await this.dataService.getCoursesByStudent(userId, studentName);
    }
    
    // 模擬數據
    return {
      student: studentName || '小明',
      courses: [
        { courseName: '數學課', time: '週三 14:00', teacher: '張老師' },
        { courseName: '英文課', time: '週五 16:00', teacher: '李老師' }
      ]
    };
  }

  /**
   * 查詢最近活動
   * @param {string} userId 用戶ID
   * @returns {Promise<Object>} 最近活動列表
   */
  async queryRecentActivities(userId) {
    if (this.dataService && this.dataService.getRecentActivities) {
      return await this.dataService.getRecentActivities(userId);
    }
    
    // 模擬數據
    return {
      activities: [
        {
          date: '2025-07-31',
          action: '新增課程',
          course: '數學課',
          student: '小明'
        },
        {
          date: '2025-07-30',
          action: '修改時間',
          course: '英文課',
          student: '小明'
        }
      ]
    };
  }

  /**
   * 解析時間範圍
   * @param {string} text 查詢文本
   * @returns {Object} 時間範圍對象
   */
  parseTimeRange(text) {
    const today = new Date();
    const timeRange = {
      start: today.toISOString().split('T')[0],
      end: today.toISOString().split('T')[0],
      description: '今天'
    };

    if (text.includes('今天')) {
      // 已設定為今天
    } else if (text.includes('明天')) {
      const tomorrow = new Date(today);
      tomorrow.setDate(today.getDate() + 1);
      timeRange.start = tomorrow.toISOString().split('T')[0];
      timeRange.end = timeRange.start;
      timeRange.description = '明天';
    } else if (text.includes('這週') || text.includes('本週')) {
      const startOfWeek = new Date(today);
      const dayOfWeek = today.getDay();
      startOfWeek.setDate(today.getDate() - dayOfWeek);
      
      const endOfWeek = new Date(startOfWeek);
      endOfWeek.setDate(startOfWeek.getDate() + 6);
      
      timeRange.start = startOfWeek.toISOString().split('T')[0];
      timeRange.end = endOfWeek.toISOString().split('T')[0];
      timeRange.description = '本週';
    }

    return timeRange;
  }

  /**
   * 提取老師姓名
   * @param {string} text 查詢文本
   * @returns {string|null} 老師姓名
   */
  extractTeacherName(text) {
    // 簡單的姓名提取規則 - 常見姓氏 + 老師
    const teacherPattern = /([王李張陳劉楊黃趙吳周徐孫朱馬胡郭林何高梁鄭羅宋謝唐韓曹許鄧蕭馮曾程蔡彭潘袁於董余蘇葉呂魏蔣田杜丁沈姜范江傅鍾盧汪戴崔任陸廖姚方金邱夏譚韋賈鄒石熊孟秦閻薛侯雷白龍段郝孔邵史毛常萬顧賴武康賀嚴尹錢施牛洪龔]\w*)(老師|教師)/;
    const match = text.match(teacherPattern);
    return match ? match[1] + '老師' : null;
  }

  /**
   * 提取學生姓名
   * @param {string} text 查詢文本
   * @returns {string|null} 學生姓名
   */
  extractStudentName(text) {
    // 簡單的學生姓名提取規則
    const patterns = [
      // 小+名字格式 
      /(小[明華偉強芳慧敏怡雯軒宇晨芮宸豪])/,
      // 常見姓氏+名字格式  
      /([王李張陳劉楊黃趙吳周徐孫朱馬胡郭林何高梁鄭羅宋謝唐韓曹許鄧蕭馮曾程蔡彭潘袁於董余蘇葉呂魏蔣田杜丁沈姜范江傅鍾盧汪戴崔任陸廖姚方金邱夏譚韋賈鄒石熊孟秦閻薛侯雷白龍段郝孔邵史毛常萬顧賴武康賀嚴尹錢施牛洪龔][明華偉強芳慧敏怡雯軒宇晨芮宸豪]{1,2})/
    ];
    
    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) {
        return match[1];
      }
    }
    
    return null;
  }

  /**
   * 獲取模擬查詢結果
   * @param {string} queryType 查詢類型
   * @param {string} userId 用戶ID
   * @returns {Object} 模擬結果
   */
  getMockQueryResult(queryType, userId) {
    const mockData = {
      schedule: {
        today: [
          { time: '14:00', course: '數學課', student: '小明' }
        ]
      },
      course_list: {
        courses: ['數學課', '英文課', '鋼琴課']
      },
      teacher_courses: {
        teacher: '張老師',
        courses: ['數學課']
      },
      student_courses: {
        student: '小明',
        courses: ['數學課', '英文課']
      },
      recent_activities: {
        activities: [
          { action: '新增課程', course: '數學課' }
        ]
      }
    };

    return mockData[queryType] || { message: '查詢結果為空' };
  }

  /**
   * 獲取結果數量 (用於日誌)
   * @param {Object} result 查詢結果
   * @returns {number} 結果數量
   */
  getResultCount(result) {
    if (!result) return 0;
    
    if (result.courses) return result.courses.length;
    if (result.schedule) return result.schedule.length;
    if (result.activities) return result.activities.length;
    
    return 1;
  }

  /**
   * 設置 DataService (依賴注入)
   * @param {Object} dataService DataService 實例
   */
  setDataService(dataService) {
    this.dataService = dataService;
    console.log('🔌 DataService 已設置到 SmartQueryEngine');
  }

  /**
   * 獲取查詢統計信息
   * @returns {Object} 統計信息
   */
  getQueryStats() {
    return {
      supportedQueryTypes: Object.keys(this.queryPatterns).length,
      totalPatterns: Object.values(this.queryPatterns).reduce((sum, patterns) => sum + patterns.length, 0),
      hasDataService: !!this.dataService
    };
  }

  /**
   * 添加自定義查詢模式
   * @param {string} queryType 查詢類型
   * @param {RegExp[]} patterns 模式陣列
   */
  addQueryPatterns(queryType, patterns) {
    if (!this.queryPatterns[queryType]) {
      this.queryPatterns[queryType] = [];
    }
    
    this.queryPatterns[queryType].push(...patterns);
    console.log(`➕ 新增查詢模式: ${queryType}, 模式數: ${patterns.length}`);
  }

  /**
   * 移除查詢類型
   * @param {string} queryType 查詢類型
   */
  removeQueryType(queryType) {
    if (this.queryPatterns[queryType]) {
      delete this.queryPatterns[queryType];
      console.log(`➖ 移除查詢類型: ${queryType}`);
    }
  }
}

module.exports = SmartQueryEngine;