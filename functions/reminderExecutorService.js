/* eslint-disable */
/**
 * 提醒執行器（Functions 專用）
 */
const admin = require('firebase-admin');
const axios = require('axios');

const db = admin.firestore();

const CONFIG = {
  ENABLED: process.env.REMINDER_EXECUTOR_ENABLED === 'true',
  TIMEZONE: 'Asia/Taipei',
  MAX_RETRY: parseInt(process.env.REMINDER_MAX_RETRY || '3', 10),
  RETRY_DELAY_MINUTES: parseInt(process.env.REMINDER_RETRY_DELAY || '5', 10),
  EXPIRE_WINDOW_MINUTES: parseInt(process.env.REMINDER_EXPIRE_WINDOW || '60', 10),
  LINE_TOKEN: process.env.LINE_CHANNEL_ACCESS_TOKEN || null,
};

class ReminderExecutor {
  constructor() {
    this.isRunning = false;
    this.enabled = CONFIG.ENABLED;
    this.stats = {
      start: 0,
      scanned: 0,
      sent: 0,
      failed: 0,
      expired: 0,
      cancelled: 0,
      skipped: 0,
      errors: [],
      reset() {
        this.start = Date.now();
        this.scanned = 0; this.sent = 0; this.failed = 0; this.expired = 0; this.cancelled = 0; this.skipped = 0; this.errors = [];
      },
      addError(e, id) { this.errors.push({ id, message: e?.message || String(e) }); },
      summary() {
        return {
          duration: Date.now() - this.start,
          scanned: this.scanned,
          sent: this.sent,
          failed: this.failed,
          expired: this.expired,
          cancelled: this.cancelled,
          skipped: this.skipped,
          errorCount: this.errors.length,
          errors: this.errors.slice(-5),
        };
      },
    };
  }

  isEnabled() { return this.enabled; }

  getStats() { return this.stats.summary(); }

  async execute() {
    if (!this.isEnabled()) return { enabled: false };
    if (this.isRunning) return { skipped: true, reason: 'already_running' };
    this.isRunning = true; this.stats.reset();
    try {
      const now = new Date();
      const expireThreshold = new Date(now.getTime() - CONFIG.EXPIRE_WINDOW_MINUTES * 60 * 1000);
      const pending = await this.getPending(now);
      this.stats.scanned = pending.length;
      await Promise.allSettled(pending.map((r) => this.processOne(r, now, expireThreshold)));
      return { summary: this.getStats(), config: { enabled: this.isEnabled() } };
    } catch (e) {
      this.stats.addError(e);
      return { summary: this.getStats(), error: e?.message || String(e) };
    } finally { this.isRunning = false; }
  }

  async getPending(now) {
    const snap = await db.collection('reminders')
      .where('executed', '==', false)
      .where('triggerTime', '<=', now)
      .get();
    const out = [];
    snap.forEach((doc) => out.push({ id: doc.id, reminderId: doc.id, ...doc.data() }));
    return out;
  }

  async processOne(reminder, now, expireThreshold) {
    try {
      const reminderId = reminder.reminderId || reminder.id;
      const trigger = reminder.triggerTime?.toDate?.() || new Date(reminder.triggerTime);

      if (trigger < expireThreshold) {
        await this.mark(reminderId, { status: 'expired', reason: 'expired_window' });
        this.stats.expired += 1; return;
      }

      if (await this.isCancelled(reminder.courseId)) {
        await this.mark(reminderId, { status: 'cancelled', reason: 'course_cancelled' });
        this.stats.cancelled += 1; return;
      }

      const ok = await this.pushLine(reminder);
      if (ok) {
        await this.mark(reminderId, { status: 'sent' });
        this.stats.sent += 1; return;
      }

      const retry = (reminder.retryCount || 0) + 1;
      if (retry >= CONFIG.MAX_RETRY) {
        await this.mark(reminderId, { status: 'failed', reason: 'max_retry_reached' });
        this.stats.failed += 1; return;
      }
      await db.collection('reminders').doc(reminderId).update({
        retryCount: retry,
        lastError: 'send_failed',
        nextRetryTime: new Date(Date.now() + CONFIG.RETRY_DELAY_MINUTES * 60 * 1000),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      this.stats.failed += 1;
    } catch (e) { this.stats.addError(e, reminder?.reminderId); this.stats.failed += 1; }
  }

  async pushLine(reminder) {
    try {
      if (!CONFIG.LINE_TOKEN) throw new Error('LINE_CHANNEL_ACCESS_TOKEN not set');
      const { userId, studentName, courseName, reminderNote, courseDate, scheduleTime } = reminder;

      let text = '⏰ 課程提醒\n\n';
      if (studentName) text += `👦 學生：${studentName}\n`;
      if (courseName) text += `📚 課程：${courseName}\n`;
      if (courseDate && scheduleTime) {
        const dt = new Date(`${courseDate}T${scheduleTime}:00+08:00`);
        const ts = dt.toLocaleString('zh-TW', { timeZone: CONFIG.TIMEZONE, month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });
        text += `🕐 時間：${ts}\n`;
      }
      if (reminderNote) text += `📌 備註：${reminderNote}\n`;
      text += '\n祝上課愉快！ 😊';

      const payload = { to: userId, messages: [{ type: 'text', text }] };
      await axios.post('https://api.line.me/v2/bot/message/push', payload, {
        headers: { Authorization: `Bearer ${CONFIG.LINE_TOKEN}`, 'Content-Type': 'application/json' }, timeout: 10000,
      });
      return true;
    } catch (e) { this.stats.addError(e); return false; }
  }

  async isCancelled(courseId) {
    try {
      if (!courseId) return false;
      const doc = await db.collection('courses').doc(courseId).get();
      if (!doc.exists) return true;
      return !!doc.data().cancelled;
    } catch (_) { return false; }
  }

  async mark(reminderId, extra) {
    return db.collection('reminders').doc(reminderId).update({
      executed: true,
      executedAt: admin.firestore.FieldValue.serverTimestamp(),
      status: extra?.status || 'executed',
      reason: extra?.reason || null,
    });
  }
}

const reminderExecutor = new ReminderExecutor();

module.exports = { ReminderExecutor, reminderExecutor, CONFIG };
