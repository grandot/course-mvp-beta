/**
 * Final Integration Test
 * 驗證完整的原子化重構是否成功
 */

const semanticService = require('../src/services/semanticService');
const TaskService = require('../src/services/taskService');
const LineController = require('../src/controllers/lineController');

// Mock dependencies
jest.mock('../src/services/dataService');
jest.mock('../src/services/lineService');

const dataService = require('../src/services/dataService');
const lineService = require('../src/services/lineService');

describe('Final Integration Test - 原子化重構驗證', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // 設定測試環境變數
    process.env.OPENAI_API_KEY = 'test-key';
  });

  describe('「明天晚上十點半法語課」完整流程測試', () => {
    test('should successfully process end-to-end without mocking semantic analysis', async () => {
      // Mock dataService.createCourse
      dataService.createCourse.mockResolvedValue({
        success: true,
        id: 'course-french-123',
        message: '法語課程已成功建立'
      });

      // Mock lineService
      lineService.replyMessage.mockResolvedValue({
        success: true,
        messageId: 'line-msg-456'
      });

      const event = {
        message: { text: '明天晚上十點半法語課' },
        source: { userId: 'integration-test-user' },
        replyToken: 'integration-reply-token'
      };

      const result = await LineController.handleTextMessage(event);

      // 驗證端到端流程成功
      expect(result.success).toBe(true);
      expect(result.intent).toBe('record_course');
      expect(result.confidence).toBeGreaterThan(0);

      // 驗證 TaskService 被正確調用
      expect(result.result.success).toBe(true);

      // 驗證數據服務被調用，並且時間格式正確
      expect(dataService.createCourse).toHaveBeenCalledWith(
        expect.objectContaining({
          student_id: 'integration-test-user',
          course_name: '法語',
          schedule_time: expect.stringMatching(/^\d{2}\/\d{2} \d{1,2}:\d{2} (AM|PM)$/),
          course_date: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
        })
      );

      // 驗證 LINE 回覆服務被調用
      expect(lineService.replyMessage).toHaveBeenCalledWith(
        'integration-reply-token',
        '✅ 課程已成功新增！'
      );
    });

    test('should validate the architecture contracts', async () => {
      const text = '明天晚上十點半法語課';
      const userId = 'architecture-test-user';

      // Step 1: 測試 SemanticService 契約
      const semanticResult = await semanticService.analyzeMessage(text, userId);
      
      expect(semanticResult.success).toBe(true);
      expect(semanticResult.entities).toHaveProperty('course_name', '法語');
      expect(semanticResult.entities).toHaveProperty('timeInfo');
      
      if (semanticResult.entities.timeInfo) {
        expect(semanticResult.entities.timeInfo).toHaveProperty('display');
        expect(semanticResult.entities.timeInfo).toHaveProperty('date');
        expect(semanticResult.entities.timeInfo).toHaveProperty('raw');
        expect(semanticResult.entities.timeInfo).toHaveProperty('timestamp');
      }

      // Step 2: 測試 TaskService 契約
      dataService.createCourse.mockResolvedValue({
        success: true,
        id: 'test-course-789'
      });

      const taskResult = await TaskService.executeIntent(
        semanticResult.intent,
        semanticResult.entities,
        userId
      );

      expect(taskResult.success).toBe(true);
      expect(dataService.createCourse).toHaveBeenCalledTimes(1);

      const createCourseCall = dataService.createCourse.mock.calls[0][0];
      expect(createCourseCall).toHaveProperty('student_id', userId);
      expect(createCourseCall).toHaveProperty('course_name', '法語');
      expect(createCourseCall).toHaveProperty('schedule_time');
      expect(createCourseCall).toHaveProperty('course_date');
    });

    test('should demonstrate performance improvements', async () => {
      // 驗證時間提取只被調用一次
      const extractTimeInfoSpy = jest.spyOn(semanticService, 'extractTimeInfo');
      const processTimeInfoSpy = jest.spyOn(semanticService, 'processTimeInfo');

      await semanticService.analyzeMessage('明天晚上十點半法語課', 'perf-test-user');

      // processTimeInfo 應該被調用一次
      expect(processTimeInfoSpy).toHaveBeenCalledTimes(1);
      
      // extractTimeInfo 應該只被內部調用一次
      expect(extractTimeInfoSpy).toHaveBeenCalledTimes(1);

      extractTimeInfoSpy.mockRestore();
      processTimeInfoSpy.mockRestore();
    });
  });

  describe('錯誤處理與邊界情況', () => {
    test('should handle missing course name gracefully', async () => {
      const result = await semanticService.analyzeMessage('明天晚上十點半', 'edge-test-user');

      expect(result.success).toBe(true);
      expect(result.entities.course_name).toBeNull();
      expect(result.entities.timeInfo).toBeDefined();
    });

    test('should handle missing time information gracefully', async () => {
      const result = await semanticService.analyzeMessage('法語課', 'edge-test-user');

      expect(result.success).toBe(true);
      expect(result.entities.course_name).toBe('法語');
      expect(result.entities.timeInfo).toBeNull();
    });

    test('should validate data through TaskService', async () => {
      const invalidEntities = {
        course_name: null,
        location: null,
        teacher: null,
        timeInfo: null
      };

      const result = await TaskService.executeIntent(
        'record_course',
        invalidEntities,
        'validation-test-user'
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe('Missing course name');
      expect(dataService.createCourse).not.toHaveBeenCalled();
    });
  });

  describe('架構合規性驗證', () => {
    test('should demonstrate proper separation of concerns', () => {
      // 驗證 TimeService 契約標準化
      const TimeService = require('../src/services/timeService');
      expect(typeof TimeService.createTimeInfo).toBe('function');
      expect(typeof TimeService.formatForDisplay).toBe('function');
      expect(typeof TimeService.formatForStorage).toBe('function');
      expect(typeof TimeService.validateTimeInfo).toBe('function');

      // 驗證 TaskService 存在
      expect(typeof TaskService.executeIntent).toBe('function');
      expect(typeof TaskService.handleRecordCourse).toBe('function');
      expect(typeof TaskService.validateExecutionParams).toBe('function');

      // 驗證 SemanticService 優化
      expect(typeof semanticService.processTimeInfo).toBe('function');
    });

    test('should validate unified data flow', async () => {
      // 模擬完整的數據流：用戶輸入 → SemanticService → TaskService → DataService
      const userInput = '明天晚上十點半法語課';
      const userId = 'data-flow-test';

      // Step 1: 語義分析
      const semanticResult = await semanticService.analyzeMessage(userInput, userId);
      expect(semanticResult.success).toBe(true);

      // Step 2: 任務執行
      dataService.createCourse.mockResolvedValue({
        success: true,
        id: 'flow-test-course'
      });

      const taskResult = await TaskService.executeIntent(
        semanticResult.intent,
        semanticResult.entities,
        userId
      );

      expect(taskResult.success).toBe(true);

      // 驗證數據格式一致性
      const courseData = dataService.createCourse.mock.calls[0][0];
      expect(courseData.schedule_time).toMatch(/^\d{2}\/\d{2} \d{1,2}:\d{2} (AM|PM)$/);
      expect(courseData.course_date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });
  });

  describe('成功標準驗證', () => {
    test('should meet all technical indicators', async () => {
      const startTime = Date.now();
      
      // 執行核心功能
      const event = {
        message: { text: '明天晚上十點半法語課' },
        source: { userId: 'success-test-user' },
        replyToken: 'success-reply-token'
      };

      dataService.createCourse.mockResolvedValue({
        success: true,
        id: 'success-course-123'
      });

      lineService.replyMessage.mockResolvedValue({
        success: true
      });

      const result = await LineController.handleTextMessage(event);
      
      const endTime = Date.now();
      const responseTime = endTime - startTime;

      // 技術指標驗證
      expect(result.success).toBe(true);
      expect(result.intent).toBe('record_course');
      expect(responseTime).toBeLessThan(500); // 響應時間不超過 500ms

      // 功能驗證
      expect(result.result.success).toBe(true);
      expect(lineService.replyMessage).toHaveBeenCalledWith(
        'success-reply-token',
        '✅ 課程已成功新增！'
      );

      console.log(`✅ Response time: ${responseTime}ms (< 500ms requirement)`);
      console.log(`✅ Functionality: "明天晚上十點半法語課" executed successfully`);
      console.log(`✅ Architecture: All contracts validated`);
    });
  });
});