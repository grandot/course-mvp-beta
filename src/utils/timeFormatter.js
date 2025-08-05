/**
 * 時間格式轉換工具模組
 * 統一處理中文時間與 24 小時制之間的轉換
 */

/**
 * 將中文時間表達轉換為 24 小時制格式
 * @param {string} inputText - 中文時間表達 (如 "下午2:00", "晚上8點", "上午10點半")
 * @returns {string} 24小時制時間 (如 "14:00", "20:00", "10:30")
 */
function to24HourFormat(inputText) {
  if (!inputText) return null;

  // 移除空白字符
  const timeStr = inputText.trim();

  // 正則表達式匹配各種中文時間格式
  const patterns = [
    // 下午2:00, 上午10:30
    /^(上午|下午|早上|晚上|中午)(\d{1,2}):(\d{2})$/,
    // 下午2點, 晚上8點
    /^(上午|下午|早上|晚上|中午)(\d{1,2})點$/,
    // 下午2點半, 上午10點半
    /^(上午|下午|早上|晚上|中午)(\d{1,2})點半$/,
    // 14:00 (已經是24小時制)
    /^(\d{1,2}):(\d{2})$/,
  ];

  // 時段對應表
  const periodMap = {
    上午: 'AM',
    早上: 'AM',
    中午: 'PM', // 中午按下午處理
    下午: 'PM',
    晚上: 'PM',
  };

  for (const pattern of patterns) {
    const match = timeStr.match(pattern);
    if (match) {
      // 如果已經是24小時制格式
      if (pattern.source.includes('^(\\d{1,2}):(\\d{2})$')) {
        const hour = parseInt(match[1]);
        const minute = match[2];
        if (hour >= 0 && hour <= 23) {
          return `${hour.toString().padStart(2, '0')}:${minute}`;
        }
        continue;
      }

      const period = match[1];
      let hour = parseInt(match[2]);
      let minute = match[3] || '00';

      // 處理"點半"的情況
      if (timeStr.includes('點半')) {
        minute = '30';
      }

      // 轉換為24小時制
      if (periodMap[period] === 'PM' && hour !== 12) {
        hour += 12;
      } else if (periodMap[period] === 'AM' && hour === 12) {
        hour = 0;
      }

      // 特殊處理：中午12點保持12，不變成24
      if (period === '中午' && hour === 12) {
        hour = 12;
      }

      // 驗證時間合理性
      if (hour >= 0 && hour <= 23 && parseInt(minute) >= 0 && parseInt(minute) <= 59) {
        return `${hour.toString().padStart(2, '0')}:${minute.padStart(2, '0')}`;
      }
    }
  }

  // 如果都不匹配，返回 null
  console.warn(`無法解析時間格式: ${inputText}`);
  return null;
}

/**
 * 將 24 小時制時間轉換為中文顯示格式
 * @param {string} timeStr - 24小時制時間 (如 "14:00", "20:00", "10:30")
 * @returns {string} 中文時間格式 (如 "下午2:00", "晚上8:00", "上午10:30")
 */
function toDisplayFormat(timeStr) {
  if (!timeStr) return '';

  const match = timeStr.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) {
    console.warn(`無效的時間格式: ${timeStr}`);
    return timeStr;
  }

  const hour = parseInt(match[1]);
  const minute = match[2];

  let period = '';
  let displayHour = hour;

  if (hour === 0) {
    period = '午夜';
    displayHour = 12;
  } else if (hour < 6) {
    period = '凌晨';
  } else if (hour < 12) {
    period = '上午';
  } else if (hour === 12) {
    period = '中午';
  } else if (hour < 18) {
    period = '下午';
    displayHour = hour - 12;
  } else {
    period = '晚上';
    displayHour = hour - 12;
  }

  // 特殊處理分鐘顯示
  if (minute === '00') {
    return `${period}${displayHour}:00`;
  } if (minute === '30') {
    return `${period}${displayHour}:30`;
  }
  return `${period}${displayHour}:${minute}`;
}

/**
 * 組合日期和時間為完整的 DateTime 對象
 * @param {string} date - 日期 (如 "2025-01-15")
 * @param {string} time - 時間 (如 "14:00")
 * @returns {Date} JavaScript Date 對象
 */
function buildDateTime(date, time) {
  if (!date || !time) {
    throw new Error('日期和時間都是必填參數');
  }

  // 驗證日期格式 YYYY-MM-DD
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new Error(`無效的日期格式: ${date}，應為 YYYY-MM-DD`);
  }

  // 驗證時間格式 HH:MM
  if (!/^\d{1,2}:\d{2}$/.test(time)) {
    throw new Error(`無效的時間格式: ${time}，應為 HH:MM`);
  }

  return new Date(`${date}T${time}:00+08:00`);
}

/**
 * 在指定時間基礎上增加一小時
 * @param {string} timeStr - 時間字符串 (如 "14:00")
 * @returns {string} 增加一小時後的時間 (如 "15:00")
 */
function addOneHour(timeStr) {
  if (!timeStr) return null;

  const match = timeStr.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) {
    console.warn(`無效的時間格式: ${timeStr}`);
    return timeStr;
  }

  const hour = parseInt(match[1]);
  const minute = match[2];

  const newHour = (hour + 1) % 24;
  return `${newHour.toString().padStart(2, '0')}:${minute}`;
}

/**
 * 獲取昨天的日期
 * @returns {string} 昨天的日期 (YYYY-MM-DD 格式)
 */
function getYesterday() {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  return yesterday.toISOString().split('T')[0];
}

/**
 * 獲取今天的日期
 * @returns {string} 今天的日期 (YYYY-MM-DD 格式)
 */
function getToday() {
  const today = new Date();
  return today.toISOString().split('T')[0];
}

/**
 * 獲取明天的日期
 * @returns {string} 明天的日期 (YYYY-MM-DD 格式)
 */
function getTomorrow() {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  return tomorrow.toISOString().split('T')[0];
}

/**
 * 將星期幾的中文轉換為數字 (0=週日, 1=週一, ...)
 * @param {string} dayStr - 中文星期 (如 "週三", "星期五")
 * @returns {number} 星期數字 (0-6)
 */
function dayStringToNumber(dayStr) {
  const dayMap = {
    週日: 0,
    星期日: 0,
    星期天: 0,
    週一: 1,
    星期一: 1,
    週二: 2,
    星期二: 2,
    週三: 3,
    星期三: 3,
    週四: 4,
    星期四: 4,
    週五: 5,
    星期五: 5,
    週六: 6,
    星期六: 6,
  };

  return dayMap[dayStr] !== undefined ? dayMap[dayStr] : null;
}

module.exports = {
  to24HourFormat,
  toDisplayFormat,
  buildDateTime,
  addOneHour,
  getYesterday,
  getToday,
  getTomorrow,
  dayStringToNumber,
};
