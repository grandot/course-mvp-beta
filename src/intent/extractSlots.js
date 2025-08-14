/**
 * 從自然語言中提取結構化資料 (Slots)
 * 根據不同意圖類型提取對應的實體欄位
 */

/**
 * 時間相關的輔助函式
 */
function parseTimeReference(message) {
  const timeReferences = {
    今天: 'today',
    明天: 'tomorrow',
    後天: 'day_after_tomorrow',
    昨天: 'yesterday',
    前天: 'day_before_yesterday',
    這週: 'this_week',
    下週: 'next_week',
    上週: 'last_week',
    本週: 'this_week',
    下周: 'next_week',
    上周: 'last_week',
  };

  for (const [chinese, english] of Object.entries(timeReferences)) {
    if (message.includes(chinese)) {
      return english;
    }
  }

  return null;
}

function parseSpecificDate(message) {
  // 匹配日期格式：1/15, 01/15, 2025/1/15, etc.
  const datePatterns = [
    /(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/, // 2025/1/15, 2025-1-15
    /(\d{1,2})[\/\-](\d{1,2})/, // 1/15, 1-15
  ];

  for (const pattern of datePatterns) {
    const match = message.match(pattern);
    if (match) {
      if (match.length === 4) {
        // 有年份
        const year = match[1];
        const month = match[2].padStart(2, '0');
        const day = match[3].padStart(2, '0');
        return `${year}-${month}-${day}`;
      } if (match.length === 3) {
        // 沒有年份，使用當前年份
        const currentYear = new Date().getFullYear();
        const month = match[1].padStart(2, '0');
        const day = match[2].padStart(2, '0');
        return `${currentYear}-${month}-${day}`;
      }
    }
  }

  return null;
}

function parseScheduleTime(message) {
  // 使用高覆蓋度時間解析器
  const { parseScheduleTime: advancedParseTime } = require('./timeParser');

  const result = advancedParseTime(message);
  if (result) {
    return result;
  }

  // 備用：原始解析邏輯 (保持向後兼容)
  const timePatterns = [
    // 完整時間格式
    /(?:上午|早上|AM|am)\s*(\d{1,2})(?:[點时:](\d{1,2}))?/,
    /(?:下午|PM|pm)\s*(\d{1,2})(?:[點时:](\d{1,2}))?/,
    /(?:晚上|夜間|evening)\s*(\d{1,2})(?:[點时:](\d{1,2}))?/,
    /(?:中午|noon)\s*(\d{1,2})(?:[點时:](\d{1,2}))?/,
    // 24小時制
    /(\d{1,2})[點时:](\d{1,2})/,
    /(\d{1,2})[點时]/,
    // 特殊格式
    /(\d{1,2})點半/,
    /(\d{1,2})時半/,
  ];

  for (const pattern of timePatterns) {
    let match = null;
    try {
      match = message.match(pattern);
    } catch (e) {
      console.warn('⚠️ 時間解析正則失敗:', pattern, e?.message || e);
      match = null;
    }
    if (match) {
      let hour = parseInt(match[1]);
      const minute = match[2] ? parseInt(match[2]) : 0;

      // 處理上午/下午
      if (message.includes('下午') || message.includes('PM') || message.includes('pm')) {
        if (hour < 12) hour += 12;
      } else if (message.includes('上午') || message.includes('早上') || message.includes('AM') || message.includes('am')) {
        if (hour === 12) hour = 0;
      } else if (message.includes('晚上') || message.includes('夜間')) {
        if (hour < 12) hour += 12;
      }

      // 處理半點
      const finalMinute = message.includes('半') ? 30 : minute;

      return `${hour.toString().padStart(2, '0')}:${finalMinute.toString().padStart(2, '0')}`;
    }
  }

  return null;
}

/**
 * 統一重複功能開關檢查（單一事實來源）
 * @returns {boolean} 是否啟用重複功能
 */
function isRecurringEnabled() {
  return process.env.ENABLE_RECURRING_COURSES === 'true' || process.env.ENABLE_DAILY_RECURRING === 'true';
}

/**
 * 從訊息中提取每月重複的日期（1-31）
 * @param {string} message - 用戶訊息
 * @returns {number|null} 月日數字，如「每月15號」→15
 */
function parseMonthDay(message) {
  if (!message) return null;
  
  // 匹配「每月X號」、「月X號」等格式
  const monthDayPattern = /(?:每月|月)(\d{1,2})號/g;
  const match = monthDayPattern.exec(message);
  
  if (match && match[1]) {
    const day = parseInt(match[1], 10);
    // 驗證日期範圍
    if (day >= 1 && day <= 31) {
      return day;
    }
  }
  
  return null;
}

/**
 * 識別重複類型：每日、每週、每月
 * @param {string} message - 用戶訊息
 * @returns {string|false} 重複類型或 false
 */
function identifyRecurrenceType(message) {
  // 檢查是否有重複關鍵詞
  const dailyKeywords = ['每天', '每日', '天天', '日日', '每一天'];
  const weeklyKeywords = ['每週', '每周', '週週', '每星期'];
  const monthlyKeywords = ['每月', '每個月', '月月', '每月份'];

  const hasDaily = dailyKeywords.some((keyword) => message.includes(keyword));
  const hasWeekly = weeklyKeywords.some((keyword) => message.includes(keyword));
  const hasMonthly = monthlyKeywords.some((keyword) => message.includes(keyword));

  if (!isRecurringEnabled()) {
    // 如果重複功能關閉但偵測到重複關鍵詞，回傳特殊值用於降級提示
    if (hasDaily || hasWeekly || hasMonthly) {
      return 'disabled';
    }
    return false;
  }

  // 功能開啟時的正常識別
  if (hasDaily) return 'daily';
  if (hasWeekly) return 'weekly';
  if (hasMonthly) return 'monthly';

  return false;
}

/**
 * 從訊息中提取每月重複的日期（1-31）
 * 例：「每月15號」、「月1號」
 */
function parseMonthDay(message) {
  try {
    if (!message) return null;
    const m = message.match(/(?:每月|月)(\d{1,2})號/);
    if (m && m[1]) {
      const day = parseInt(m[1], 10);
      if (Number.isFinite(day) && day >= 1 && day <= 31) return day;
    }
  } catch (_) {}
  return null;
}

function parseDayOfWeek(message) {
  const dayMapping = {
    週一: 1,
    周一: 1,
    星期一: 1,
    Monday: 1,
    週二: 2,
    周二: 2,
    星期二: 2,
    Tuesday: 2,
    週三: 3,
    周三: 3,
    星期三: 3,
    Wednesday: 3,
    週四: 4,
    周四: 4,
    星期四: 4,
    Thursday: 4,
    週五: 5,
    周五: 5,
    星期五: 5,
    Friday: 5,
    週六: 6,
    周六: 6,
    星期六: 6,
    Saturday: 6,
    週日: 0,
    周日: 0,
    星期日: 0,
    Sunday: 0,
  };

  for (const [day, number] of Object.entries(dayMapping)) {
    if (message.includes(day)) {
      return number;
    }
  }

  return null;
}

/**
 * 解析多天（每週一三五 / 週二四 / 星期一、三、五 / 週一到週五）為數字陣列
 * 回傳：[1,3,5] 這類 0(日)~6(六) 的集合；若無法解析回 []
 */
function parseDaysOfWeekMulti(message) {
  const out = new Set();
  if (!message || typeof message !== 'string') return [];

  // 1) 範圍：星期一到星期五 / 週二至週四 / 周一到五
  try {
    const rangeRe = /(星期|週|周)?([一二三四五六日天])(到|至)(星期|週|周)?([一二三四五六日天])/g;
    let m;
    while ((m = rangeRe.exec(message)) !== null) {
      const start = m[2];
      const end = m[5];
      const map = { '日': 0, '天': 0, '一': 1, '二': 2, '三': 3, '四': 4, '五': 5, '六': 6 };
      if (map[start] !== undefined && map[end] !== undefined) {
        const s = map[start];
        const e = map[end];
        if (s <= e) {
          for (let d = s; d <= e; d += 1) out.add(d);
        } else {
          // 跨週（極少見）：六到二 → 六、日(0)、一、二
          for (let d = s; d <= 6; d += 1) out.add(d);
          for (let d = 0; d <= e; d += 1) out.add(d);
        }
      }
    }
  } catch (_) {}

  // 2) 列舉：每週一三五 / 週二、四 / 星期一三五 / 一三五
  try {
    const enumerateHostRe = /(每週|每周|每星期|每個?星期|星期|週|周)([一二三四五六日天、，,和與及\s]+)/g;
    let m2;
    const map = { '日': 0, '天': 0, '一': 1, '二': 2, '三': 3, '四': 4, '五': 5, '六': 6 };
    while ((m2 = enumerateHostRe.exec(message)) !== null) {
      const tail = (m2[2] || '').replace(/(星期|週|周)/g, '');
      const chars = tail.match(/[一二三四五六日天]/g) || [];
      for (const ch of chars) {
        if (map[ch] !== undefined) out.add(map[ch]);
      }
    }
  } catch (_) {}

  return Array.from(out.values()).sort((a, b) => a - b);
}

function checkRecurring(message) {
  // 優先使用新的重複類型識別
  const recurrenceType = identifyRecurrenceType(message);
  if (recurrenceType) {
    return recurrenceType;
  }

  // 向下兼容：原有邏輯，但需要檢查功能開關
  if (!isRecurringEnabled()) {
    return false;
  }

  const recurringKeywords = ['每週', '每周', '每月', '重複', '定期', '固定', '循環', '週期性'];

  // 明確的重複關鍵詞
  if (recurringKeywords.some((keyword) => message.includes(keyword))) {
    return 'weekly';
  }

  // 如果包含星期詞彙且沒有明確的非重複指示，視為重複課程
  const dayKeywords = ['星期一', '星期二', '星期三', '星期四', '星期五', '星期六', '星期日',
    '週一', '週二', '週三', '週四', '週五', '週六', '週日',
    '周一', '周二', '周三', '周四', '周五', '周六', '周日'];

  const hasDayKeyword = dayKeywords.some((day) => message.includes(day));

  // 明確的非重複指示詞
  const nonRecurringKeywords = ['這次', '今天', '明天', '昨天', '下週一次', '單次', '一次性', '臨時'];
  const hasNonRecurringKeyword = nonRecurringKeywords.some((keyword) => message.includes(keyword));

  // 如果包含星期但沒有非重複指示，預設為每週重複
  if (hasDayKeyword && !hasNonRecurringKeyword) {
    return 'weekly';
  }

  return false;
}

/**
 * 提取學生姓名
 */
function extractStudentName(message) {
  // 環境隔離：在生產/無狀態模式下，先用簡化規則避免複雜 lookahead 正則在不同環境表現差異
  try {
    const statelessMode = process.env.STATELESS_MODE === 'true'
      || (process.env.ENABLE_ENV_ISOLATION === 'true' && process.env.NODE_ENV === 'production');
    if (statelessMode) {
      const markers = ['這週', '本週', '下週', '這周', '本周', '下周', '今天', '明天', '昨天', '課表'];
      for (const mk of markers) {
        const idx = message.indexOf(mk);
        if (idx > 0 && idx <= 12) {
          let candidate = message.substring(0, idx).trim();
          candidate = candidate.replace(/^(查詢|看|看看|顯示)/, '').replace(/的$/, '');
          candidate = stripTimeSuffixFromName(candidate);
          if (
            candidate
            && candidate.length >= 2
            && candidate.length <= 12
            && /[一-龥A-Za-z]/.test(candidate)
            && !candidate.includes('課')
          ) {
            return candidate;
          }
        }
      }
    }
  } catch (_) {}

  // 常見的學生姓名模式 - 按精確度排序
  const namePatterns = [
    // 立即處理『名字+下/這/本週(周)+課表』開頭句型，避免後綴吃入姓名
    /^([小大]?[一-龥A-Za-z]{1,12})(?=這週|這周|本週|本周|下週|下周|課表)/,
    // 最高精確度模式 - 明確的姓名結構（調整順序，優先精確匹配）
    /(?:新增|幫.*?新增)\s*([小大]?[一-龥A-Za-z]{2,6})的/, // 新增小明的、幫我新增小明的
    /(?:安排)\s*([小大]?[一-龥A-Za-z]{2,6})每週/, // 安排小華每週
    /(?:安排)\s*([小大]?[一-龥A-Za-z]{2,6})每月/, // 安排小華每月
    /^([小大]?[一-龥A-Za-z]{1,12})(?=固定)/, // 小明固定… / Lumi固定…
    /^([小大]?[一-龥A-Za-z]{1,12})(?=每個?星期)/, // 小明每個星期…
    /([小大]?[一-龥A-Za-z]{2,6})的.*課/, // 小明的數學課
    /查詢([小大]?[一-龥A-Za-z]{2,6})[今昨明]天/, // 查詢小明今天
    /記錄([小大]?[一-龥A-Za-z]{2,6})[今昨明]天/, // 記錄小光昨天
    /老師說([小大]?[一-龥A-Za-z]{2,6})表現/, // 老師說小光表現
    /老師說([小大]?[一-龥A-Za-z]{2,6})很/, // 老師說小光很好
    /老師說([小大]?[一-龥A-Za-z]{2,6})非常/, // 老師說小光非常棒

    // 高精確度模式 - 專門處理新增類型的語句
    /(?:新增|幫.*?新增|安排)\s*([小大]?[一-龥A-Za-z]{2,6})(?=星期|週|[今昨明]天)/, // 新增小明星期、幫我新增小明星期
    /(?:取消|刪除|刪掉)([小大]?[一-龥A-Za-z]{2,6})的/, // 取消小明的、刪掉Lumi的
    /查詢([A-Za-z]{3,8})(?=這週|下週|上週|的|今天|明天|昨天)/, // 查詢Lumi這週
    /查詢([小大]?[一-龥]{2,6})(?=這週|下週|上週|的|今天|明天|昨天)/, // 查詢小明這週
    /看.{0,3}([小大]?[一-龥A-Za-z]{2,6})(?=明天|今天|昨天)/, // 看一下小明明天
    /取消([小大]?[一-龥A-Za-z]{2,6})(?=明天|今天|昨天)/, // 取消小明明天
    /(?:今天|昨天|明天)([小大]?[一-龥A-Za-z]{2,6})的/, // 今天小明的
    /提醒.*我.*?([小大]?[一-龥]{2,6})(?=明天)/, // 提醒我小明明天的（中文 2-6）
    /提醒.*我.*?([小大]?[一-龥A-Za-z]{2,12})的/, // 提醒我Lumi的（英文放寬 2-12）

    // 處理每週格式
    /^([小大]?[一-龥A-Za-z]{1,6})每週/, // 小明每週...
    /([A-Za-z]{3,8})星期/, // Lumi星期

    // 中精確度模式
    /^([小大]?[一-龥A-Za-z]{2,6})(?=[今昨明]天|星期|週)/, // 小明今天、小明星期
    /^([一-龥]{2,4})\s/, // 開頭的中文名
  ];

  for (const pattern of namePatterns) {
    const match = message.match(pattern);
    if (match && match[1]) {
      let name = match[1].trim();

      // 針對「小美下週」這類結構，避免把「下/上/本/這」吃進姓名
      try {
        const idx = message.indexOf(name);
        if (idx >= 0) {
          const after = message.slice(idx + name.length);
          // 若名字最後一字是「上下本這」，且名字後面緊接著「週/周/星期」，則去掉尾字
          if (/^(週|周|星期)/.test(after) && /[上下本這]$/.test(name)) {
            name = name.replace(/[上下本這]$/, '');
          }
        }
      } catch (_) {}

      // 嚴格過濾不是姓名的詞彙
      const invalidNames = [
        '今天', '明天', '昨天', '每週', '查詢', '提醒', '取消', '看一下', '記錄',
        '老師說', '這週', '下週', '上週', '安排', '刪掉', '表現', '很好', '內容',
        '一下', '表現很', '提醒我', '明天的', '今天的', '昨天的',
      ];

      // 檢查是否包含無效詞彙
      const containsInvalid = invalidNames.some((invalid) => name.includes(invalid) || name === invalid);

      // 再做一次後綴清理，移除『這週/本週/下週/這周/本周/下周』等時間詞
      name = stripTimeSuffixFromName(name);

      if (!containsInvalid
          && name.length >= 2 && name.length <= 6
          && !name.includes('課')
          && !name.includes('天')
          && !/^[0-9]/.test(name)) { // 不以數字開頭
        return name;
      }
    }
  }

  return null;
}

/**
 * 擷取所有可能的學生候選（保守擷取，不含時間詞）
 */
function findAllStudentCandidates(message) {
  const candidates = new Set();
  const patterns = [
    /([小大]?[一-龥A-Za-z]{2,12})(?=的課|的|今天|明天|昨天|這週|本週|下週|這周|本周|下周|課表)/g,
    /(?:查詢|看|看看|顯示)?([小大]?[一-龥A-Za-z]{2,12})(?=今天|明天|這週|本週|下週)/g,
  ];
  for (const p of patterns) {
    let m;
    while ((m = p.exec(message)) !== null) {
      const name = stripTimeSuffixFromName(m[1]);
      if (!name) continue;
      if (name.length < 2 || name.length > 12) continue;
      if (/(今天|明天|昨天|課|課表)$/.test(name)) continue;
      candidates.add(name);
    }
  }
  return Array.from(candidates);
}

/**
 * 提取課程名稱（增強版：支援模糊匹配和智能推理）
 */
function extractCourseName(message) {
  // 避免在查詢語句中錯誤提取課程名稱
  if (message.includes('有什麼課') || message.includes('有課嗎')
      || message.includes('課表') || message.includes('安排')) {
    return null;
  }

  const coursePatterns = [
    // 最高精確度模式 - 明確的課程結構
    /(?:上|學|要上)([一-龥]{2,6})課?/, // 上數學、學英文、要上鋼琴
    /的([一-龥]{2,6})課/, // 的數學課
    /([一-龥]{2,6})課(?![學了])/, // 數學課 (但不是 "數學課學了")
    /([一-龥]{2,6}評鑑)/, // 評鑑類型，如 測試評鑑

    // 高精確度模式 - 特定結構
    /([一-龥A-Za-z]{2,6})教學/, // XX教學
    /([一-龥A-Za-z]{2,6})訓練/, // XX訓練
    /([一-龥A-Za-z]{2,6})班/, // XX班

    // 中精確度模式 - 時間+課程
    /[點時]([一-龥A-Za-z]{2,6})課/, // 3點數學課
  ];

  for (const pattern of coursePatterns) {
    let match = null;
    try {
      match = message.match(pattern);
    } catch (e) {
      console.warn('⚠️ 課程名稱正則失敗:', pattern, e?.message || e);
      match = null;
    }
    if (match && match[1]) {
      let courseName = match[1];

      // 過濾掉明顯不是課程名稱的結果
      const invalidCourseNames = [
        '今天', '明天', '昨天', '每天', '這週', '下週', '上週',
        '小明', '小光', '小美', '小華', 'Lumi', '老師', '學生',
        '查詢', '提醒', '取消', '記錄', '看一下', '安排', '刪掉',
        '內容', '表現', '很好', '分數', '點的', '期五', '我',
        '學了', '課學', '天學', '點天', '星期', '課前',
      ];

      // 檢查是否包含無效詞彙或字符
      const containsInvalid = invalidCourseNames.some((invalid) => courseName.includes(invalid));
      
      // 額外過濾：如果課程名稱以人名開頭，嘗試提取純課程名稱
      if (courseName.includes('的')) {
        const parts = courseName.split('的');
        if (parts.length >= 2 && parts[1]) {
          courseName = parts[parts.length - 1]; // 取最後一部分
        }
      }

      if (!containsInvalid
          && courseName.length >= 2 && courseName.length <= 8 // 放寬長度限制以支援"跆拳道"
          && !/[0-9]/.test(courseName) // 不包含數字
          && !courseName.includes('點') // 避免時間詞彙
          && !courseName.includes('天')) { // 避免時間詞彙
        // 如果不包含"課"字且不是以"教學/訓練/班"結尾，自動加上"課"
        if (!courseName.includes('課')
            && !courseName.endsWith('教學')
            && !courseName.endsWith('訓練')
            && !courseName.endsWith('班')
            && !courseName.endsWith('評鑑')) {
          courseName += '課';
        }
        return courseName;
      }
    }
  }

  return null;
}

/**
 * 根據意圖類型提取對應的 slots
 */
async function extractSlotsByIntent(message, intent) {
  const slots = {};

  switch (intent) {
    case 'add_homework':
      slots.studentName = extractStudentName(message);
      slots.courseName = extractCourseName(message);
      slots.timeReference = parseTimeReference(message);
      slots.courseDate = parseSpecificDate(message);
      // 作業/練習內容提取（與 record_content 相同規則）
      {
        const contentPatternsHw = [
          /練習了(.+)/,
          /作業[是為要:：](.+)/,
          /複習了(.+)/,
          /題目是(.+)/,
          /內容[是:：](.+)/,
        ];
        for (const pattern of contentPatternsHw) {
          const m = message.match(pattern);
          if (m) { slots.content = m[1].trim(); break; }
        }
      }
      break;

    case 'query_course_content':
      slots.studentName = extractStudentName(message);
      slots.courseName = extractCourseName(message);
      slots.timeReference = parseTimeReference(message);
      slots.courseDate = parseSpecificDate(message);
      break;
    case 'add_course':
    case 'create_recurring_course':
      slots.studentName = extractStudentName(message);
      slots.courseName = extractCourseName(message);
      slots.scheduleTime = parseScheduleTime(message);
      slots.courseDate = parseSpecificDate(message);
      // 先嘗試多天解析；若無則回落單一天
      const daysMulti = parseDaysOfWeekMulti(message);
      slots.dayOfWeek = (Array.isArray(daysMulti) && daysMulti.length > 0)
        ? daysMulti
        : parseDayOfWeek(message);
      const recurrenceResult = checkRecurring(message);
      // 提取每月重複日號（如「每月15號」→ 15）
      if (recurrenceResult === 'monthly') {
        slots.monthDay = parseMonthDay(message);
      }
      
      // 提取每月重複的日期（如「每月15號」）
      if (recurrenceResult === 'monthly') {
        slots.monthDay = parseMonthDay(message);
      }

      // 處理功能關閉但偵測到重複關鍵詞的情況
      if (recurrenceResult === 'disabled') {
        slots.recurring = false;
        slots.recurrenceType = null;
        slots.recurringRequested = true; // 標記用戶要求重複但功能關閉
      } else {
        slots.recurring = !!recurrenceResult; // 轉換為布林值保持兼容性
        slots.recurrenceType = recurrenceResult || null; // 新增重複類型資訊
        slots.recurringRequested = false;
      }
      slots.timeReference = parseTimeReference(message);

      // 額外偵測：若訊息中包含「看似時間」但數值超界（如 25點、13:99），標記為 invalidTime
      // 目的：優先回覆「時間格式錯誤」而非要求其它缺失欄位，提升真實用戶體驗
      try {
        const timeTokenMatch = message.match(/(上午|早上|下午|晚上|夜間|中午|AM|PM|am|pm)?\s*(\d{1,2})\s*[點时:：]?\s*(\d{0,2})?/);
        if (timeTokenMatch) {
          const rawHour = parseInt(timeTokenMatch[2], 10);
          const rawMinute = timeTokenMatch[3] ? parseInt(timeTokenMatch[3], 10) : 0;
          if (!Number.isNaN(rawHour) && (rawHour >= 24 || rawHour < 0 || rawMinute >= 60 || rawMinute < 0)) {
            slots.invalidTime = true;
          }
        }
      } catch (_) {
        // 忽略偵測異常，保持穩定
      }
      break;

    case 'query_schedule':
      slots.studentName = extractStudentName(message);
      slots.timeReference = parseTimeReference(message);
      slots.specificDate = parseSpecificDate(message);
      slots.courseName = extractCourseName(message);
      // 解析多位候選學生：多候選時不猜，由上層流程引導使用者確認
      try {
        const candidates = findAllStudentCandidates(message);
        if (candidates.length > 1) {
          slots.studentCandidates = candidates;
        }
      } catch (_) {}
      // 最小回退：若學生缺失，嘗試從語句直接抓取可能的人名（含「測試」前綴）
      if (!slots.studentName) {
        const m = message.match(/(測試?[A-Za-z一-龥]{1,12})(?=的|今天|明天|這週|本週|下週|這周|本周|下周|課表)/);
        if (m && m[1]) slots.studentName = stripTimeSuffixFromName(m[1]);
      }
      break;

    case 'stop_recurring_course':
      slots.studentName = extractStudentName(message);
      slots.courseName = extractCourseName(message);
      // 類型推斷：每天/每週
      const isDaily = /(每天|每日)/.test(message);
      const isWeekly = /(每週|每周|星期|週[一二三四五六日]|周[一二三四五六日])/.test(message);
      if (isDaily) {
        slots.recurrenceType = 'daily';
      } else if (isWeekly) {
        slots.recurrenceType = 'weekly';
      }
      // 最小回退：若學生缺失，嘗試從語句直接抓取可能的人名（含「測試」前綴）
      if (!slots.studentName) {
        const m2 = message.match(/(測試?[A-Za-z一-龥]{1,12})(?:的|每天|每週|每周|星期|週|周)/);
        if (m2 && m2[1]) slots.studentName = stripTimeSuffixFromName(m2[1]);
      }
      break;

    case 'set_reminder':
      slots.studentName = extractStudentName(message);
      slots.courseName = extractCourseName(message);
      slots.specificDate = parseSpecificDate(message);
      slots.timeReference = parseTimeReference(message);
      // 提取提醒時間（提前多久）
      let reminderTime = null;
      const minuteMatch = message.match(/(\d+)\s*分鐘/);
      const hourMatch = message.match(/(\d+)\s*小時/);
      if (minuteMatch) {
        reminderTime = parseInt(minuteMatch[1], 10);
      } else if (hourMatch) {
        reminderTime = parseInt(hourMatch[1], 10) * 60;
      }
      if (reminderTime !== null && !Number.isNaN(reminderTime)) {
        slots.reminderTime = reminderTime;
      }
      // 提取提醒內容
      const noteMatch = message.match(/記得(.+)/);
      if (noteMatch) {
        slots.reminderNote = noteMatch[1].trim();
      }
      break;

    case 'cancel_course':
      slots.studentName = extractStudentName(message);
      slots.courseName = extractCourseName(message);
      slots.specificDate = parseSpecificDate(message);
      slots.timeReference = parseTimeReference(message);
      // 判斷取消範圍（不預設 single，避免錯過重複課交互）
      // 第一性原則：若含具體日期詞且未提及「全部/重複」，預設單次取消
      const mentionsConcreteDay = /(今天|明天|昨天|後天|前天|\d{1,2}[\/\-]\d{1,2}|\d{4}[\/\-]\d{1,2}[\/\-]\d{1,2})/.test(message);
      const mentionsBulk = /(全部|所有|整個|重複|每週|每天|每月)/.test(message);
      if (mentionsConcreteDay && !mentionsBulk) {
        if (!slots.specificDate) {
          const today = new Date();
          const y = today.getFullYear();
          const m = String(today.getMonth() + 1).padStart(2, '0');
          const d = String(today.getDate()).padStart(2, '0');
          slots.specificDate = slots.timeReference ? parseSpecificDate(message) || `${y}-${m}-${d}` : `${y}-${m}-${d}`;
        }
        slots.scope = 'single';
      }
      if (message.includes('只取消今天') || message.includes('只刪除今天') || message.includes('只今天')) {
        slots.scope = 'single';
        // 若未提供日期，預設今天
        if (!slots.specificDate) {
          const today = new Date();
          const y = today.getFullYear();
          const m = String(today.getMonth() + 1).padStart(2, '0');
          const d = String(today.getDate()).padStart(2, '0');
          slots.specificDate = `${y}-${m}-${d}`;
        }
      } else if (message.includes('取消之後全部') || message.includes('取消明天起所有') || message.includes('明天起所有')) {
        slots.scope = 'future';
      } else if (message.includes('全部') || message.includes('所有') || message.includes('整個')) {
        slots.scope = 'all';
      } else if (message.includes('重複') || message.includes('每週') || message.includes('每天')) {
        slots.scope = 'recurring';
      }
      break;

    case 'record_content':
    case 'add_course_content':
      slots.studentName = extractStudentName(message);
      slots.courseName = extractCourseName(message);
      slots.timeReference = parseTimeReference(message);
      slots.courseDate = parseSpecificDate(message);
      // 提取課程內容
      const contentPatterns = [
        /學了(.+)/,
        /教了(.+)/,
        /內容[是:](.+)/,
        /記錄(.+)/,
        /表現(.+)/,
        /老師說.*表現(.+)/, // 老師說小光表現很好
        /老師說.*[很非常超](.+)/, // 老師說很好/非常棒/超厉害
        /老師說(.+)/,
      ];
      for (const pattern of contentPatterns) {
        const match = message.match(pattern);
        if (match) {
          slots.content = match[1].trim();
          break;
        }
      }
      break;

    case 'modify_course':
      slots.studentName = extractStudentName(message);
      slots.courseName = extractCourseName(message);
      slots.timeReference = parseTimeReference(message);
      slots.courseDate = parseSpecificDate(message);

      // 提取新值
      const newTimeMatch = message.match(/改[到成].*?([上中下午晚][午間]?\d{1,2}[:\：]\d{2}|[上中下午晚][午間]?\d{1,2}點(?:半|\d{1,2}分)?)/);
      if (newTimeMatch) {
        slots.scheduleTimeNew = parseScheduleTime(newTimeMatch[1]);
      }

      // 修復課程名稱提取 - 從"改"字之前提取
      const courseBeforeChangeMatch = message.match(/([^改]+課)改/);
      if (courseBeforeChangeMatch) {
        const fullMatch = courseBeforeChangeMatch[1];
        // 進一步提取純課程名稱
        const pureCourseName = fullMatch.match(/([一-龥A-Za-z]+課)$/);
        if (pureCourseName) {
          slots.courseName = pureCourseName[1];
        }
      }

      const newCourseMatch = message.match(/改[成為](.+?課)/);
      if (newCourseMatch) {
        slots.courseNameNew = newCourseMatch[1];
      }

      const newDateMatch = message.match(/改[到成].*?(明天|後天|今天|下週|下周|\d{1,2}[\/\-]\d{1,2})/);
      if (newDateMatch) {
        if (newDateMatch[1] === '明天') {
          slots.courseDateNew = parseSpecificDate('明天');
        } else if (newDateMatch[1] === '後天') {
          slots.courseDateNew = parseSpecificDate('後天');
        } else {
          slots.courseDateNew = parseSpecificDate(newDateMatch[1]);
        }
      }
      break;

    default:
      console.log('❓ 未知意圖，無法提取 slots:', intent);
  }

  return slots;
}

/**
 * 使用 AI 輔助提取複雜的 slots
 */
async function extractSlotsByAI(message, intent, existingSlots) {
  try {
    const openaiService = require('../services/openaiService');

    const prompt = `
你是專業的中文語法分析師。請嚴格按照語法結構分析句子，提取純淨實體。

句子："${message}"
意圖：${intent}
已提取欄位：${JSON.stringify(existingSlots, null, 2)}

分析步驟：
1. 語法分解：識別主語、謂語、賓語、修飾語
2. 實體邊界：確定實體的精確邊界，排除動作詞和修飾詞
3. 語義驗證：確保提取的實體符合邏輯

實體提取規則：
- 學生姓名：純人名（小明、Lumi、小華），不包含動作詞、修飾詞
- 課程名稱：純課程名，智能處理模糊語義
- 時間信息：具體時間或時間修飾詞
- 內容信息：學習或教學的具體內容
- 提醒時間：數字+時間單位（如1小時=60分鐘）

課程名稱特殊處理規則：
- 自動補全：「跆拳道」→「跆拳道課」、「數學」→「數學課」
- 模糊匹配：「取消課程」、「的課程」等通用指稱請保留原樣，讓下游處理
- 取消語句：「取消跆拳道」→課程="跆拳道課"、「刪掉小明的鋼琴」→學生="小明", 課程="鋼琴課"

❌ 錯誤示例（勿模仿）：
"取消跆拳道" → 課程="取消跆拳道" (包含動作詞)
"取消Lumi的課程" → 課程="取消Lumi的課程" (包含動作詞和人名)

✅ 正確示例：
"取消跆拳道" → 課程="跆拳道課"
"取消小明的跆拳道" → 學生="小明", 課程="跆拳道課" 
"取消Lumi的課程" → 學生="Lumi", 課程="課程"
"刪掉小華的鋼琴" → 學生="小華", 課程="鋼琴課"

如果無法確定某個實體，請設為 null。

回傳格式（僅JSON，無其他文字）：
{
  "studentName": "純人名或null",
  "courseName": "純課程名或null", 
  "scheduleTime": "時間或null",
  "timeReference": "時間參考或null",
  "content": "內容或null",
  "reminderTime": "提醒時間（分鐘數）或null",
  "reminderNote": "提醒備註或null",
  "courseDate": "課程日期或null",
  "recurring": "是否重複或null",
  "dayOfWeek": "星期幾或null",
  "courseNameNew": "新課程名或null",
  "courseDateNew": "新課程日期或null", 
  "scheduleTimeNew": "新時間或null"
}
`;

    const response = await openaiService.chatCompletion(prompt);
    const aiSlots = JSON.parse(response);

    // 合併 AI 提取的結果
    const mergedSlots = { ...existingSlots };
    for (const [key, value] of Object.entries(aiSlots)) {
      if (value && !mergedSlots[key]) {
        mergedSlots[key] = value;
      }
    }

    return mergedSlots;
  } catch (error) {
    console.error('❌ AI slots 提取失敗:', error);
    return existingSlots;
  }
}

/**
 * 驗證並清理提取結果
 */
function validateExtractionResult(result, originalMessage, intent) {
  const issues = [];
  const cleaned = { ...result };

  // 驗證學生姓名
  if (cleaned.studentName) {
    if (hasActionWords(cleaned.studentName)) {
      issues.push(`學生姓名包含動作詞: ${cleaned.studentName}`);
      cleaned.studentName = cleanStudentName(cleaned.studentName);
    }
  }

  // 驗證課程名稱
  if (cleaned.courseName) {
    if (hasActionWords(cleaned.courseName)) {
      issues.push(`課程名稱包含動作詞: ${cleaned.courseName}`);

      // 如果學生姓名為空，嘗試從課程名稱中提取
      if (!cleaned.studentName) {
        const extractedStudent = extractStudentFromCourseName(cleaned.courseName);
        if (extractedStudent) {
          cleaned.studentName = extractedStudent;
          issues.push(`從課程名稱中提取學生姓名: ${extractedStudent}`);
        }
      }

      cleaned.courseName = cleanCourseName(cleaned.courseName);
    }
  }

  // 驗證邏輯一致性
  if (intent === 'record_content' && !cleaned.content) {
    issues.push('記錄內容意圖但未提取到內容');
  }

  // 補強：若課程名稱是問句殘片（如「課什麼時候上」「每天幾點」），視為無效
  if (cleaned.courseName && /(什麼時候|幾點|如何|怎麼樣)/.test(cleaned.courseName)) {
    issues.push(`移除無效課程名稱（問句殘片）: ${cleaned.courseName}`);
    delete cleaned.courseName;
  }

  if (issues.length > 0) {
    console.log('🔧 自動修正提取結果:', issues);
  }

  return { result: cleaned, issues };
}

function stripTimeSuffixFromName(name) {
  if (!name) return name;
  const stripped = name
    .replace(/(今天|明天|昨天|這週|本週|下週|這周|本周|下周)$/, '')
    .replace(/(每週[一二三四五六日]?|每周[一二三四五六日]?|星期[一二三四五六日]|週[一二三四五六日]|周[一二三四五六日]|每天)$/, '');
  return stripped.trim();
}

function hasActionWords(text) {
  const actionWords = ['設定', '不要', '取消', '刪掉', '幫我', '請', '要', '安排', '查詢', '記錄', '提醒', '提醒我', '醒我', '改', '改到', '改成', '修改', '調整', '更改'];
  return actionWords.some((word) => text.includes(word));
}

function cleanStudentName(rawName) {
  // 移除常見的動作詞前綴
  const cleaned = rawName
    .replace(/^(設定|不要|取消|刪掉|幫我|請|查詢|記錄|提醒|提醒我|醒我|改|改到|改成|修改|調整|更改)/, '')
    .replace(/(的|之)$/, '');
  return cleaned.trim();
}

function extractStudentFromCourseName(rawCourse) {
  // 移除動作詞後，嘗試提取學生姓名
  const cleaned = rawCourse.replace(/^(設定|不要|取消|刪掉|查詢|記錄)/, '');

  // 匹配 "學生姓名+課程名稱" 格式
  const nameMatch = cleaned.match(/^([小大]?[一-龥A-Za-z]{2,6})([一-龥A-Za-z]{2,6}課)$/);
  if (nameMatch && nameMatch[1]) {
    return nameMatch[1];
  }

  return null;
}

function cleanCourseName(rawCourse) {
  // 移除動作詞，保留純課程名
  const cleaned = rawCourse
    .replace(/^(設定|不要|取消|刪掉|查詢|記錄)/, '');

  // 如果包含人名+課程的格式，提取課程部分
  const courseMatch = cleaned.match(/([小大]?[一-龥A-Za-z]{2,6})([一-龥A-Za-z]{2,6}課)$/);
  if (courseMatch && courseMatch[2]) {
    return courseMatch[2]; // 返回課程部分，如 "鋼琴課"
  }

  // 如果是 "XXX課" 格式，直接返回
  const directCourseMatch = cleaned.match(/([一-龥A-Za-z]{2,6}課)$/);
  if (directCourseMatch) {
    return directCourseMatch[1];
  }

  return cleaned.trim();
}

/**
 * 計算提取結果的置信度
 */
function calculateConfidence(slots, intent) {
  let confidence = 0;
  let totalFields = 0;

  // 定義每個意圖的期望欄位
  const expectedFields = {
    add_course: ['studentName', 'courseName'],
    create_recurring_course: ['studentName', 'courseName', 'dayOfWeek'],
    record_content: ['studentName', 'courseName', 'content'],
    add_course_content: ['studentName', 'courseName', 'content'],
    query_schedule: ['studentName', 'timeReference'],
    set_reminder: ['studentName', 'courseName', 'reminderTime'],
    cancel_course: ['studentName', 'courseName'],
    modify_course: ['studentName', 'courseName', 'courseNameNew', 'courseDateNew', 'scheduleTimeNew'],
  };

  const expected = expectedFields[intent] || [];
  if (expected.length === 0) {
    return 1.0; // 如果沒有期望欄位，返回高置信度
  }

  // 計算填充率
  expected.forEach((field) => {
    totalFields++;
    if (slots[field] && slots[field] !== null && slots[field] !== '') {
      confidence++;
    }
  });

  const fillRate = totalFields > 0 ? confidence / totalFields : 0;
  
  // 如果填充率低於 50%，降低置信度以觸發 AI fallback
  if (fillRate < 0.5) {
    return 0.3; // 確保觸發 AI 輔助
  }

  // 額外的品質檢查
  let qualityScore = 1.0;

  // 檢查學生姓名品質
  if (slots.studentName) {
    if (slots.studentName.length < 2 || slots.studentName.length > 6) {
      qualityScore -= 0.2;
    }
    if (/\d/.test(slots.studentName)) {
      qualityScore -= 0.3; // 姓名不應包含數字
    }
  }

  // 檢查課程名稱品質 - 對於模糊語義降低置信度
  if (slots.courseName) {
    if (slots.courseName.length < 2) {
      qualityScore -= 0.2;
    }
    if (hasActionWords(slots.courseName)) {
      qualityScore -= 0.4; // 課程名稱不應包含動作詞
    }
    // 針對取消課程意圖，如果缺少關鍵槽位，降低置信度讓 AI 處理
    if (intent === 'cancel_course' && (!slots.studentName || !slots.courseName)) {
      qualityScore -= 0.6;
    }
  }

  return Math.max(0, fillRate * qualityScore);
}

/**
 * 主要 slots 提取函式（支援上下文感知）
 */
async function extractSlots(message, intent, userId = null) {
  if (!message || !intent) {
    return {};
  }

  console.log('🔍 開始提取 slots - 意圖:', intent, userId ? `(用戶: ${userId})` : '');

  // 第一階段：規則提取
  let slots = await extractSlotsByIntent(message, intent);

  if (process.env.DEBUG_SLOT_EXTRACTION === 'true') {
    console.log('🔧 規則提取結果:', slots);
  }

  // 第二階段：上下文感知增強（如果提供用戶 ID）
  if (userId) {
    slots = await enhanceSlotsWithContext(slots, message, intent, userId);
  }

  // 第三階段：置信度評估和 AI 輔助提取
  if (process.env.ENABLE_AI_FALLBACK === 'true') {
    const confidence = calculateConfidence(slots, intent);
    console.log('📊 規則提取置信度:', confidence.toFixed(2));

    // 如果規則提取信心度低，使用 AI 增強（不是替換）
    if (confidence < 0.5) {
      console.log('🔄 規則提取信心度低，AI 輔助增強...');
      slots = await extractSlotsByAI(message, intent, slots);
    } else {
      // 信心度中等，檢查是否有缺失欄位
      const hasEmptySlots = Object.values(slots).some((value) => !value);
      if (hasEmptySlots) {
        console.log('🤖 啟用 AI 輔助提取...');
        slots = await extractSlotsByAI(message, intent, slots);
      }
    }
  }

  // 第三階段：結果驗證與清理（無論是否啟用 AI Fallback 都執行清洗）
  const validation = validateExtractionResult(slots, message, intent);
  slots = validation.result;
  if (process.env.ENABLE_AI_FALLBACK === 'true') {
    // 記錄低置信度案例用於持續優化
    const finalConfidence = calculateConfidence(slots, intent);
    if (finalConfidence < 0.7) {
      try {
        const errorCollectionService = require('../services/errorCollectionService');
        await errorCollectionService.recordLowConfidenceCase(message, intent, slots, finalConfidence, userId);
      } catch (error) {
        console.warn('⚠️ 記錄低置信度案例失敗:', error.message);
      }
    }
  }

  // 第四階段：資料清理和驗證
  const cleanedSlots = {};
  for (const [key, value] of Object.entries(slots)) {
    // 正規化字串 'null' 為真正的空值
    const normalized = (typeof value === 'string' && value.trim().toLowerCase() === 'null')
      ? null
      : value;
    if (normalized !== null && normalized !== undefined && normalized !== '') {
      cleanedSlots[key] = normalized;
    }
  }

  // 嚴格驗證日期欄位：避免將「每月1號」等自然語帶入下游服務
  if (cleanedSlots.courseDate && !/^\d{4}-\d{2}-\d{2}$/.test(cleanedSlots.courseDate)) {
    console.log(`⚠️ 移除無效的 courseDate: ${cleanedSlots.courseDate}`);
    delete cleanedSlots.courseDate;
  }

  console.log('✅ 最終 slots:', cleanedSlots);
  return cleanedSlots;
}

module.exports = {
  extractSlots,
  extractSlotsByIntent,
  extractSlotsByAI,
  // 驗證函式
  validateExtractionResult,
  hasActionWords,
  cleanStudentName,
  cleanCourseName,
  extractStudentFromCourseName,
  // 置信度評估
  calculateConfidence,
  // 輔助函式也匯出供測試使用
  parseTimeReference,
  parseSpecificDate,
  parseScheduleTime,
  parseDayOfWeek,
  parseDaysOfWeekMulti,
  parseMonthDay,
  identifyRecurrenceType,
  parseMonthDay,
  extractStudentName,
  extractCourseName,
  enhanceSlotsWithContext,
  findAllStudentCandidates,
  // 重複功能開關檢查
  isRecurringEnabled,
};

/**
 * 使用上下文資訊增強 slots 提取
 * @param {object} slots - 初步提取的 slots
 * @param {string} message - 用戶訊息
 * @param {string} intent - 意圖
 * @param {string} userId - 用戶 ID
 * @returns {Promise<object>} 增強後的 slots
 */
async function enhanceSlotsWithContext(slots, message, intent, userId) {
  try {
    const { getConversationManager } = require('../conversation/ConversationManager');
    const conversationManager = getConversationManager();

    // 檢查 Redis 可用性
    const healthCheck = await conversationManager.healthCheck();
    if (healthCheck.status !== 'healthy') {
      console.log('⚠️ 對話管理器不可用，跳過上下文增強');
      return slots;
    }

    // 取得對話上下文
    const context = await conversationManager.getContext(userId);
    if (!context) {
      console.log('⚠️ 無對話上下文，跳過上下文增強');
      return slots;
    }

    // 查詢會話鎖：若存在有效查詢會話，固定學生/時間，不跨學生自動補
    try {
      if (intent === 'query_schedule') {
        const session = await conversationManager.getActiveQuerySession(userId);
        const ttl = conversationManager.getQuerySessionTtlMs(userId);
        if (session && ttl > 0) {
          const pinned = { ...slots };
          if (!pinned.studentName && session.studentName) pinned.studentName = session.studentName;
          if (!pinned.timeReference && session.timeReference) pinned.timeReference = session.timeReference;
          console.log('🔒 套用查詢會話鎖:', pinned);
          return pinned;
        }
      }
      
      // 取消操作：若缺學生，嘗試沿用查詢鎖的學生（不改課名補值策略）
      if (intent === 'cancel_course' && !slots.studentName) {
        const session = await conversationManager.getActiveQuerySession(userId).catch(() => null);
        if (session?.studentName) {
          console.log(`📎 取消操作沿用查詢會話學生: ${session.studentName}`);
          slots = { ...slots, studentName: session.studentName };
        }
      }
    } catch (e) {
      console.warn('⚠️ 查詢會話鎖應用失敗:', e?.message || e);
    }

    // 缺關鍵槽位時，避免用上下文自動補全，先走澄清流程
    const disableAutoFill = process.env.DISABLE_CONTEXT_AUTO_FILL === 'true';
    const isCriticalIntent = ['add_course', 'create_recurring_course', 'set_reminder', 'cancel_course', 'record_content', 'add_course_content', 'query_course_content'].includes(intent);
    const missingCritical = (!slots.studentName || !slots.courseName) && isCriticalIntent;
    
    // 特殊情況：Quick Reply 的取消操作應該允許上下文推導
    const isQuickReplyCancel = intent === 'cancel_course' && !slots.studentName && (
      message.includes('刪除整個重複') || 
      message.includes('取消之後全部') || 
      message.includes('只取消今天')
    );
    
    if ((disableAutoFill || missingCritical) && !isQuickReplyCancel) {
      return slots;
    }

    console.log('🧠 使用對話上下文增強 slots 提取');

    // 從上下文中補充缺失的實體
    const enhancedSlots = { ...slots };

    // 補充學生名稱
    if (!enhancedSlots.studentName && context.state.mentionedEntities.students.length > 0) {
      // 使用最近提及的學生
      enhancedSlots.studentName = context.state.mentionedEntities.students[context.state.mentionedEntities.students.length - 1];
      console.log('📝 從上下文補充學生名稱:', enhancedSlots.studentName);
    }

    // 補充課程名稱（讀取型查詢不自動補，避免縮小結果集造成誤判）
    if (!enhancedSlots.courseName && context.state.mentionedEntities.courses.length > 0) {
      const isReadOnlyQuery = intent === 'query_schedule' || intent === 'query_course_content';
      if (!isReadOnlyQuery) {
        // 使用最近提及的課程
        enhancedSlots.courseName = context.state.mentionedEntities.courses[context.state.mentionedEntities.courses.length - 1];
        console.log('📝 從上下文補充課程名稱:', enhancedSlots.courseName);
      }
    }

    // 補充時間資訊
    if (!enhancedSlots.scheduleTime && context.state.mentionedEntities.times.length > 0) {
      enhancedSlots.scheduleTime = context.state.mentionedEntities.times[context.state.mentionedEntities.times.length - 1];
      console.log('📝 從上下文補充時間:', enhancedSlots.scheduleTime);
    }

    // 補充日期資訊
    if (!enhancedSlots.courseDate && context.state.mentionedEntities.dates.length > 0) {
      enhancedSlots.courseDate = context.state.mentionedEntities.dates[context.state.mentionedEntities.dates.length - 1];
      console.log('📝 從上下文補充日期:', enhancedSlots.courseDate);
    }

    // 處理操作性意圖的特殊情況
    if (['confirm_action', 'modify_action', 'cancel_action'].includes(intent)) {
      // 從最近的操作中繼承所有必要資料
      const lastAction = await conversationManager.getLastAction(userId);
      if (lastAction && lastAction.slots) {
        Object.keys(lastAction.slots).forEach((key) => {
          if (lastAction.slots[key] && !enhancedSlots[key]) {
            enhancedSlots[key] = lastAction.slots[key];
            console.log(`📝 從最近操作繼承 ${key}:`, enhancedSlots[key]);
          }
        });
      }
    }

    // 處理修改意圖的特殊邏輯
    if (intent === 'modify_action') {
      // 識別用戶想要修改的具體欄位
      enhancedSlots.modificationTarget = identifyModificationTarget(message);
      console.log('📝 識別修改目標:', enhancedSlots.modificationTarget);
    }

    return enhancedSlots;
  } catch (error) {
    console.error('❌ 上下文增強失敗:', error);
    return slots; // 失敗時回傳原始 slots
  }
}

/**
 * 識別用戶想要修改的目標欄位
 * @param {string} message - 用戶訊息
 * @returns {string|null} 修改目標
 */
function identifyModificationTarget(message) {
  const targets = {
    時間: ['時間', '點', '點半', '小時', '分鐘'],
    日期: ['日期', '天', '今天', '明天', '昨天'],
    課程: ['課程', '課', '科目'],
    學生: ['學生', '小朋友', '孩子'],
    內容: ['內容', '記錄', '說明'],
    提醒: ['提醒', '通知'],
  };

  for (const [target, keywords] of Object.entries(targets)) {
    if (keywords.some((keyword) => message.includes(keyword))) {
      return target;
    }
  }

  return null;
}
