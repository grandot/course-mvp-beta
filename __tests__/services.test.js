/**
 * Service 層基礎測試
 * 驗證三個核心服務可正常載入且不拋出異常
 */

describe('Service Layer Architecture Tests', () => {
  describe('Service Module Loading', () => {
    test('SemanticService 可正常載入', () => {
      expect(() => {
        const SemanticService = require('../src/services/semanticService');
        expect(SemanticService).toBeDefined();
        expect(typeof SemanticService).toBe('function');
      }).not.toThrow();
    });

    test('TimeService 可正常載入', () => {
      expect(() => {
        const TimeService = require('../src/services/timeService');
        expect(TimeService).toBeDefined();
        expect(typeof TimeService).toBe('function');
      }).not.toThrow();
    });

    test('DataService 可正常載入', () => {
      expect(() => {
        const DataService = require('../src/services/dataService');
        expect(DataService).toBeDefined();
        expect(typeof DataService).toBe('function');
      }).not.toThrow();
    });
  });

  describe('Service Method Structure', () => {
    test('SemanticService 含有預期的靜態方法', () => {
      const SemanticService = require('../src/services/semanticService');
      
      expect(typeof SemanticService.analyzeMessage).toBe('function');
      expect(typeof SemanticService.extractCourseEntities).toBe('function');
      expect(typeof SemanticService.extractTimeInfo).toBe('function');
      expect(typeof SemanticService.identifyIntent).toBe('function');
      expect(typeof SemanticService.validateAnalysis).toBe('function');
    });

    test('TimeService 含有預期的靜態方法', () => {
      const TimeService = require('../src/services/timeService');
      
      expect(typeof TimeService.getCurrentUserTime).toBe('function');
      expect(typeof TimeService.parseTimeString).toBe('function');
      expect(typeof TimeService.formatForDisplay).toBe('function');
      expect(typeof TimeService.validateTime).toBe('function');
      expect(typeof TimeService.calculateTimeRange).toBe('function');
      expect(typeof TimeService.checkTimeConflict).toBe('function');
    });

    test('DataService 含有預期的靜態方法', () => {
      const DataService = require('../src/services/dataService');
      
      expect(typeof DataService.createCourse).toBe('function');
      expect(typeof DataService.getUserCourses).toBe('function');
      expect(typeof DataService.updateCourse).toBe('function');
      expect(typeof DataService.deleteCourse).toBe('function');
      expect(typeof DataService.queryCourses).toBe('function');
      expect(typeof DataService.recordTokenUsage).toBe('function');
      expect(typeof DataService.validateData).toBe('function');
    });
  });

  describe('NotImplementedError Validation', () => {
    test('所有服務方法應拋出 NotImplementedError', async () => {
      const SemanticService = require('../src/services/semanticService');
      const TimeService = require('../src/services/timeService');
      const DataService = require('../src/services/dataService');

      // SemanticService 方法測試（Phase 4: 已實現完整功能，不再拋出 NotImplementedError）
      // 驗證 SemanticService 方法已正常實現
      const analysisResult = await SemanticService.analyzeMessage('test', 'user1');
      expect(analysisResult.success).toBeDefined();
      
      const entities = await SemanticService.extractCourseEntities('test', 'user1');
      expect(entities).toBeDefined();
      
      const timeInfo = await SemanticService.extractTimeInfo('test');
      expect(timeInfo).toBeDefined();
      
      const intent = await SemanticService.identifyIntent('test');
      expect(typeof intent).toBe('string');
      
      const validationResult = await SemanticService.validateAnalysis({ 
        success: true, 
        intent: 'unknown', 
        confidence: 0.5 
      });
      expect(typeof validationResult).toBe('boolean');

      // TimeService 方法測試（Step 1 完成：契約標準化方法已實現）
      // Step 1 已實現的方法不應拋出 NotImplementedError
      const currentTime = TimeService.getCurrentUserTime();
      expect(currentTime).toBeInstanceOf(Date);
      const parsedTime = await TimeService.parseTimeString('今天 2:30');
      expect(parsedTime).toBeInstanceOf(Date);
      
      // Step 1 契約標準化：這些方法已實現
      const displayTime = TimeService.formatForDisplay(new Date());
      expect(typeof displayTime).toBe('string');
      const storageTime = TimeService.formatForStorage(new Date());
      expect(typeof storageTime).toBe('string');
      const timeInfo = TimeService.createTimeInfo(new Date());
      expect(timeInfo).toHaveProperty('display');
      expect(timeInfo).toHaveProperty('date');
      const validationResult = TimeService.validateTimeInfo(timeInfo);
      expect(typeof validationResult).toBe('boolean');
      
      // 未實現的方法仍應拋出 NotImplementedError
      await expect(TimeService.calculateTimeRange(new Date(), new Date())).rejects.toThrow('NotImplementedError');
      await expect(TimeService.checkTimeConflict(new Date(), [])).rejects.toThrow('NotImplementedError');

      // DataService 方法測試（Phase 3: 已實現記憶體版本，不再拋出 NotImplementedError）
      // 驗證 DataService 方法已正常實現
      const courseResult = await DataService.createCourse({
        student_id: 'test',
        course_name: 'test',
        course_date: '2025-07-25'
      });
      expect(courseResult.success).toBe(true);
      
      const courses = await DataService.getUserCourses('test');
      expect(Array.isArray(courses)).toBe(true);
      
      const dataValidationResult = await DataService.validateData({
        student_id: 'test',
        course_name: 'test',
        course_date: '2025-07-25'
      }, 'course');
      expect(dataValidationResult).toBe(true);
    });
  });
});