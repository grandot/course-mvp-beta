/* eslint-disable import/no-unresolved */
/**
 * Firebase Cloud Functions for Course MVP（精簡版）
 * 保留：checkReminders / cleanupOldReminders / getReminderStats
 */

const { setGlobalOptions } = require('firebase-functions/v2');
const { onRequest } = require('firebase-functions/v2/https');
const { onSchedule } = require('firebase-functions/v2/scheduler');
const admin = require('firebase-admin');

admin.initializeApp();
setGlobalOptions({ region: 'us-central1' });

// 安全載入 reminderExecutor（避免未知路徑錯誤導致整個 Functions 初始化失敗）
let reminderExecutor;
try {
  // 正確：位於 functions/ 同層
  // eslint-disable-next-line global-require
  ({ reminderExecutor } = require('./reminderExecutorService'));
} catch (e) {
  // 優雅降級：避免 cleanupOldReminders 因為頂層 require 失敗而無法部署/執行
  // 仍然輸出可觀測性，提醒修正路徑
  // eslint-disable-next-line no-console
  console.warn(JSON.stringify({
    fn: 'bootstrap',
    msg: 'reminderExecutorService require failed, using stub',
    errorMessage: e?.message || String(e),
  }));
  reminderExecutor = {
    isRunning: false,
    isEnabled: () => false,
    getStats: () => ({ disabled: true }),
    // 不執行任何提醒邏輯，僅回傳狀態以避免 crash
    execute: async () => ({ skipped: true, reason: 'reminderExecutor_unavailable' }),
  };
}

const db = admin.firestore();

// 每 5 分鐘自動檢查並發送提醒
exports.checkReminders = onSchedule({ schedule: 'every 5 minutes', timeZone: 'Asia/Taipei' }, () => reminderExecutor.execute());

// 將清理邏輯抽成可重用函式（供排程與 HTTP 觸發）
async function runCleanupOldReminders() {
  const startedAt = Date.now();
  const runId = `cleanup-${startedAt}`;
  const log = (msg, extra = {}) => {
    try {
      console.log(JSON.stringify({
        fn: 'cleanupOldReminders',
        runId,
        msg,
        ...extra,
      }));
    } catch (e) { // eslint-disable-line no-unused-vars
      console.log(`[cleanupOldReminders] ${msg}`);
    }
  };

  try {
    // 計算截止時間（30天前）
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - 30);
    const cutoff = admin.firestore.Timestamp.fromDate(cutoffDate);

    const collectionName = 'reminders';
    const queryPlan = [
      { field: 'executed', op: '==', value: true },
      { field: 'executedAt', op: '<=', value: cutoff.toDate().toISOString() },
    ];

    log('Query.start', { collection: collectionName, queryPlan, limit: 100 });

    let snap;
    try {
      snap = await db
        .collection(collectionName)
        .where('executed', '==', true)
        .where('executedAt', '<=', cutoff)
        .limit(100)
        .get();
    } catch (error) {
      const message = error?.message || String(error);
      let indexUrl = null;
      try {
        const m = message.match(/https?:\/\/\S+/);
        const [first] = m || [];
        if (first) indexUrl = first;
      } catch (e) { /* noop */ }
      log('Query.error', {
        errorMessage: message,
        errorStack: error?.stack || null,
        indexUrl: indexUrl || null,
        hint: '若為 FAILED_PRECONDITION 且訊息含 index URL，請於該連結建立 composite index',
      });
      return {
        success: false,
        stage: 'query',
        errorMessage: message,
        indexUrl,
      };
    }

    log('Query.success', { snapshotSize: snap.size, empty: snap.empty });

    if (!snap.empty) {
      const sample = snap.docs[0]?.data?.() || {};
      const executedType = typeof sample.executed;
      const isTimestamp = sample.executedAt
        && (sample.executedAt instanceof admin.firestore.Timestamp);

      const executedAtRaw = (() => {
        try {
          return sample.executedAt?.toDate?.().toISOString?.();
        } catch (e) {
          return null;
        }
      })();

      log('Schema.check', {
        fields: Object.keys(sample),
        executedType,
        executedAtType: isTimestamp ? 'Timestamp' : typeof sample.executedAt,
        executedAtRaw,
      });
    }

    if (snap.empty) {
      log('NoData', { deletedCount: 0 });
      return { success: true, deletedCount: 0 };
    }

    const batch = db.batch();
    snap.forEach((doc) => batch.delete(doc.ref));
    try {
      await batch.commit();
    } catch (error) {
      log('Batch.error', {
        errorMessage: error?.message || String(error),
        errorStack: error?.stack || null,
      });
      return {
        success: false,
        stage: 'batch',
        errorMessage: error?.message || String(error),
      };
    }

    const durationMs = Date.now() - startedAt;
    log('Cleanup.done', { deletedCount: snap.size, durationMs });
    return { success: true, deletedCount: snap.size, durationMs };
  } catch (error) {
    // 任何未捕捉的例外：記錄並優雅結束
    console.warn(JSON.stringify({ // eslint-disable-line no-console
      fn: 'cleanupOldReminders',
      msg: 'Fatal.error',
      errorMessage: error?.message || String(error),
      errorStack: error?.stack || null,
    }));
    return {
      success: false,
      stage: 'fatal',
      errorMessage: error?.message || String(error),
    };
  }
}

// 每日清理 30 天前的已執行提醒（Scheduler 觸發）
exports.cleanupOldReminders = onSchedule({ schedule: '0 2 * * *', timeZone: 'Asia/Taipei' }, async () => runCleanupOldReminders());

// 已移除公開清理入口，改由排程觸發（減少外部暴露面）

// 只讀統計（監控用）
exports.getReminderStats = onRequest(async (req, res) => {
  try {
    const stats = reminderExecutor.getStats();
    const config = {
      enabled: reminderExecutor.isEnabled(),
      isRunning: reminderExecutor.isRunning,
    };
    res.status(200).json({ success: true, stats, config });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// 已移除公開執行入口，改由排程觸發（減少外部暴露面）

// 已移除測試入口（避免誤觸發）；如需臨時測試，可短期開啟或用 Firestore 手動造數據
