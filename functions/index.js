/**
 * Firebase Cloud Functions for Course MVP
 * 提醒系統與定時任務處理
 */

const functions = require('firebase-functions');
const admin = require('firebase-admin');
const axios = require('axios');

// 初始化 Firebase Admin SDK
admin.initializeApp();

// 導入提醒執行器和監控工具
const { reminderExecutor } = require('../src/services/reminderExecutorService');
const { healthChecker, ReminderLogger } = require('../src/utils/reminderMonitor');

const db = admin.firestore();

/**
 * 定時提醒檢查函式（使用新的提醒執行器）
 * 每5分鐘執行一次，檢查需要發送的提醒
 */
exports.checkReminders = functions.pubsub
  .schedule('every 5 minutes')
  .timeZone('Asia/Taipei')
  .onRun(async (context) => {
    console.log('🔄 開始執行提醒檢查（使用 ReminderExecutor）...');
    
    try {
      // 使用新的提醒執行器
      const result = await reminderExecutor.execute();
      
      // 記錄執行結果
      ReminderLogger.logExecution(result);
      
      // 執行健康檢查
      const health = await healthChecker.checkHealth();
      if (health.level === 'warning' || health.level === 'error') {
        ReminderLogger.logHealthCheck(health);
      }
      
      return result;
      
    } catch (error) {
      console.error('❌ 提醒執行器執行失敗:', error);
      throw error;
    }
  });

/**
 * 發送 LINE 提醒訊息
 */
async function sendReminderMessage(reminderData) {
  try {
    const { userId, studentName, courseName, reminderNote, courseDateTime } = reminderData;
    
    // 組成提醒訊息
    let reminderText = `⏰ 課程提醒\n\n`;
    reminderText += `👦 學生：${studentName}\n`;
    reminderText += `📚 課程：${courseName}\n`;
    reminderText += `🕐 時間：${courseDateTime}\n`;
    
    if (reminderNote) {
      reminderText += `📌 備註：${reminderNote}\n`;
    }
    
    reminderText += `\n祝上課愉快！ 😊`;
    
    // LINE API 設定
    const lineApiUrl = 'https://api.line.me/v2/bot/message/push';
    const lineAccessToken = functions.config().line?.access_token;
    
    if (!lineAccessToken) {
      throw new Error('LINE access token 未設定');
    }
    
    const payload = {
      to: userId,
      messages: [{
        type: 'text',
        text: reminderText
      }]
    };
    
    const response = await axios.post(lineApiUrl, payload, {
      headers: {
        'Authorization': `Bearer ${lineAccessToken}`,
        'Content-Type': 'application/json'
      },
      timeout: 10000
    });
    
    if (response.status === 200) {
      console.log(`✅ 提醒訊息發送成功 (用戶: ${userId})`);
      return true;
    } else {
      console.error(`❌ LINE API 回應異常: ${response.status}`);
      return false;
    }
    
  } catch (error) {
    console.error('❌ 發送提醒訊息失敗:', error);
    return false;
  }
}

/**
 * 清理過期提醒記錄
 * 每天晚上 2 點執行，清理 30 天前的已執行提醒
 */
exports.cleanupOldReminders = functions.pubsub
  .schedule('0 2 * * *')
  .timeZone('Asia/Taipei')
  .onRun(async (context) => {
    console.log('🧹 開始清理過期提醒記錄...');
    
    try {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const cutoffTimestamp = admin.firestore.Timestamp.fromDate(thirtyDaysAgo);
      
      // 查詢需要清理的記錄
      const oldReminders = await db.collection('reminders')
        .where('executed', '==', true)
        .where('executedAt', '<=', cutoffTimestamp)
        .limit(100) // 批次處理
        .get();
      
      if (oldReminders.empty) {
        console.log('✅ 沒有需要清理的過期提醒');
        return null;
      }
      
      // 批次刪除
      const batch = db.batch();
      oldReminders.forEach((doc) => {
        batch.delete(doc.ref);
      });
      
      await batch.commit();
      
      console.log(`✅ 成功清理 ${oldReminders.size} 筆過期提醒記錄`);
      return { deletedCount: oldReminders.size };
      
    } catch (error) {
      console.error('❌ 清理過期提醒時發生錯誤:', error);
      throw error;
    }
  });

/**
 * 健康檢查函式
 * HTTP 觸發，用於監控系統狀態
 */
exports.healthCheck = functions.https.onRequest(async (req, res) => {
  const healthData = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    services: {
      firestore: 'unknown',
      lineApi: 'unknown'
    }
  };
  
  try {
    // 測試 Firestore 連接
    await db.collection('_health').doc('test').set({
      timestamp: admin.firestore.FieldValue.serverTimestamp()
    });
    healthData.services.firestore = 'healthy';
    
    // 測試 LINE API（如果有設定 token）
    const lineAccessToken = functions.config().line?.access_token;
    if (lineAccessToken) {
      try {
        await axios.get('https://api.line.me/v2/bot/info', {
          headers: { 'Authorization': `Bearer ${lineAccessToken}` },
          timeout: 5000
        });
        healthData.services.lineApi = 'healthy';
      } catch (lineError) {
        healthData.services.lineApi = 'error';
      }
    } else {
      healthData.services.lineApi = 'not_configured';
    }
    
    // 查詢活躍提醒數量
    const activeReminders = await db.collection('reminders')
      .where('executed', '==', false)
      .count()
      .get();
    
    healthData.activeReminders = activeReminders.data().count;
    
    res.status(200).json(healthData);
    
  } catch (error) {
    console.error('❌ 健康檢查失敗:', error);
    healthData.status = 'unhealthy';
    healthData.error = error.message;
    res.status(500).json(healthData);
  }
});

/**
 * 手動觸發提醒檢查
 * HTTP 觸發，用於測試和手動執行
 */
exports.triggerReminderCheck = functions.https.onRequest(async (req, res) => {
  try {
    console.log('🔧 手動觸發提醒檢查...');
    
    // 直接呼叫提醒執行器
    const result = await reminderExecutor.execute();
    
    res.status(200).json({
      success: true,
      message: '提醒檢查執行完成',
      result: result
    });
    
  } catch (error) {
    console.error('❌ 手動觸發提醒檢查失敗:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 提醒系統健康檢查
 * HTTP 觸發，用於監控和觀測
 */
exports.getReminderHealth = functions.https.onRequest(async (req, res) => {
  try {
    const health = await healthChecker.checkHealth();
    const monitoring = healthChecker.getMonitoringSummary();
    const metrics = healthChecker.getPerformanceMetrics();
    
    res.status(200).json({
      success: true,
      health,
      monitoring,
      metrics
    });
    
  } catch (error) {
    console.error('❌ 健康檢查失敗:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 取得提醒執行器統計（簡化版本）
 * HTTP 觸發，用於快速查看狀態
 */
exports.getReminderStats = functions.https.onRequest(async (req, res) => {
  try {
    const stats = reminderExecutor.getStats();
    const config = {
      enabled: reminderExecutor.isEnabled(),
      isRunning: reminderExecutor.isRunning
    };
    
    res.status(200).json({
      success: true,
      stats,
      config
    });
    
  } catch (error) {
    console.error('❌ 取得提醒統計失敗:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});