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
    const match = message.match(pattern);
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

function checkRecurring(message) {
  const recurringKeywords = ['每週', '每周', '每天', '每日', '每月', '重複', '定期', '固定', '循環', '週期性'];

  // 明確的重複關鍵詞
  if (recurringKeywords.some((keyword) => message.includes(keyword))) {
    return true;
  }

  // 如果包含星期詞彙且沒有明確的非重複指示，視為重複課程
  const dayKeywords = ['星期一', '星期二', '星期三', '星期四', '星期五', '星期六', '星期日',
    '週一', '週二', '週三', '週四', '週五', '週六', '週日',
    '周一', '周二', '周三', '周四', '周五', '周六', '周日'];

  const hasDayKeyword = dayKeywords.some((day) => message.includes(day));

  // 明確的非重複指示詞
  const nonRecurringKeywords = ['這次', '今天', '明天', '昨天', '下週一次', '單次', '一次性', '臨時'];
  const hasNonRecurringKeyword = nonRecurringKeywords.some((keyword) => message.includes(keyword));

  // 如果包含星期但沒有非重複指示，視為重複課程
  return hasDayKeyword && !hasNonRecurringKeyword;
}

/**
 * 提取學生姓名
 */
function extractStudentName(message) {
  // 常見的學生姓名模式 - 按精確度排序
  const namePatterns = [
    // 最高精確度模式 - 明確的姓名結構（調整順序，優先精確匹配）
    /(?:新增|幫.*?新增)\s*([小大]?[一-龥A-Za-z]{2,6})的/, // 新增小明的、幫我新增小明的
    /(?:安排)\s*([小大]?[一-龥A-Za-z]{2,6})每週/, // 安排小華每週
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
    /提醒.*我.*?([小大]?[一-龥]{2,3})(?=明天)/, // 提醒我小明明天的
    /提醒.*我.*?([小大]?[一-龥A-Za-z]{2,3})的/, // 提醒我小明的

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
      const name = match[1].trim();

      // 嚴格過濾不是姓名的詞彙
      const invalidNames = [
        '今天', '明天', '昨天', '每週', '查詢', '提醒', '取消', '看一下', '記錄',
        '老師說', '這週', '下週', '上週', '安排', '刪掉', '表現', '很好', '內容',
        '一下', '表現很', '提醒我', '明天的', '今天的', '昨天的',
      ];

      // 檢查是否包含無效詞彙
      const containsInvalid = invalidNames.some((invalid) => name.includes(invalid) || name === invalid);

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
 * 提取課程名稱
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
    /的([一-龥]{2,6})課/, // 的數學課 - 需要在通用課程模式之前
    /([一-龥]{2,6})課(?![學了])/, // 數學課 (但不是 "數學課學了")

    // 高精確度模式 - 特定結構
    /([一-龥A-Za-z]{2,6})教學/, // XX教學
    /([一-龥A-Za-z]{2,6})訓練/, // XX訓練
    /([一-龥A-Za-z]{2,6})班/, // XX班

    // 中精確度模式 - 時間+課程
    /[點時]([一-龥A-Za-z]{2,6})課/, // 3點數學課
  ];

  for (const pattern of coursePatterns) {
    const match = message.match(pattern);
    if (match && match[1]) {
      let courseName = match[1];

      // 過濾掉明顯不是課程名稱的結果
      const invalidCourseNames = [
        '今天', '明天', '昨天', '每天', '這週', '下週', '上週',
        '小明', '小光', '小美', 'Lumi', '老師', '學生',
        '查詢', '提醒', '取消', '記錄', '看一下', '安排', '刪掉',
        '內容', '表現', '很好', '分數', '點的', '期五', '我',
        '學了', '課學', '天學', '點天', '星期', '課前',
      ];

      // 檢查是否包含無效詞彙或字符
      const containsInvalid = invalidCourseNames.some((invalid) => courseName.includes(invalid));

      if (!containsInvalid
          && courseName.length >= 2 && courseName.length <= 6
          && !/[0-9]/.test(courseName) // 不包含數字
          && !courseName.includes('點') // 避免時間詞彙
          && !courseName.includes('天')) { // 避免時間詞彙
        // 如果不包含"課"字且不是以"教學/訓練/班"結尾，自動加上"課"
        if (!courseName.includes('課')
            && !courseName.endsWith('教學')
            && !courseName.endsWith('訓練')
            && !courseName.endsWith('班')) {
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
    case 'add_course':
    case 'create_recurring_course':
      slots.studentName = extractStudentName(message);
      slots.courseName = extractCourseName(message);
      slots.scheduleTime = parseScheduleTime(message);
      slots.courseDate = parseSpecificDate(message);
      slots.dayOfWeek = parseDayOfWeek(message);
      slots.recurring = checkRecurring(message);
      slots.timeReference = parseTimeReference(message);
      break;

    case 'query_schedule':
      slots.studentName = extractStudentName(message);
      slots.timeReference = parseTimeReference(message);
      slots.specificDate = parseSpecificDate(message);
      slots.courseName = extractCourseName(message);
      break;

    case 'set_reminder':
      slots.studentName = extractStudentName(message);
      slots.courseName = extractCourseName(message);
      slots.specificDate = parseSpecificDate(message);
      slots.timeReference = parseTimeReference(message);
      // 提取提醒時間（提前多久）
      const reminderMatch = message.match(/(\d+)\s*分鐘/);
      if (reminderMatch) {
        slots.reminderTime = parseInt(reminderMatch[1]);
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
      // 判斷取消範圍
      if (message.includes('全部') || message.includes('所有') || message.includes('整個')) {
        slots.scope = 'all';
      } else if (message.includes('重複') || message.includes('每週')) {
        slots.scope = 'recurring';
      } else {
        slots.scope = 'single';
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
- 課程名稱：純課程名（數學課、英文課），不包含動作詞、時間詞
- 時間信息：具體時間或時間修飾詞
- 內容信息：學習或教學的具體內容
- 提醒時間：數字+時間單位（如1小時=60分鐘）

❌ 錯誤示例（勿模仿）：
"設定小華鋼琴課提醒" → 課程="設定小華鋼琴課" (包含動作詞)
"不要Lumi的游泳課" → 學生="不要Lumi" (包含否定詞)
"小明數學課學了圓周率" → 課程="數學課學了" (包含動作詞)

✅ 正確示例：
"設定小華鋼琴課提醒" → 學生="小華", 課程="鋼琴課"
"不要Lumi的游泳課了" → 學生="Lumi", 課程="游泳課"
"小明數學課今天教了圓周率" → 學生="小明", 課程="數學課", 內容="圓周率"
"設定小華鋼琴課提前1小時提醒" → 學生="小華", 課程="鋼琴課", 提醒時間=60

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
  "dayOfWeek": "星期幾或null"
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
  
  if (issues.length > 0) {
    console.log('🔧 自動修正提取結果:', issues);
  }
  
  return { result: cleaned, issues };
}

function hasActionWords(text) {
  const actionWords = ['設定', '不要', '取消', '刪掉', '幫我', '請', '要', '安排', '查詢', '記錄'];
  return actionWords.some(word => text.includes(word));
}

function cleanStudentName(rawName) {
  // 移除常見的動作詞前綴
  const cleaned = rawName
    .replace(/^(設定|不要|取消|刪掉|幫我|請|查詢|記錄)/, '')
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
  let cleaned = rawCourse
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
    'add_course': ['studentName', 'courseName'],
    'create_recurring_course': ['studentName', 'courseName', 'dayOfWeek'],
    'record_content': ['studentName', 'courseName', 'content'],
    'add_course_content': ['studentName', 'courseName', 'content'],
    'query_schedule': ['studentName', 'timeReference'],
    'set_reminder': ['studentName', 'courseName', 'reminderTime'],
    'cancel_course': ['studentName', 'courseName'],
    'modify_course': ['studentName', 'courseName']
  };
  
  const expected = expectedFields[intent] || [];
  if (expected.length === 0) {
    return 1.0; // 如果沒有期望欄位，返回高置信度
  }
  
  // 計算填充率
  expected.forEach(field => {
    totalFields++;
    if (slots[field] && slots[field] !== null && slots[field] !== '') {
      confidence++;
    }
  });
  
  const fillRate = totalFields > 0 ? confidence / totalFields : 0;
  
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
  
  // 檢查課程名稱品質
  if (slots.courseName) {
    if (slots.courseName.length < 2) {
      qualityScore -= 0.2;
    }
    if (hasActionWords(slots.courseName)) {
      qualityScore -= 0.4; // 課程名稱不應包含動作詞
    }
  }
  
  return Math.max(0, fillRate * qualityScore);
}

/**
 * 主要 slots 提取函式
 */
async function extractSlots(message, intent, userId = null) {
  if (!message || !intent) {
    return {};
  }

  console.log('🔍 開始提取 slots - 意圖:', intent);

  // 第一階段：規則提取
  let slots = await extractSlotsByIntent(message, intent);

  if (process.env.DEBUG_SLOT_EXTRACTION === 'true') {
    console.log('🔧 規則提取結果:', slots);
  }

  // 第二階段：置信度評估和 AI 輔助提取
  if (process.env.ENABLE_AI_FALLBACK === 'true') {
    const confidence = calculateConfidence(slots, intent);
    console.log('📊 規則提取置信度:', confidence.toFixed(2));
    
    // 如果規則提取信心度低，強制使用 AI
    if (confidence < 0.5) {
      console.log('🔄 規則提取信心度低，強制 AI 輔助...');
      slots = await extractSlotsByAI(message, intent, {});
    } else {
      // 信心度中等，檢查是否有缺失欄位
      const hasEmptySlots = Object.values(slots).some((value) => !value);
      if (hasEmptySlots) {
        console.log('🤖 啟用 AI 輔助提取...');
        slots = await extractSlotsByAI(message, intent, slots);
      }
    }
  }

  // 第三階段：結果驗證與清理
  if (process.env.ENABLE_AI_FALLBACK === 'true') {
    const validation = validateExtractionResult(slots, message, intent);
    slots = validation.result;
    
    // 記錄低置信度案例用於持續優化
    const finalConfidence = calculateConfidence(slots, intent);
    if (finalConfidence < 0.7) {
      try {
        const errorCollectionService = require('../services/errorCollectionService');
        await errorCollectionService.recordLowConfidenceCase(
          message, intent, slots, finalConfidence, userId
        );
      } catch (error) {
        console.warn('⚠️ 記錄低置信度案例失敗:', error.message);
      }
    }
  }

  // 第四階段：資料清理和驗證
  const cleanedSlots = {};
  for (const [key, value] of Object.entries(slots)) {
    if (value !== null && value !== undefined && value !== '') {
      cleanedSlots[key] = value;
    }
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
  extractStudentName,
  extractCourseName,
};
