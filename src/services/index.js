/**
 * 服務模組索引檔案
 * 統一匯出所有服務模組
 */

const firebaseService = require('./firebaseService');
const googleCalendarService = require('./googleCalendarService');
const lineService = require('./lineService');
const openaiService = require('./openaiService');

module.exports = {
  firebaseService,
  googleCalendarService,
  lineService,
  openaiService
};