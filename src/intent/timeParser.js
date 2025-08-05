/**
 * 高覆蓋度時間解析系統
 * 基於第一性原則設計，支援中文數字、多種格式、智能推理
 */

/**
 * 中文數字轉換系統
 */
class ChineseNumberConverter {
  constructor() {
    this.numberMap = {
      零: 0,
      一: 1,
      二: 2,
      三: 3,
      四: 4,
      五: 5,
      六: 6,
      七: 7,
      八: 8,
      九: 9,
      十: 10,
      十一: 11,
      十二: 12,
      十三: 13,
      十四: 14,
      十五: 15,
      十六: 16,
      十七: 17,
      十八: 18,
      十九: 19,
      二十: 20,
      二十一: 21,
      二十二: 22,
      二十三: 23,
      二十四: 24,
    };

    // 擴展映射包含更多變體
    this.extendedMap = {
      ...this.numberMap,
      兩: 2,
      倆: 2,
      半: 0.5,
      一十: 10,
      二十: 20,
      三十: 30,
      四十: 40,
      五十: 50,
    };
  }

  /**
   * 轉換中文數字為阿拉伯數字
   */
  convertChineseNumber(chineseNum) {
    if (!chineseNum) return null;

    // 直接映射
    if (this.extendedMap.hasOwnProperty(chineseNum)) {
      return this.extendedMap[chineseNum];
    }

    // 處理複合數字 (如: 二十三)
    if (chineseNum.length > 1) {
      // 十X格式 (十一, 十二, 十三...)
      if (chineseNum.startsWith('十') && chineseNum.length === 2) {
        const secondChar = chineseNum[1];
        if (this.numberMap[secondChar] !== undefined) {
          return 10 + this.numberMap[secondChar];
        }
      }

      // XX十格式 (二十, 三十...)
      if (chineseNum.endsWith('十')) {
        const firstChar = chineseNum[0];
        if (this.numberMap[firstChar] !== undefined) {
          return this.numberMap[firstChar] * 10;
        }
      }

      // XX十Y格式 (二十三, 三十五...)
      const tenIndex = chineseNum.indexOf('十');
      if (tenIndex > 0 && tenIndex < chineseNum.length - 1) {
        const tenPart = chineseNum.substring(0, tenIndex);
        const unitPart = chineseNum.substring(tenIndex + 1);

        const tenValue = this.numberMap[tenPart];
        const unitValue = this.numberMap[unitPart];

        if (tenValue !== undefined && unitValue !== undefined) {
          return tenValue * 10 + unitValue;
        }
      }
    }

    return null;
  }

  /**
   * 從文本中提取並轉換所有中文數字
   */
  extractNumbers(text) {
    const results = [];

    // 匹配中文數字模式
    const patterns = [
      /([一二三四五六七八九十兩倆]+)/g,
      /(\d+)/g, // 也包含阿拉伯數字
    ];

    for (const pattern of patterns) {
      let match;
      while ((match = pattern.exec(text)) !== null) {
        const numText = match[1];
        const arabicNum = pattern === patterns[0]
          ? this.convertChineseNumber(numText)
          : parseInt(numText);

        if (arabicNum !== null && !isNaN(arabicNum)) {
          results.push({
            original: numText,
            value: arabicNum,
            index: match.index,
          });
        }
      }
    }

    return results;
  }
}

/**
 * 時間段智能推理系統
 */
class TimePeriodInferencer {
  constructor() {
    this.periodMappings = {
      // 早上時段 (6:00 - 11:59)
      早上: { range: [6, 11], priority: 1 },
      上午: { range: [6, 11], priority: 1 },
      早晨: { range: [6, 9], priority: 2 },
      清晨: { range: [5, 8], priority: 2 },

      // 中午時段 (12:00 - 13:59)
      中午: { range: [12, 13], priority: 1 },
      正午: { range: [12, 12], priority: 2 },

      // 下午時段 (14:00 - 17:59)
      下午: { range: [12, 17], priority: 1 },
      午後: { range: [13, 17], priority: 2 },

      // 晚上時段 (18:00 - 23:59)
      晚上: { range: [18, 23], priority: 1 },
      夜晚: { range: [19, 23], priority: 2 },
      夜間: { range: [20, 23], priority: 2 },
      深夜: { range: [22, 24], priority: 2 },

      // 通用標識
      AM: { range: [0, 11], priority: 3 },
      am: { range: [0, 11], priority: 3 },
      PM: { range: [12, 23], priority: 3 },
      pm: { range: [12, 23], priority: 3 },
    };
  }

  /**
   * 從文本中識別時間段
   */
  identifyPeriod(text) {
    let bestMatch = null;
    let highestPriority = 0;

    for (const [period, config] of Object.entries(this.periodMappings)) {
      if (text.includes(period) && config.priority > highestPriority) {
        bestMatch = { period, ...config };
        highestPriority = config.priority;
      }
    }

    return bestMatch;
  }

  /**
   * 智能推理小時值
   */
  inferHour(rawHour, periodInfo) {
    if (!periodInfo) {
      // 無時間段信息，使用24小時制
      return rawHour;
    }

    const { range } = periodInfo;
    const [start, end] = range;

    // 如果原始小時在範圍內，直接使用
    if (rawHour >= start && rawHour <= end) {
      return rawHour;
    }

    // 12小時制推理
    if (rawHour <= 12) {
      // 下午/晚上時段，且小時 <= 12，需要加12
      if (start >= 12 && rawHour < 12) {
        const adjustedHour = rawHour + 12;
        if (adjustedHour <= end) {
          return adjustedHour;
        }
      }

      // 早上時段，12點改為0點
      if (rawHour === 12 && start < 12) {
        return 0;
      }
    }

    return rawHour;
  }
}

/**
 * 多格式時間解析引擎
 */
class TimeFormatParser {
  constructor() {
    this.numberConverter = new ChineseNumberConverter();
    this.periodInferencer = new TimePeriodInferencer();
  }

  /**
   * 解析時間格式的核心函數
   */
  parseTimeFormats(text) {
    const patterns = [
      // 中文數字 + 時間段格式
      {
        regex: /(早上|上午|下午|晚上|夜晚|中午|清晨|夜間|深夜|午後|正午)\s*([一二三四五六七八九十兩倆]+)\s*([點時])\s*([一二三四五六七八九十兩倆半]*)\s*([分]?)/,
        type: 'chinese_period',
      },

      // 阿拉伯數字 + 時間段格式
      {
        regex: /(早上|上午|下午|晚上|夜晚|中午|清晨|夜間|深夜|午後|正noon)\s*(\d{1,2})\s*([點時:：])\s*(\d{0,2}|半)?\s*([分]?)/,
        type: 'arabic_period',
      },

      // 混合格式 (中文時間段 + 阿拉伯數字)
      {
        regex: /(早上|上午|下午|晚上|夜晚|中午|清晨|夜間|深夜|午後|正午)\s*(\d{1,2})\s*([點時])\s*([一二三四五六七八九十兩倆半]*)\s*([分]?)/,
        type: 'mixed_period',
      },

      // 純數字格式 (24小時制)
      {
        regex: /(\d{1,2})\s*([點時:：])\s*(\d{0,2}|半)?\s*([分]?)/,
        type: 'pure_numeric',
      },

      // 純中文數字格式
      {
        regex: /([一二三四五六七八九十兩倆]+)\s*([點時])\s*([一二三四五六七八九十兩倆半]*)\s*([分]?)/,
        type: 'pure_chinese',
      },

      // 特殊格式：半點
      {
        regex: /(早上|上午|下午|晚上|夜晚|中午)?\s*([一二三四五六七八九十兩倆\d]+)\s*([點時])\s*(半)/,
        type: 'half_hour',
      },

      // AM/PM 格式
      {
        regex: /(AM|PM|am|pm)\s*(\d{1,2})\s*([點時:：]?)\s*(\d{0,2})?\s*([分]?)/,
        type: 'ampm',
      },
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern.regex);
      if (match) {
        const result = this.processMatch(match, pattern.type);
        if (result) {
          return result;
        }
      }
    }

    return null;
  }

  /**
   * 處理正則匹配結果
   */
  processMatch(match, type) {
    try {
      let periodText = '';
      let hourText = '';
      let minuteText = '';

      switch (type) {
        case 'chinese_period':
          [, periodText, hourText, , minuteText] = match;
          break;

        case 'arabic_period':
        case 'mixed_period':
          [, periodText, hourText, , minuteText] = match;
          break;

        case 'pure_numeric':
          [, hourText, , minuteText] = match;
          break;

        case 'pure_chinese':
          [, hourText, , minuteText] = match;
          break;

        case 'half_hour':
          [, periodText, hourText] = match;
          minuteText = '30';
          break;

        case 'ampm':
          [, periodText, hourText, , minuteText] = match;
          break;
      }

      // 轉換小時
      let hour = this.convertToNumber(hourText);
      if (hour === null || hour < 0 || hour > 24) {
        return null;
      }

      // 轉換分鐘
      let minute = 0;
      if (minuteText) {
        if (minuteText === '半') {
          minute = 30;
        } else {
          minute = this.convertToNumber(minuteText);
          if (minute === null || minute < 0 || minute >= 60) {
            minute = 0;
          }
        }
      }

      // 時間段智能推理
      const periodInfo = this.periodInferencer.identifyPeriod(periodText || match[0]);
      hour = this.periodInferencer.inferHour(hour, periodInfo);

      // 驗證最終結果
      if (hour >= 0 && hour < 24 && minute >= 0 && minute < 60) {
        return {
          hour,
          minute,
          formatted: `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`,
          periodInfo,
          matchType: type,
          originalText: match[0],
        };
      }
    } catch (error) {
      console.error('處理時間匹配失敗:', error, match);
    }

    return null;
  }

  /**
   * 統一數字轉換
   */
  convertToNumber(text) {
    if (!text) return null;

    // 阿拉伯數字
    const arabicNum = parseInt(text);
    if (!isNaN(arabicNum)) {
      return arabicNum;
    }

    // 中文數字
    return this.numberConverter.convertChineseNumber(text);
  }
}

/**
 * 主時間解析器
 */
class AdvancedTimeParser {
  constructor() {
    this.formatParser = new TimeFormatParser();
  }

  /**
   * 解析時間的主要入口
   */
  parseScheduleTime(text) {
    if (!text) return null;

    console.log('🕒 開始高級時間解析:', text);

    const result = this.formatParser.parseTimeFormats(text);

    if (result) {
      console.log('✅ 時間解析成功:', {
        input: text,
        output: result.formatted,
        details: {
          hour: result.hour,
          minute: result.minute,
          matchType: result.matchType,
          periodInfo: result.periodInfo?.period,
        },
      });

      return result.formatted;
    }

    console.log('❌ 時間解析失敗:', text);
    return null;
  }

  /**
   * 測試時間解析能力
   */
  testParsing() {
    const testCases = [
      // 中文數字格式
      '早上十點', '下午三點', '晚上八點半', '中午十二點',
      '上午九點三十分', '夜晚十一點十五分',

      // 阿拉伯數字格式
      '早上10點', '下午3點', '晚上8點半', '中午12點',
      '上午9點30分', '夜晚11點15分',

      // 混合格式
      '早上10點三十分', '下午3點半', '晚上8點十五分',

      // 24小時制
      '14點30分', '09點', '23點45分', '06點',

      // 特殊格式
      '十點半', '3點半', 'AM 10點', 'PM 3點',

      // 複雜格式
      '明天早上十點', '下週三下午三點半',
    ];

    console.log('\n🧪 時間解析測試開始...\n');

    const results = [];
    for (const testCase of testCases) {
      const result = this.parseScheduleTime(testCase);
      results.push({
        input: testCase,
        output: result,
        success: result !== null,
      });
    }

    const successCount = results.filter((r) => r.success).length;
    const coverage = ((successCount / results.length) * 100).toFixed(1);

    console.log(`\n📊 測試結果: ${successCount}/${results.length} 成功 (覆蓋率: ${coverage}%)\n`);

    // 顯示失敗案例
    const failed = results.filter((r) => !r.success);
    if (failed.length > 0) {
      console.log('❌ 失敗案例:');
      failed.forEach((f) => console.log(`  "${f.input}" → ${f.output}`));
    }

    return results;
  }
}

// 建立全域實例
const timeParser = new AdvancedTimeParser();

// 匯出函數
module.exports = {
  parseScheduleTime: (text) => timeParser.parseScheduleTime(text),
  testTimeParser: () => timeParser.testParsing(),
  AdvancedTimeParser,
  ChineseNumberConverter,
  TimePeriodInferencer,
  TimeFormatParser,
};
