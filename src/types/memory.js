/**
 * 三層語意記憶系統 - Memory.yaml 數據結構定義
 * 基於 First Principles 設計，用於處理用戶自然語言的省略、依賴、接續特性
 */

/**
 * 用戶記憶主結構 - 每個用戶獨立的 YAML 檔案
 * @typedef {Object} UserMemory
 * @property {string} userId - 用戶唯一識別ID
 * @property {Object<string, StudentInfo>} students - 學生資訊對象，key為學生姓名
 * @property {RecentActivity[]} recentActivities - 最近活動記錄 (最多20筆)
 * @property {RecurringPattern[]} recurringPatterns - 重複模式識別
 * @property {string} lastUpdated - ISO格式最後更新時間
 */

/**
 * 學生相關資訊
 * @typedef {Object} StudentInfo
 * @property {CourseRecord[]} courses - 該學生的課程記錄
 * @property {StudentPreferences} preferences - 學生偏好設定
 */

/**
 * 課程記錄 - Memory.yaml 核心數據結構
 * @typedef {Object} CourseRecord
 * @property {string} courseName - 課程名稱 (必填)
 * @property {ScheduleInfo} schedule - 課程時間安排
 * @property {string} [teacher] - 授課老師
 * @property {string} [location] - 上課地點
 * @property {string} [notes] - 課程備註
 * @property {number} frequency - 提到次數，用於重要性排序 (預設1)
 * @property {string} [lastMentioned] - 最後提及時間 (ISO格式)
 */

/**
 * 課程時間安排資訊
 * @typedef {Object} ScheduleInfo
 * @property {string} [date] - 具體日期 YYYY-MM-DD
 * @property {string} [time] - 時間 HH:MM 格式
 * @property {'weekly'|'monthly'|'once'} [recurring] - 重複類型
 * @property {number} [dayOfWeek] - 週幾 (0=週日, 1=週一, ..., 6=週六)
 * @property {string} [description] - 時間描述 (如: "每週三下午")
 */

/**
 * 學生偏好設定
 * @typedef {Object} StudentPreferences
 * @property {string[]} frequentCourses - 高頻課程列表
 * @property {string} [preferredTimeFormat] - 偏好時間格式 (12h/24h)
 * @property {Object} [defaultSettings] - 其他預設設定
 */

/**
 * 最近活動記錄
 * @typedef {Object} RecentActivity
 * @property {string} activityId - 活動唯一ID
 * @property {'create'|'modify'|'cancel'|'query'} activityType - 活動類型
 * @property {string} studentName - 相關學生
 * @property {string} courseName - 相關課程
 * @property {string} timestamp - 活動時間戳
 * @property {Object} [metadata] - 額外元數據
 */

/**
 * 重複模式識別
 * @typedef {Object} RecurringPattern
 * @property {string} patternId - 模式唯一ID
 * @property {string} studentName - 學生姓名
 * @property {string} courseName - 課程名稱
 * @property {'weekly'|'monthly'} patternType - 模式類型
 * @property {Object} schedule - 重複時間規律
 * @property {number} confidence - 模式置信度 (0-1)
 * @property {string} createdAt - 模式建立時間
 */

/**
 * Memory.yaml 操作結果
 * @typedef {Object} MemoryOperationResult
 * @property {boolean} success - 操作是否成功
 * @property {string} [error] - 錯誤訊息
 * @property {Object} [data] - 返回數據
 * @property {number} recordCount - 當前記錄數量
 */

/**
 * GPT Fallback 記憶摘要格式
 * @typedef {Object} MemorySummary
 * @property {string} userId - 用戶ID
 * @property {Object<string, StudentSummary>} students - 學生摘要
 * @property {string[]} recentPatterns - 最近模式描述
 * @property {string} formattedText - 格式化的GPT可讀文本
 */

/**
 * 學生記憶摘要
 * @typedef {Object} StudentSummary
 * @property {string} name - 學生姓名
 * @property {string[]} courses - 課程列表
 * @property {string[]} schedules - 時間安排列表
 * @property {number} totalCourses - 總課程數
 */

module.exports = {
  // 導出類型定義供其他模組使用
  // 注意：這些是 JSDoc 類型定義，主要用於開發時的類型提示和文檔生成
};