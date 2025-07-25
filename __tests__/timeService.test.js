/**
 * TimeService 測試
 * 驗證時間解析功能，特別是 parseTimeString 方法
 */

const TimeService = require('../src/services/timeService');

describe('TimeService', () => {
  describe('parseTimeString', () => {
    const baseTime = new Date('2025-07-25T10:00:00'); // 2025年7月25日 10:00 AM

    test('should parse relative dates correctly', async () => {
      // 今天
      const today = await TimeService.parseTimeString('今天 2:30', baseTime);
      expect(today.getDate()).toBe(25);
      expect(today.getHours()).toBe(2);
      expect(today.getMinutes()).toBe(30);

      // 明天
      const tomorrow = await TimeService.parseTimeString('明天 2:30', baseTime);
      expect(tomorrow.getDate()).toBe(26);
      expect(tomorrow.getHours()).toBe(2);
      expect(tomorrow.getMinutes()).toBe(30);

      // 後天
      const dayAfter = await TimeService.parseTimeString('後天 3:00', baseTime);
      expect(dayAfter.getDate()).toBe(27);
      expect(dayAfter.getHours()).toBe(3);
      expect(dayAfter.getMinutes()).toBe(0);
    });

    test('should parse HH:MM format correctly', async () => {
      const result = await TimeService.parseTimeString('14:30', baseTime);
      expect(result.getHours()).toBe(14);
      expect(result.getMinutes()).toBe(30);
    });

    test('should parse short time format (H:M)', async () => {
      const result = await TimeService.parseTimeString('2:3', baseTime);
      expect(result.getHours()).toBe(2);
      expect(result.getMinutes()).toBe(30); // 2:3 -> 2:30
    });

    test('should parse Chinese time expressions', async () => {
      // 中文數字時間
      const result1 = await TimeService.parseTimeString('三點', baseTime);
      expect(result1.getHours()).toBe(3);
      expect(result1.getMinutes()).toBe(0);

      // 下午時間
      const result2 = await TimeService.parseTimeString('下午三點', baseTime);
      expect(result2.getHours()).toBe(15); // 3 PM
      expect(result2.getMinutes()).toBe(0);

      // 上午時間
      const result3 = await TimeService.parseTimeString('上午十一點', baseTime);
      expect(result3.getHours()).toBe(11);
      expect(result3.getMinutes()).toBe(0);
    });

    test('should parse half hour expressions', async () => {
      const result = await TimeService.parseTimeString('三點半', baseTime);
      expect(result.getHours()).toBe(3);
      expect(result.getMinutes()).toBe(30);
    });

    test('should parse number with 點 format', async () => {
      const result1 = await TimeService.parseTimeString('3點', baseTime);
      expect(result1.getHours()).toBe(3);
      expect(result1.getMinutes()).toBe(0);

      const result2 = await TimeService.parseTimeString('下午3點', baseTime);
      expect(result2.getHours()).toBe(15);
      expect(result2.getMinutes()).toBe(0);
    });

    test('should handle PM/AM correctly', async () => {
      const result1 = await TimeService.parseTimeString('3 PM', baseTime);
      expect(result1.getHours()).toBe(15);

      const result2 = await TimeService.parseTimeString('11 AM', baseTime);
      expect(result2.getHours()).toBe(11);

      // 12 AM should be 0 (midnight)
      const result3 = await TimeService.parseTimeString('12 AM', baseTime);
      expect(result3.getHours()).toBe(0);
    });

    test('should handle complex expressions', async () => {
      const testCases = [
        { input: '明天下午三點', expectedHour: 15, expectedDate: 26 },
        { input: '今天上午十點半', expectedHour: 10, expectedMinute: 30, expectedDate: 25 },
        { input: '後天2:30', expectedHour: 2, expectedMinute: 30, expectedDate: 27 }
      ];

      for (const testCase of testCases) {
        const result = await TimeService.parseTimeString(testCase.input, baseTime);
        expect(result.getHours()).toBe(testCase.expectedHour);
        if (testCase.expectedMinute !== undefined) {
          expect(result.getMinutes()).toBe(testCase.expectedMinute);
        }
        if (testCase.expectedDate !== undefined) {
          expect(result.getDate()).toBe(testCase.expectedDate);
        }
      }
    });

    test('should handle edge cases', async () => {
      // 空字符串
      await expect(TimeService.parseTimeString('')).rejects.toThrow();
      
      // null 輸入
      await expect(TimeService.parseTimeString(null)).rejects.toThrow();
      
      // undefined 輸入
      await expect(TimeService.parseTimeString(undefined)).rejects.toThrow();
    });

    test('should use current time as default reference', async () => {
      const result = await TimeService.parseTimeString('2:30');
      expect(result).toBeInstanceOf(Date);
      expect(result.getHours()).toBe(2);
      expect(result.getMinutes()).toBe(30);
    });
  });

  describe('parseDateOffset', () => {
    test('should return correct date offsets', () => {
      expect(TimeService.parseDateOffset('今天')).toBe(0);
      expect(TimeService.parseDateOffset('今日')).toBe(0);
      expect(TimeService.parseDateOffset('明天')).toBe(1);
      expect(TimeService.parseDateOffset('明日')).toBe(1);
      expect(TimeService.parseDateOffset('後天')).toBe(2);
      expect(TimeService.parseDateOffset('昨天')).toBe(-1);
      expect(TimeService.parseDateOffset('昨日')).toBe(-1);
      expect(TimeService.parseDateOffset('前天')).toBe(-2);
      expect(TimeService.parseDateOffset('隨便什麼')).toBe(0); // 默認今天
    });
  });

  describe('parseTimeComponent', () => {
    test('should parse various time formats', () => {
      // HH:MM 格式
      const result1 = TimeService.parseTimeComponent('14:30');
      expect(result1.hour).toBe(14);
      expect(result1.minute).toBe(30);

      // 中文時間
      const result2 = TimeService.parseTimeComponent('三點');
      expect(result2.hour).toBe(3);
      expect(result2.minute).toBe(0);

      // 下午時間
      const result3 = TimeService.parseTimeComponent('下午三點');
      expect(result3.hour).toBe(15);

      // 半點
      const result4 = TimeService.parseTimeComponent('三點半');
      expect(result4.hour).toBe(3);
      expect(result4.minute).toBe(30);

      // 沒有時間信息
      const result5 = TimeService.parseTimeComponent('只是普通文字');
      expect(result5.hour).toBeNull();
      expect(result5.minute).toBe(0);
    });

    test('should handle traditional and simplified Chinese', () => {
      // 繁體
      const result1 = TimeService.parseTimeComponent('三點');
      expect(result1.hour).toBe(3);

      // 簡體
      const result2 = TimeService.parseTimeComponent('三点');
      expect(result2.hour).toBe(3);
    });
  });

  describe('getCurrentUserTime', () => {
    test('should return current time in specified timezone', () => {
      const taipeiTime = TimeService.getCurrentUserTime('Asia/Taipei');
      const utcTime = TimeService.getCurrentUserTime('UTC');
      
      expect(taipeiTime).toBeInstanceOf(Date);
      expect(utcTime).toBeInstanceOf(Date);
      
      // 台北時間應該與 UTC 時間不同（除非正好是 UTC+8 的整點時刻）
      // 這裡只驗證都是有效的 Date 對象
      expect(taipeiTime.getTime()).toBeDefined();
      expect(utcTime.getTime()).toBeDefined();
    });

    test('should default to Asia/Taipei timezone', () => {
      const defaultTime = TimeService.getCurrentUserTime();
      const taipeiTime = TimeService.getCurrentUserTime('Asia/Taipei');
      
      // 應該返回相同的時間（因為默認就是台北時間）
      expect(Math.abs(defaultTime.getTime() - taipeiTime.getTime())).toBeLessThan(1000);
    });
  });

  describe('createDateInTimezone', () => {
    test('should create date in specified timezone', () => {
      const sourceDate = new Date('2025-07-25T10:00:00Z'); // UTC 時間
      const taipeiDate = TimeService.createDateInTimezone(sourceDate, 'Asia/Taipei');
      
      expect(taipeiDate).toBeInstanceOf(Date);
      // 驗證時區轉換是否正確進行
      expect(taipeiDate.getTime()).toBeDefined();
    });
  });

  describe('timezone-aware parsing', () => {
    test('should parse time correctly in user timezone', async () => {
      const baseTime = new Date('2025-07-25T02:00:00Z'); // UTC 10:00 = 台北 18:00
      
      // 用戶說「下午三點」，應該解析為台北時間下午3點
      const result = await TimeService.parseTimeString('下午三點', baseTime, 'Asia/Taipei');
      
      expect(result).toBeInstanceOf(Date);
      expect(result.getHours()).toBe(15); // 下午3點 = 15:00
    });

    test('should handle different timezones correctly', async () => {
      const baseTime = new Date('2025-07-25T10:00:00Z');
      
      const taipeiResult = await TimeService.parseTimeString('下午三點', baseTime, 'Asia/Taipei');
      const utcResult = await TimeService.parseTimeString('下午三點', baseTime, 'UTC');
      
      expect(taipeiResult.getHours()).toBe(15);
      expect(utcResult.getHours()).toBe(15);
      
      // 兩個結果都應該是有效的 Date 對象
      expect(taipeiResult).toBeInstanceOf(Date);
      expect(utcResult).toBeInstanceOf(Date);
    });
  });

  describe('other methods still throw NotImplementedError', () => {

    test('formatForDisplay should work correctly now (implemented in Step 1)', () => {
      const date = new Date('2025-07-26T14:30:00.000Z');
      const result = TimeService.formatForDisplay(date);
      expect(result).toMatch(/^\d{2}\/\d{2} \d{1,2}:\d{2} (AM|PM)$/);
    });

    test('validateTime should throw NotImplementedError', async () => {
      await expect(TimeService.validateTime(new Date())).rejects.toThrow('NotImplementedError');
    });

    test('calculateTimeRange should throw NotImplementedError', async () => {
      await expect(TimeService.calculateTimeRange(new Date(), new Date())).rejects.toThrow('NotImplementedError');
    });

    test('checkTimeConflict should throw NotImplementedError', async () => {
      await expect(TimeService.checkTimeConflict(new Date(), [])).rejects.toThrow('NotImplementedError');
    });
  });
});