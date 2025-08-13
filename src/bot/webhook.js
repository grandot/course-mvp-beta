const crypto = require('crypto');
const { parseIntent } = require('../intent/parseIntent');
const { extractSlots } = require('../intent/extractSlots');
const { executeTask, getSupportedIntents } = require('../tasks');
const { getConversationManager } = require('../conversation/ConversationManager');

// 🛡️ 動態 LINE Service 選擇：根據用戶ID選擇服務
const realLineService = require('../services/lineService');
const mockLineService = require('../services/mockLineService');

/**
 * 根據用戶ID動態選擇 LINE Service
 * @param {string} userId - LINE 用戶ID
 * @returns {Object} 對應的 LINE Service 實例
 */
function getLineService(userId, req = null) {
  // 🔥 核心邏輯：測試用戶自動用Mock，生產用戶用真實服務
  const isTestUser = userId && userId.startsWith('U_test_');
  // QA 覆寫：允許透過 header 強制走真實服務
  const forceReal = (req && (req.headers['x-qa-mode'] === 'real' || req.headers['x-qa-mode'] === 'REAL'))
    || (req && req.query && (req.query.qaMode === 'real' || req.query.qaMode === 'REAL'))
    || process.env.QA_FORCE_REAL === 'true';

  if (isTestUser && !forceReal) {
    console.log('🧪 測試用戶，使用 Mock LINE Service');
    return mockLineService;
  }
  console.log('🚀 生產用戶，使用真實 LINE Service');
  return realLineService;
}

/**
 * LINE Bot Webhook 處理器
 * 負責接收和處理來自 LINE 平台的所有事件
 */

/**
 * 執行對應的任務處理器（已改用統一的任務處理器索引）
 * 此函式現在移到 /src/tasks/index.js，這裡保留以避免破壞現有調用
 */
async function executeTaskLegacy(intent, slots, userId, messageEvent) {
  console.log('⚠️ 使用舊版 executeTask，建議改用 /src/tasks/index.js 的版本');
  return await executeTask(intent, slots, userId);
}

/**
 * 處理文字訊息（多輪對話版本）
 */
async function handleTextMessage(event, req = null) {
  try {
    const userMessage = event.message.text;
    const { userId } = event.source;
    const { replyToken } = event;
    const { info, error: logError, generateTraceId } = require('../utils/logger');
    const traceId = generateTraceId('line');

    // inbound log (single-line JSON)
    info({
      direction: 'inbound', channel: 'line', traceId, userId, textIn: userMessage,
    });
    console.log('🔍 用戶ID類型:', typeof userId);
    console.log('🔍 是否測試用戶:', userId && userId.startsWith('U_test_'));

    // 🔥 核心邏輯：動態選擇 LINE Service
    const currentLineService = getLineService(userId, req);

    // 初始化對話管理器
    const conversationManager = getConversationManager();

    // 里程碑1：若啟用 IntentRouter，改由 Router 決策
    let intent;
    const qaHeader = (req && (req.headers['x-qa-mode'] || req.query?.qaMode || '')).toString().toLowerCase();
    const isQaFlow = qaHeader === 'real' || (userId && String(userId).startsWith('U_test_'));
    const useRouter = process.env.USE_INTENT_ROUTER === 'true' || isQaFlow;
    if (useRouter) {
      const { createRequestContext } = require('../nlu/RequestContext');
      const { routeIntent } = require('../nlu/IntentRouter');
      const ctx = await createRequestContext(userId, userMessage, req);
      const routed = await routeIntent(ctx);
      intent = routed.intent;
    } else {
      // 舊路徑（保留回退）
      intent = await parseIntent(userMessage, userId);
    }
    info({
      stage: 'nlp', traceId, userId, intent,
    });
    try {
      // 記錄 Router 決策到 DecisionLogger（便於 /debug/decision 查詢）
      const { recordDecision } = require('../utils/decisionLogger');
      recordDecision(traceId, {
        stage: 'nlp', userId, message: userMessage, intent,
      });
    } catch (_) {}

    // 里程碑1保險絲：僅保留提醒覆寫，關閉查詢覆寫避免壓過 AI
    try {
      const msg = String(userMessage || '');
      if (msg.includes('提醒')) {
        intent = 'set_reminder';
      }
    } catch (_) {}

    // 記錄用戶訊息到對話歷史（先記錄，後續需要slots補充）
    await conversationManager.recordUserMessage(userId, userMessage, intent);

    if (intent === 'unknown') {
      const result = await executeTask('unknown', {}, userId, event);

      await conversationManager.recordBotResponse(userId, result.message, {
        quickReply: result.quickReply,
      });

      await currentLineService.replyMessage(replyToken, result.message, result.quickReply || null);
      return;
    }

    // 第二步：實體提取 + 查詢會話鎖（若為查詢則固定學生/時間）
    const slots = await extractSlots(userMessage, intent, userId);
    if (intent === 'query_schedule') {
      try {
        const { getConversationManager } = require('../conversation/ConversationManager');
        const cm = getConversationManager();
        // 若使用者在這句明確提到另一個學生，則重置會話
        await cm.setActiveQuerySession(userId, {
          studentName: slots.studentName || null,
          timeReference: slots.timeReference || null,
        });
      } catch (e) {
        console.warn('⚠️ 設定查詢會話鎖失敗:', e?.message || e);
      }
    }

    // 查詢多候選：不猜，先回澄清選單
    if (intent === 'query_schedule' && Array.isArray(slots.studentCandidates) && slots.studentCandidates.length > 1) {
      const { getConversationManager } = require('../conversation/ConversationManager');
      const cm = getConversationManager();
      await cm.setExpectedInput(userId, 'query_schedule', ['student_name_input'], { intent: 'query_schedule', existingSlots: slots, missingFields: ['studentName'] });

      const options = slots.studentCandidates.slice(0, 4);
      const quickReply = options.map((name) => ({ label: name, text: name }));
      const clarify = '❓ 請問要查哪位學生的課表？';

      await currentLineService.replyMessage(replyToken, clarify, quickReply);
      info({
        direction: 'outbound', channel: 'line', traceId, userId, textOut: clarify, quickReply: !!quickReply,
      });
      try {
        require('../utils/decisionLogger').recordDecision(traceId, {
          stage: 'render', userId, intent, responseMessage: clarify, quickReply,
        });
      } catch (_) {}
      return;
    }
    info({
      stage: 'slots', traceId, userId, intent, slotsSummary: Object.keys(slots),
    });
    try {
      const { recordDecision } = require('../utils/decisionLogger');
      recordDecision(traceId, {
        stage: 'slots', userId, intent, slots,
      });
    } catch (_) {}

    // 第三步：執行任務
    const t0 = Date.now();
    const result = await executeTask(intent, slots, userId, event);
    const latencyMs = Date.now() - t0;
    info({
      stage: 'task', traceId, userId, intent, success: !!result?.success, code: result?.code || null, latencyMs,
    });
    try {
      const { recordDecision } = require('../utils/decisionLogger');
      recordDecision(traceId, {
        stage: 'task', userId, intent, result, latencyMs,
      });
    } catch (_) {}

    // 第四步：記錄任務執行結果到對話上下文
    await conversationManager.recordTaskResult(userId, intent, slots, result);

    // 第五步：處理回應和 Quick Reply（使用統一渲染器）
    const { render } = require('../nlu/ResponseRenderer');
    const responseMessage = render(intent, slots, result);
    let quickReply = null;

    if (result.success) {
      // 如果任務結果包含 quickReply，使用任務提供的
      if (result.quickReply) {
        quickReply = result.quickReply;
      } else {
        // 否則根據意圖類型生成預設的 Quick Reply
        quickReply = getQuickReplyForIntent(intent, result);
      }
    }

    // 記錄機器人回應到對話歷史
    await conversationManager.recordBotResponse(userId, responseMessage, { quickReply });

    // 回應用戶
    await currentLineService.replyMessage(replyToken, responseMessage, quickReply);
    try {
      const { recordDecision } = require('../utils/decisionLogger');
      recordDecision(traceId, {
        stage: 'render', userId, intent, responseMessage, quickReply,
      });
    } catch (_) {}
    info({
      direction: 'outbound', channel: 'line', traceId, userId, textOut: responseMessage, quickReply: !!quickReply,
    });
  } catch (error) {
    const { error: logError, generateTraceId } = require('../utils/logger');
    const traceId = generateTraceId('err');
    logError({
      direction: 'inbound', channel: 'line', traceId, userId: event?.source?.userId, textIn: event?.message?.text, error: error?.message || String(error),
    });

    // 記錄錯誤到對話歷史
    try {
      const conversationManager = getConversationManager();
      await conversationManager.recordBotResponse(event.source.userId, '處理訊息時發生錯誤，請稍後再試。');
    } catch (logError) {
      console.error('❌ 記錄錯誤回應失敗:', logError);
    }

    // 錯誤處理使用統一的服務選擇邏輯
    const currentLineService = getLineService(event.source.userId, req);

    await currentLineService.replyMessage(
      event.replyToken,
      '處理訊息時發生錯誤，請稍後再試。',
    );
  }
}

/**
 * 處理圖片訊息
 */
async function handleImageMessage(event, req = null) {
  try {
    const messageId = event.message.id;
    const { userId } = event.source;
    const { replyToken } = event;
    const { info } = require('../utils/logger');
    const traceId = require('../utils/logger').generateTraceId('line');

    info({
      direction: 'inbound', channel: 'line', traceId, userId, imageMessageId: messageId,
    });

    // 動態選擇 LINE Service
    const currentLineService = getLineService(userId, req);

    // 下載圖片內容
    const imageBuffer = await currentLineService.getMessageContent(messageId);

    // 處理圖片上傳（記錄到課程內容）
    const handle_record_content_task = require('../tasks/handle_record_content_task');

    const slots = {
      imageBuffer,
      messageId,
      content: '課堂照片', // 預設內容
      timeReference: 'today', // 預設為今天
    };

    const t0 = Date.now();
    const result = await handle_record_content_task(slots, userId, event);
    const latencyMs = Date.now() - t0;
    info({
      stage: 'task', traceId, userId, intent: 'record_content', success: !!result?.success, code: result?.code || null, latencyMs,
    });

    // 提供圖片相關的快捷回覆按鈕
    const quickReply = [
      { label: '📝 補充說明', text: '補充課程內容' },
      { label: '📚 指定課程', text: '指定課程' },
      { label: '📅 查詢記錄', text: '查詢課程記錄' },
    ];

    await currentLineService.replyMessage(replyToken, result.message, quickReply);
    info({
      direction: 'outbound', channel: 'line', traceId, userId, textOut: result.message, quickReply: !!quickReply,
    });
  } catch (error) {
    console.error('❌ 處理圖片訊息失敗:', error);

    // 動態選擇 LINE Service 用於錯誤處理
    const currentLineService = getLineService(event.source.userId, req);

    // 檢查是否為圖片內容過期（404 錯誤）
    if (error.response && error.response.status === 404) {
      await currentLineService.replyMessage(
        event.replyToken,
        '📷 圖片上傳提醒\n'
        + '這張圖片無法下載，可能是因為 LINE 的限制：\n\n'
        + '圖片只能在傳送後 1 小時內讓機器人存取\n\n'
        + '🔁 如果您是從其他群組轉傳的舊圖片，請改用以下方式：\n\n'
        + '👉 正確做法：\n\n'
        + '打開手機的「相簿」App\n\n'
        + '找到要上傳的照片\n\n'
        + '點選「分享」→ 選擇 LINE → 傳送到這個對話視窗\n\n'
        + '❌ 不要從 LINE 對話框內點照片圖示選擇圖片，那樣可能只是轉傳，Bot 會抓不到內容。\n\n'
        + '感謝您的配合 🙏',
      );
    } else {
      await currentLineService.replyMessage(
        event.replyToken,
        '處理圖片時發生錯誤，請稍後再試。',
      );
    }
  }
}

/**
 * 根據意圖提供快捷回覆按鈕（支援多輪對話）
 * @param {string} intent - 意圖名稱
 * @param {object} result - 任務執行結果（可選）
 * @returns {Array|null} Quick Reply 按鈕陣列
 */
function getQuickReplyForIntent(intent, result = null) {
  const commonActions = [
    { label: '📚 新增課程', text: '我要新增課程' },
    { label: '📅 查詢課表', text: '查詢今天課表' },
    { label: '📝 記錄內容', text: '記錄課程內容' },
  ];

  switch (intent) {
    // 核心功能意圖 - 提供確認/修改/取消操作
    case 'add_course':
    case 'create_recurring_course':
      return [
        { label: '✅ 確認', text: '確認' },
        { label: '❌ 取消操作', text: '取消操作' },
      ];

    case 'set_reminder':
      return [
        { label: '✅ 確認', text: '確認' },
        { label: '❌ 取消操作', text: '取消操作' },
      ];

    case 'record_content':
    case 'add_course_content':
      return [
        { label: '✅ 確認', text: '確認' },
        { label: '❌ 取消操作', text: '取消操作' },
      ];

    case 'cancel_course':
    case 'stop_recurring_course':
      return [
        { label: '✅ 確認刪除', text: '確認' },
        { label: '❌ 取消操作', text: '取消操作' },
      ];

    // 查詢類意圖 - 提供後續操作選項
    case 'query_schedule':
      return null; // 移除非允許情境的 Quick Reply

    case 'query_course_content':
      return null; // 移除

    // 操作性意圖 - 這些已在任務處理器中處理，通常不需要額外 Quick Reply
    case 'confirm_action':
    case 'modify_action':
    case 'cancel_action':
    case 'restart_input':
      return null; // 這些意圖的 Quick Reply 由任務處理器決定

    // 錯誤或未知意圖 - 提供重新開始的選項
    case 'unknown':
      return null; // 移除

    // 預設情況
    default:
      // 如果任務執行成功，提供通用操作
      return null;
  }
}

/**
 * 處理 Postback 事件（按鈕點擊）
 */
async function handlePostbackEvent(event, req = null) {
  try {
    const { data } = event.postback;
    const { userId } = event.source;
    const { replyToken } = event;
    const { info } = require('../utils/logger');
    const traceId = require('../utils/logger').generateTraceId('line');

    info({
      direction: 'inbound', channel: 'line', traceId, userId, postbackData: data,
    });

    // 動態選擇 LINE Service
    const currentLineService = getLineService(userId, req);

    // 解析 postback 資料
    const params = new URLSearchParams(data);
    const action = params.get('action');

    let responseMessage = '操作已處理';

    switch (action) {
      case 'confirm_course':
        responseMessage = '✅ 課程已確認並儲存';
        break;
      case 'modify_course':
        responseMessage = '📝 請告訴我要修改什麼內容';
        break;
      case 'cancel_operation':
        responseMessage = '❌ 操作已取消';
        break;
      default:
        responseMessage = '未知的操作';
    }

    await currentLineService.replyMessage(replyToken, responseMessage);
    info({
      direction: 'outbound', channel: 'line', traceId, userId, textOut: responseMessage,
    });
  } catch (error) {
    console.error('❌ 處理 Postback 事件失敗:', error);
    // 動態選擇 LINE Service 用於錯誤處理
    const currentLineService = getLineService(event.source.userId, req);
    await currentLineService.replyMessage(
      event.replyToken,
      '處理操作時發生錯誤，請稍後再試。',
    );
  }
}

/**
 * 處理用戶關注事件
 */
async function handleFollowEvent(event) {
  try {
    const { userId } = event.source;
    const { replyToken } = event;
    const { info } = require('../utils/logger');
    const traceId = require('../utils/logger').generateTraceId('line');

    info({
      direction: 'inbound', channel: 'line', traceId, userId, event: 'follow',
    });

    // 動態選擇 LINE Service
    const currentLineService = getLineService(userId);

    // 取得用戶資料
    const userProfile = await currentLineService.getUserProfile(userId);
    console.log('👤 用戶資料:', userProfile);

    // 建立或更新家長資料
    const firebaseService = require('../services/firebaseService');
    await firebaseService.getOrCreateParent(userId, userProfile.displayName);

    const welcomeMessage = '👋 歡迎使用課程管理機器人！\n\n我可以幫您：\n📚 安排和管理課程\n📅 查詢課程時間表\n📝 記錄課程內容和照片\n⏰ 設定課程提醒\n\n試試對我說：「小明每週三下午3點數學課」';

    await currentLineService.replyMessage(replyToken, welcomeMessage);
    info({
      direction: 'outbound', channel: 'line', traceId, userId, textOut: welcomeMessage,
    });
  } catch (error) {
    console.error('❌ 處理關注事件失敗:', error);
    // 動態選擇 LINE Service 用於錯誤處理
    const currentLineService = getLineService(event.source.userId);
    await currentLineService.replyMessage(
      event.replyToken,
      '歡迎使用課程管理機器人！',
    );
  }
}

/**
 * 驗證 Webhook 簽名
 */
function verifySignature(body, signature) {
  if (!process.env.LINE_CHANNEL_SECRET) {
    console.error('❌ LINE_CHANNEL_SECRET 未設定');
    return false;
  }

  const channelSecret = process.env.LINE_CHANNEL_SECRET;
  const hash = crypto
    .createHmac('sha256', channelSecret)
    .update(body)
    .digest('base64');

  return hash === signature;
}

/**
 * 主要 Webhook 處理函式
 */
async function handleWebhook(req, res) {
  try {
    // 驗證簽名（允許測試模式略過）
    const signature = req.headers['x-line-signature'];
    const body = JSON.stringify(req.body);
    const allowTestWebhook = (process.env.NODE_ENV !== 'production') && (process.env.ALLOW_TEST_WEBHOOK === 'true' || process.env.USE_MOCK_LINE_SERVICE === 'true' || req.headers['x-qa-mode'] === 'test');

    if (!allowTestWebhook) {
      if (!verifySignature(body, signature)) {
        console.error('❌ Webhook 簽名驗證失敗');
        return res.status(400).json({ error: 'Invalid signature' });
      }
    } else {
      console.log('🧪 測試模式：略過 LINE 簽名驗證');
    }

    const { events } = req.body;
    console.log(`📨 收到 ${events.length} 個事件`);

    // 處理每個事件
    for (const event of events) {
      console.log('📋 事件類型:', event.type);
      console.log('🔍 完整事件 JSON:', JSON.stringify(event, null, 2));

      // QA 測試支援：允許透過標頭請求在測試用例之間重置對話上下文，避免上下文干擾
      try {
        const needReset = req.headers['x-qa-reset-context'] === 'true' || req.headers['x-qa-reset-context'] === 'TRUE';
        if (needReset && event?.source?.userId) {
          console.log('🧹 檢測到 QA 重置上下文請求，清理用戶上下文:', event.source.userId);
          const conversationManager = getConversationManager();
          await conversationManager.clearContext(event.source.userId);
        }
      } catch (e) {
        console.warn('⚠️ 重置上下文處理失敗:', e?.message || e);
      }

      switch (event.type) {
        case 'message':
          if (event.message.type === 'text') {
            await handleTextMessage(event, req);
          } else if (event.message.type === 'image') {
            console.log('📸 圖片訊息完整資料:', JSON.stringify(event.message, null, 2));
            await handleImageMessage(event, req);
          } else {
            console.log('❓ 不支援的訊息類型:', event.message.type);
          }
          break;

        case 'postback':
          await handlePostbackEvent(event, req);
          break;

        case 'follow':
          await handleFollowEvent(event);
          break;

        case 'unfollow':
          console.log('👋 用戶取消關注:', event.source.userId);
          break;

        default:
          console.log('❓ 不支援的事件類型:', event.type);
      }
    }

    res.status(200).json({ status: 'ok' });
  } catch (error) {
    console.error('❌ Webhook 處理失敗:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

module.exports = {
  handleWebhook,
  handleTextMessage,
  handleImageMessage,
  handlePostbackEvent,
  handleFollowEvent,
  verifySignature,
  getLineService,
};
