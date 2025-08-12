#!/usr/bin/env node
// 非互動本地驗證：直接呼叫任務處理器，避免 AI/意圖詢問互動

require('dotenv').config();
const path = require('path');
const ROOT = process.cwd();

async function main() {
  const userId = 'TEST_USER_12345';
  const { getConversationManager } = require(path.join(ROOT,'src/conversation/ConversationManager'));
  const { firebaseService, googleCalendarService } = require(path.join(ROOT,'src/services'));
  const cm = getConversationManager();

  // 覆寫對話管理器以記憶體存放，避免 Redis 造成互動等待/不可用
  const memoryStore = new Map();
  const origGetContext = cm.getContext.bind(cm);
  const origSaveContext = cm.saveContext.bind(cm);
  cm.getContext = async (uid) => {
    if (memoryStore.has(uid)) return memoryStore.get(uid);
    const ctx = await origGetContext(uid);
    memoryStore.set(uid, ctx);
    return ctx;
  };
  cm.saveContext = async (uid, ctx) => {
    memoryStore.set(uid, ctx);
    return true;
  };

  // 測試資料
  const addCourse = require(path.join(ROOT,'src/tasks/handle_add_course_task'));
  const cancelAction = require(path.join(ROOT,'src/tasks/handle_cancel_action_task'));
  const cancelCourse = require(path.join(ROOT,'src/tasks/handle_cancel_course_task'));

  function log(title, data){
    console.log(`\n=== ${title} ===`);
    if (data) console.log(typeof data==='string'?data:JSON.stringify(data,null,2));
  }

  try {
    // 1) 先建立一筆重複課程
    // 嘗試多個不易衝突的時間/星期
    const candidates = [
      { scheduleTime:'18:40', dayOfWeek:4 },
      { scheduleTime:'19:10', dayOfWeek:5 },
      { scheduleTime:'17:20', dayOfWeek:0 },
    ];
    let slotsAdd = { studentName:'小白', courseName:'英文課', scheduleTime:'16:00', dayOfWeek:2, recurring:true, recurrenceType:'weekly' };
    let addRes;
    for (const c of candidates) {
      slotsAdd = { studentName:'小白', courseName:'英文課', scheduleTime:c.scheduleTime, dayOfWeek:c.dayOfWeek, recurring:true, recurrenceType:'weekly' };
      log('STEP1 建立課程 slots', slotsAdd);
      addRes = await addCourse(slotsAdd, userId);
      log('STEP1 嘗試結果', addRes);
      if (addRes && addRes.success) break;
      if (addRes && addRes.code !== 'TIME_CONFLICT') break;
    }
    if (!addRes.success) throw new Error('建立課程失敗');

    // 2) 撤銷上一動作（undo）：預期物理刪 Firebase + 刪 GCal
    const slotsCancelAction = {}; // 依對話上下文取 lastActions
    log('STEP2 撤銷上一動作', slotsCancelAction);
    const undoRes = await cancelAction(slotsCancelAction, userId);
    log('STEP2 結果', undoRes);

    // 3) 再建立一筆，用於「主動取消」測試
    const addRes2 = await addCourse(slotsAdd, userId);
    log('STEP3 再次建立結果', addRes2);
    if (!addRes2.success) throw new Error('建立課程失敗(2)');

    // 4) 主動取消：不刪 GCal、只標記；Firebase 軟刪
    const slotsCancel = { studentName:'小白', courseName:'英文課', scope:'recurring' };
    log('STEP4 主動取消 slots', slotsCancel);
    const cancelRes = await cancelCourse(slotsCancel, userId);
    log('STEP4 結果', cancelRes);

    // 5) 清理資源，避免卡住
    try { await cm.clearExpectedInput(userId); } catch(_){}
    try { if (firebaseService.shutdownFirebase) await firebaseService.shutdownFirebase(); } catch(_){ }
    try {
      const { getRedisService } = require(path.join(ROOT,'src/services/redisService'));
      const rs = getRedisService();
      if (rs && rs.client) await rs.disconnect();
    } catch(_){ }

    console.log('\n✅ 非互動測試完成');
  } catch (e) {
    console.error('❌ 非互動測試失敗:', e?.message || e);
    try {
      const { getRedisService } = require(path.join(ROOT,'src/services/redisService'));
      const rs = getRedisService();
      if (rs && rs.client) await rs.disconnect();
    } catch(_){ }
    try { const { firebaseService } = require(path.join(ROOT,'src/services')); if (firebaseService.shutdownFirebase) await firebaseService.shutdownFirebase(); } catch(_){ }
    process.exit(1);
  }
}

main();


