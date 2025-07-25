/**
 * TimeService Atomic Tests
 * 測試 Step 1 新增的契約標準化方法
 */
const TimeService = require('../src/services/timeService');

describe('TimeService Atomic Tests - Step 1 Contract Standardization', () => {
  describe('createTimeInfo contract', () => {
    test('should create correct timeInfo structure from ISO string', () => {
      const isoTime = '2025-07-26T14:30:00.000Z';
      const result = TimeService.createTimeInfo(isoTime);
      
      expect(result).toHaveProperty('display');
      expect(result).toHaveProperty('date');
      expect(result).toHaveProperty('raw');
      expect(result).toHaveProperty('timestamp');
      
      // 驗證格式
      expect(result.display).toMatch(/^\d{2}\/\d{2} \d{1,2}:\d{2} (AM|PM)$/);
      expect(result.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(result.raw).toBe(isoTime);
      expect(typeof result.timestamp).toBe('number');
    });

    test('should create correct timeInfo structure from Date object', () => {
      const date = new Date('2025-07-26T14:30:00.000Z');
      const result = TimeService.createTimeInfo(date);
      
      expect(result).toHaveProperty('display');
      expect(result).toHaveProperty('date');
      expect(result).toHaveProperty('raw');
      expect(result).toHaveProperty('timestamp');
      
      expect(result.display).toMatch(/^\d{2}\/\d{2} \d{1,2}:\d{2} (AM|PM)$/);
      expect(result.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(result.timestamp).toBe(date.getTime());
    });

    test('should return null for invalid input', () => {
      expect(TimeService.createTimeInfo(null)).toBeNull();
      expect(TimeService.createTimeInfo(undefined)).toBeNull();
      expect(TimeService.createTimeInfo('invalid-date')).toBeNull();
    });
  });

  describe('formatForDisplay', () => {
    test('should format ISO time correctly', () => {
      const isoTime = '2025-07-26T14:30:00.000Z';
      const result = TimeService.formatForDisplay(isoTime);
      
      expect(result).toMatch(/^\d{2}\/\d{2} \d{1,2}:\d{2} (AM|PM)$/);
      // UTC 時間 14:30 對應的本地顯示格式
      expect(result).toContain('07/26');
      expect(result).toContain('PM');
    });

    test('should format Date object correctly', () => {
      const date = new Date('2025-07-26T02:30:00.000Z');
      const result = TimeService.formatForDisplay(date);
      
      expect(result).toMatch(/^\d{2}\/\d{2} \d{1,2}:\d{2} (AM|PM)$/);
      expect(result).toContain('07/26');
      expect(result).toContain('AM');
    });

    test('should return null for invalid input', () => {
      expect(TimeService.formatForDisplay(null)).toBeNull();
      expect(TimeService.formatForDisplay('invalid-date')).toBeNull();
    });
  });

  describe('formatForStorage', () => {
    test('should format ISO time to YYYY-MM-DD', () => {
      const isoTime = '2025-07-26T14:30:00.000Z';
      const result = TimeService.formatForStorage(isoTime);
      
      expect(result).toBe('2025-07-26');
    });

    test('should format Date object to YYYY-MM-DD', () => {
      const date = new Date('2025-07-26T14:30:00.000Z');
      const result = TimeService.formatForStorage(date);
      
      expect(result).toBe('2025-07-26');
    });

    test('should return null for invalid input', () => {
      expect(TimeService.formatForStorage(null)).toBeNull();
      expect(TimeService.formatForStorage('invalid-date')).toBeNull();
    });
  });

  describe('validateTimeInfo', () => {
    test('should validate correct timeInfo structure', () => {
      const validTimeInfo = {
        display: '07/26 2:30 PM',
        date: '2025-07-26',
        raw: '2025-07-26T14:30:00.000Z',
        timestamp: 1721998200000
      };
      
      expect(TimeService.validateTimeInfo(validTimeInfo)).toBe(true);
    });

    test('should accept null as valid', () => {
      expect(TimeService.validateTimeInfo(null)).toBe(true);
    });

    test('should reject missing required fields', () => {
      const incompleteTimeInfo = {
        display: '07/26 2:30 PM'
        // 缺少 date, raw 字段
      };
      
      expect(TimeService.validateTimeInfo(incompleteTimeInfo)).toBe(false);
    });

    test('should reject invalid display format', () => {
      const invalidTimeInfo = {
        display: 'invalid-format',
        date: '2025-07-26',
        raw: '2025-07-26T14:30:00.000Z'
      };
      
      expect(TimeService.validateTimeInfo(invalidTimeInfo)).toBe(false);
    });

    test('should reject invalid date format', () => {
      const invalidTimeInfo = {
        display: '07/26 2:30 PM',
        date: 'invalid-date',
        raw: '2025-07-26T14:30:00.000Z'
      };
      
      expect(TimeService.validateTimeInfo(invalidTimeInfo)).toBe(false);
    });

    test('should reject non-object input', () => {
      expect(TimeService.validateTimeInfo('string')).toBe(false);
      expect(TimeService.validateTimeInfo(123)).toBe(false);
      expect(TimeService.validateTimeInfo([])).toBe(false);
    });
  });

  describe('Integration tests', () => {
    test('createTimeInfo output should pass validateTimeInfo', () => {
      const isoTime = '2025-07-26T14:30:00.000Z';
      const timeInfo = TimeService.createTimeInfo(isoTime);
      
      expect(TimeService.validateTimeInfo(timeInfo)).toBe(true);
    });

    test('all format methods should be consistent', () => {
      const isoTime = '2025-07-26T14:30:00.000Z';
      const timeInfo = TimeService.createTimeInfo(isoTime);
      
      expect(timeInfo.display).toBe(TimeService.formatForDisplay(isoTime));
      expect(timeInfo.date).toBe(TimeService.formatForStorage(isoTime));
      expect(timeInfo.raw).toBe(isoTime);
    });
  });
});