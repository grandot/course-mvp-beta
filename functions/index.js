/**
 * Firebase Cloud Functions for Course MVP
 * 提醒系統與定時任務處理
 */

const functions = require('firebase-functions');
const admin = require('firebase-admin');
const axios = require('axios');

// 初始化 Firebase Admin SDK
admin.initializeApp();

const db = admin.firestore();

/**
 * 定時提醒檢查函式
 * 每5分鐘執行一次，檢查需要發送的提醒
 */
exports.checkReminders = functions.pubsub
  .schedule('every 5 minutes')
  .timeZone('Asia/Taipei')
  .onRun(async (context) => {
    console.log('🔄 開始檢查待發送提醒...');
    
    try {
      const now = new Date();
      const nowTimestamp = admin.firestore.Timestamp.fromDate(now);
      
      // 查詢需要發送的提醒
      const pendingReminders = await db.collection('reminders')
        .where('executed', '==', false)
        .where('triggerTime', '<=', nowTimestamp)
        .limit(50) // 限制批次處理數量
        .get();
      
      console.log(`📋 找到 ${pendingReminders.size} 筆待發送提醒`);
      
      if (pendingReminders.empty) {
        console.log('✅ 目前沒有需要發送的提醒');
        return null;
      }
      
      // 批次處理提醒
      const batch = db.batch();
      const reminderPromises = [];
      
      pendingReminders.forEach((doc) => {
        const reminderData = doc.data();
        
        // 發送提醒
        const reminderPromise = sendReminderMessage(reminderData)
          .then((success) => {
            if (success) {
              // 標記為已執行
              batch.update(doc.ref, {
                executed: true,
                executedAt: admin.firestore.FieldValue.serverTimestamp(),
                executionStatus: 'success'
              });
            } else {
              // 記錄失敗但不重試（避免無限循環）
              batch.update(doc.ref, {
                executed: true,
                executedAt: admin.firestore.FieldValue.serverTimestamp(),
                executionStatus: 'failed'
              });
            }
          })
          .catch((error) => {
            console.error(`❌ 提醒發送失敗 (${doc.id}):`, error);
            // 標記為失敗
            batch.update(doc.ref, {
              executed: true,
              executedAt: admin.firestore.FieldValue.serverTimestamp(),
              executionStatus: 'error',
              errorMessage: error.message
            });
          });
        
        reminderPromises.push(reminderPromise);
      });
      
      // 等待所有提醒發送完成
      await Promise.all(reminderPromises);
      
      // 批次更新 Firestore
      await batch.commit();
      
      console.log(`✅ 成功處理 ${pendingReminders.size} 筆提醒`);
      return { processedCount: pendingReminders.size };
      
    } catch (error) {
      console.error('❌ 檢查提醒時發生錯誤:', error);
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
    
    // 執行提醒檢查邏輯（重用定時任務的邏輯）
    const result = await exports.checkReminders.run();
    
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