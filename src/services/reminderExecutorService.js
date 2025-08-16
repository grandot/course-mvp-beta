/**
 * 提醒執行器服務
 * 負責自動掃描和發送提醒訊息
 */

const firebaseService = require('./firebaseService');
const lineService = require('./lineService');
const admin = require('firebase-admin');

/**
 * 提醒執行器配置
 */
const REMINDER_CONFIG = {
  // 功能開關
  ENABLED: process.env.REMINDER_EXECUTOR_ENABLED === 'true',
  
  // 時間配置（分鐘）
  SCAN_INTERVAL: parseInt(process.env.REMINDER_SCAN_INTERVAL || '5', 10),
  EXPIRE_WINDOW: parseInt(process.env.REMINDER_EXPIRE_WINDOW || '60', 10), // 過期窗口：60分鐘
  
  // 重試配置
  MAX_RETRY_ATTEMPTS: parseInt(process.env.REMINDER_MAX_RETRY || '3', 10),
  RETRY_DELAY_MINUTES: parseInt(process.env.REMINDER_RETRY_DELAY || '5', 10),
  
  // 批次處理
  BATCH_SIZE: parseInt(process.env.REMINDER_BATCH_SIZE || '50', 10),
  
  // 時區
  TIMEZONE: 'Asia/Taipei',
};

/**
 * 執行統計
 */
class ExecutionStats {
  constructor() {
    this.reset();
  }

  reset() {
    this.startTime = new Date();
    this.scanned = 0;
    this.sent = 0;
    this.skipped = 0;
    this.failed = 0;
    this.expired = 0;
    this.cancelled = 0;
    this.errors = [];
  }

  addError(error, reminderId = null) {
    this.errors.push({
      timestamp: new Date(),
      reminderId,
      message: error.message,
      stack: error.stack?.substring(0, 500)
    });
  }

  getDuration() {
    return Date.now() - this.startTime.getTime();
  }

  getSummary() {
    return {
      duration: this.getDuration(),
      scanned: this.scanned,
      sent: this.sent,
      skipped: this.skipped,
      failed: this.failed,
      expired: this.expired,
      cancelled: this.cancelled,
      errorCount: this.errors.length,
      errors: this.errors.slice(-5) // 只保留最近5個錯誤
    };
  }
}

/**
 * 提醒執行器主類
 */
class ReminderExecutor {
  constructor() {
    this.stats = new ExecutionStats();
    this.isRunning = false;
  }

  /**
   * 檢查功能是否啟用
   */
  isEnabled() {
    return REMINDER_CONFIG.ENABLED;
  }

  /**
   * 主執行方法
   */
  async execute() {
    if (!this.isEnabled()) {
      console.log('⚠️ 提醒執行器已停用，跳過執行');
      return { enabled: false };
    }

    if (this.isRunning) {
      console.log('⚠️ 提醒執行器正在運行中，跳過本次執行');
      return { skipped: true, reason: 'already_running' };
    }

    this.isRunning = true;
    this.stats.reset();

    try {
      console.log('🔄 開始提醒執行器掃描...');
      
      const now = new Date();
      const expireThreshold = new Date(now.getTime() - (REMINDER_CONFIG.EXPIRE_WINDOW * 60 * 1000));
      
      // 查詢需要處理的提醒
      const pendingReminders = await this.getPendingReminders(now, expireThreshold);
      this.stats.scanned = pendingReminders.length;
      
      console.log(`📋 掃描到 ${pendingReminders.length} 筆待處理提醒`);
      
      if (pendingReminders.length === 0) {
        console.log('✅ 沒有需要處理的提醒');
        return this.getExecutionResult();
      }

      // 批次處理提醒
      await this.processReminders(pendingReminders, now, expireThreshold);
      
      const result = this.getExecutionResult();
      console.log('✅ 提醒執行器完成:', result.summary);
      
      return result;
      
    } catch (error) {
      console.error('❌ 提醒執行器執行失敗:', error);
      this.stats.addError(error);
      return this.getExecutionResult();
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * 獲取待處理的提醒
   */
  async getPendingReminders(now, expireThreshold) {
    try {
      const reminders = await firebaseService.getPendingReminders();
      
      // 過濾並分類提醒
      const validReminders = [];
      
      for (const reminder of reminders) {
        const triggerTime = reminder.triggerTime?.toDate?.() || new Date(reminder.triggerTime);
        
        // 檢查是否過期
        if (triggerTime < expireThreshold) {
          console.log(`⏰ 提醒已過期: ${reminder.reminderId} (觸發時間: ${triggerTime.toISOString()})`);
          await this.markReminderExpired(reminder.reminderId);
          this.stats.expired++;
          continue;
        }
        
        // 檢查是否到時間
        if (triggerTime > now) {
          continue; // 尚未到時間
        }
        
        // 檢查課程是否已取消
        if (await this.isCourseCancel(reminder)) {
          console.log(`❌ 關聯課程已取消: ${reminder.reminderId}`);
          await this.markReminderCancelled(reminder.reminderId);
          this.stats.cancelled++;
          continue;
        }
        
        validReminders.push(reminder);
      }
      
      return validReminders;
    } catch (error) {
      console.error('❌ 獲取待處理提醒失敗:', error);
      this.stats.addError(error);
      return [];
    }
  }

  /**
   * 批次處理提醒
   */
  async processReminders(reminders, now, expireThreshold) {
    const promises = reminders.map(reminder => this.processReminder(reminder));
    await Promise.allSettled(promises);
  }

  /**
   * 處理單個提醒
   */
  async processReminder(reminder) {
    try {
      const reminderId = reminder.reminderId || reminder.id;
      
      console.log(`📤 處理提醒: ${reminderId}`);
      
      // 檢查重試次數
      const retryCount = reminder.retryCount || 0;
      if (retryCount >= REMINDER_CONFIG.MAX_RETRY_ATTEMPTS) {
        console.log(`🚫 重試次數已達上限: ${reminderId} (${retryCount}/${REMINDER_CONFIG.MAX_RETRY_ATTEMPTS})`);
        await this.markReminderFailed(reminderId, 'max_retry_reached');
        this.stats.failed++;
        return;
      }
      
      // 發送提醒
      const sendResult = await this.sendReminder(reminder);
      
      if (sendResult.success) {
        await this.markReminderSent(reminderId);
        this.stats.sent++;
        console.log(`✅ 提醒發送成功: ${reminderId}`);
      } else {
        // 發送失敗，安排重試
        await this.scheduleRetry(reminderId, retryCount + 1, sendResult.error);
        this.stats.failed++;
        console.log(`❌ 提醒發送失敗: ${reminderId}, 將重試 (${retryCount + 1}/${REMINDER_CONFIG.MAX_RETRY_ATTEMPTS})`);
      }
      
    } catch (error) {
      console.error(`❌ 處理提醒時發生錯誤:`, error);
      this.stats.addError(error, reminder.reminderId);
      this.stats.failed++;
    }
  }

  /**
   * 發送提醒訊息
   */
  async sendReminder(reminder) {
    try {
      const { userId, studentName, courseName, reminderNote, courseDate, scheduleTime } = reminder;
      
      // 格式化時間為字符串（符合 lineService.sendReminder 期望格式）
      let courseDateTime = '';
      if (courseDate && scheduleTime) {
        const courseTime = new Date(`${courseDate}T${scheduleTime}:00+08:00`);
        courseDateTime = courseTime.toLocaleString('zh-TW', {
          timeZone: REMINDER_CONFIG.TIMEZONE,
          month: 'numeric',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        });
      }
      
      // 使用現有的 lineService.sendReminder 方法
      const reminderData = {
        studentName,
        courseName,
        reminderNote,
        courseDateTime
      };
      
      const result = await lineService.sendReminder(userId, reminderData);
      
      return { success: result, result };
      
    } catch (error) {
      console.error('❌ 發送提醒訊息失敗:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * 檢查課程是否已取消
   */
  async isCourseCancel(reminder) {
    try {
      // 檢查多種可能的課程ID字段名稱
      const courseId = reminder.courseId || reminder.id;
      if (!courseId) {
        return false; // 沒有課程ID，無法檢查
      }
      
      const course = await firebaseService.getCourseById(courseId);
      return !course || course.cancelled === true;
      
    } catch (error) {
      console.log(`⚠️ 檢查課程狀態失敗: ${courseId}`, error);
      return false; // 檢查失敗時不認為已取消
    }
  }

  /**
   * 標記提醒為已發送
   */
  async markReminderSent(reminderId) {
    return firebaseService.markReminderExecuted(reminderId, {
      status: 'sent',
      executedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  }

  /**
   * 標記提醒為已取消
   */
  async markReminderCancelled(reminderId) {
    return firebaseService.markReminderExecuted(reminderId, {
      status: 'cancelled',
      executedAt: admin.firestore.FieldValue.serverTimestamp(),
      reason: 'course_cancelled'
    });
  }

  /**
   * 標記提醒為已過期
   */
  async markReminderExpired(reminderId) {
    return firebaseService.markReminderExecuted(reminderId, {
      status: 'expired',
      executedAt: admin.firestore.FieldValue.serverTimestamp(),
      reason: 'expired_window'
    });
  }

  /**
   * 標記提醒為失敗
   */
  async markReminderFailed(reminderId, reason) {
    return firebaseService.markReminderExecuted(reminderId, {
      status: 'failed',
      executedAt: admin.firestore.FieldValue.serverTimestamp(),
      reason
    });
  }

  /**
   * 安排重試
   */
  async scheduleRetry(reminderId, retryCount, errorMessage) {
    const nextRetryTime = admin.firestore.Timestamp.fromDate(
      new Date(Date.now() + (REMINDER_CONFIG.RETRY_DELAY_MINUTES * 60 * 1000))
    );
    
    return firebaseService.updateReminderRetry(reminderId, {
      retryCount,
      lastError: errorMessage,
      nextRetryTime,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
  }

  /**
   * 獲取執行結果
   */
  getExecutionResult() {
    return {
      enabled: this.isEnabled(),
      timestamp: new Date().toISOString(),
      summary: this.stats.getSummary(),
      config: {
        scanInterval: REMINDER_CONFIG.SCAN_INTERVAL,
        batchSize: REMINDER_CONFIG.BATCH_SIZE,
        maxRetry: REMINDER_CONFIG.MAX_RETRY_ATTEMPTS,
        expireWindow: REMINDER_CONFIG.EXPIRE_WINDOW
      }
    };
  }

  /**
   * 獲取執行統計
   */
  getStats() {
    return this.stats.getSummary();
  }
}

// 創建單例實例
const reminderExecutor = new ReminderExecutor();

module.exports = {
  ReminderExecutor,
  reminderExecutor,
  REMINDER_CONFIG
};