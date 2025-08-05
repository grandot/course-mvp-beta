const crypto = require('crypto');
const { parseIntent } = require('../intent/parseIntent');
const { extractSlots } = require('../intent/extractSlots');
const lineService = require('../services/lineService');

/**
 * LINE Bot Webhook 處理器
 * 負責接收和處理來自 LINE 平台的所有事件
 */

/**
 * 執行對應的任務處理器
 */
async function executeTask(intent, slots, userId, messageEvent) {
  try {
    console.log('🎯 執行任務:', intent);
    console.log('📋 參數:', slots);

    // 動態載入對應的任務處理器
    const taskHandlers = {
      add_course: require('../tasks/handle_add_course_task'),
      create_recurring_course: require('../tasks/handle_add_course_task'), // 使用同一個處理器
      query_schedule: require('../tasks/handle_query_schedule_task'),
      set_reminder: require('../tasks/handle_set_reminder_task'),
      cancel_course: require('../tasks/handle_cancel_course_task'),
      record_content: require('../tasks/handle_record_content_task'),
      add_course_content: require('../tasks/handle_record_content_task'), // 使用同一個處理器
    };

    const handler = taskHandlers[intent];
    if (!handler) {
      console.log('❓ 找不到對應的任務處理器:', intent);
      return {
        success: false,
        message: '抱歉，我還不會處理這種請求。請試試其他說法，或告訴我具體要做什麼？',
      };
    }

    // 呼叫任務處理器
    const result = await handler(slots, userId, messageEvent);
    return result;
  } catch (error) {
    console.error('❌ 任務執行失敗:', error);
    return {
      success: false,
      message: '處理請求時發生錯誤，請稍後再試。',
    };
  }
}

/**
 * 處理文字訊息
 */
async function handleTextMessage(event) {
  try {
    const userMessage = event.message.text;
    const { userId } = event.source;
    const { replyToken } = event;

    console.log('📝 收到文字訊息:', userMessage);
    console.log('👤 用戶ID:', userId);

    // 第一步：意圖識別
    const intent = await parseIntent(userMessage);
    console.log('🎯 識別意圖:', intent);

    if (intent === 'unknown') {
      await lineService.replyMessage(
        replyToken,
        '抱歉，我不太理解您的意思。\n\n您可以試試：\n• 「小明每週三下午3點數學課」\n• 「查詢小明今天的課程」\n• 「記錄昨天英文課的內容」\n• 「提醒我明天的鋼琴課」',
      );
      return;
    }

    // 第二步：實體提取
    const slots = await extractSlots(userMessage, intent, userId);
    console.log('📋 提取結果:', slots);

    // 第三步：執行任務
    const result = await executeTask(intent, slots, userId, event);
    console.log('✅ 任務結果:', result);

    // 第四步：回應用戶
    if (result.success) {
      // 成功時可能需要加上操作按鈕
      const quickReply = getQuickReplyForIntent(intent);
      await lineService.replyMessage(replyToken, result.message, quickReply);
    } else {
      await lineService.replyMessage(replyToken, result.message);
    }
  } catch (error) {
    console.error('❌ 處理文字訊息失敗:', error);
    await lineService.replyMessage(
      event.replyToken,
      '處理訊息時發生錯誤，請稍後再試。',
    );
  }
}

/**
 * 處理圖片訊息
 */
async function handleImageMessage(event) {
  try {
    const messageId = event.message.id;
    const { userId } = event.source;
    const { replyToken } = event;

    console.log('🖼️ 收到圖片訊息:', messageId);
    console.log('👤 用戶ID:', userId);

    // 下載圖片內容
    const imageBuffer = await lineService.getMessageContent(messageId);

    // 處理圖片上傳（記錄到課程內容）
    const handle_record_content_task = require('../tasks/handle_record_content_task');

    const slots = {
      imageBuffer,
      messageId,
      content: '課堂照片', // 預設內容
      timeReference: 'today', // 預設為今天
    };

    const result = await handle_record_content_task(slots, userId, event);

    // 提供圖片相關的快捷回覆按鈕
    const quickReply = [
      { label: '📝 補充說明', text: '補充課程內容' },
      { label: '📚 指定課程', text: '指定課程' },
      { label: '📅 查詢記錄', text: '查詢課程記錄' },
    ];

    await lineService.replyMessage(replyToken, result.message, quickReply);
  } catch (error) {
    console.error('❌ 處理圖片訊息失敗:', error);
    await lineService.replyMessage(
      event.replyToken,
      '處理圖片時發生錯誤，請稍後再試。',
    );
  }
}

/**
 * 根據意圖提供快捷回覆按鈕
 */
function getQuickReplyForIntent(intent) {
  const commonActions = [
    { label: '📚 新增課程', text: '新增課程' },
    { label: '📅 查詢課表', text: '查詢課表' },
    { label: '📝 記錄內容', text: '記錄課程內容' },
  ];

  switch (intent) {
    case 'add_course':
    case 'create_recurring_course':
      return [
        { label: '✅ 確認', text: '確認' },
        { label: '📝 修改', text: '修改' },
        { label: '❌ 取消', text: '取消操作' },
      ];

    case 'query_schedule':
      return [
        { label: '📚 新增課程', text: '新增課程' },
        { label: '📝 記錄內容', text: '記錄課程內容' },
        { label: '⏰ 設定提醒', text: '設定提醒' },
      ];

    case 'record_content':
      return [
        { label: '📸 上傳照片', text: '上傳課程照片' },
        { label: '📝 補充內容', text: '補充課程內容' },
        { label: '📅 查詢記錄', text: '查詢課程記錄' },
      ];

    default:
      return commonActions;
  }
}

/**
 * 處理 Postback 事件（按鈕點擊）
 */
async function handlePostbackEvent(event) {
  try {
    const { data } = event.postback;
    const { userId } = event.source;
    const { replyToken } = event;

    console.log('🔘 收到 Postback 事件:', data);

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

    await lineService.replyMessage(replyToken, responseMessage);
  } catch (error) {
    console.error('❌ 處理 Postback 事件失敗:', error);
    await lineService.replyMessage(
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

    console.log('👋 新用戶關注:', userId);

    // 取得用戶資料
    const userProfile = await lineService.getUserProfile(userId);
    console.log('👤 用戶資料:', userProfile);

    // 建立或更新家長資料
    const firebaseService = require('../services/firebaseService');
    await firebaseService.getOrCreateParent(userId, userProfile.displayName);

    const welcomeMessage = '👋 歡迎使用課程管理機器人！\n\n我可以幫您：\n📚 安排和管理課程\n📅 查詢課程時間表\n📝 記錄課程內容和照片\n⏰ 設定課程提醒\n\n試試對我說：「小明每週三下午3點數學課」';

    await lineService.replyMessage(replyToken, welcomeMessage);
  } catch (error) {
    console.error('❌ 處理關注事件失敗:', error);
    await lineService.replyMessage(
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
    // 驗證簽名
    const signature = req.headers['x-line-signature'];
    const body = JSON.stringify(req.body);

    if (!verifySignature(body, signature)) {
      console.error('❌ Webhook 簽名驗證失敗');
      return res.status(400).json({ error: 'Invalid signature' });
    }

    const { events } = req.body;
    console.log(`📨 收到 ${events.length} 個事件`);

    // 處理每個事件
    for (const event of events) {
      console.log('📋 事件類型:', event.type);
      console.log('🔍 完整事件 JSON:', JSON.stringify(event, null, 2));

      switch (event.type) {
        case 'message':
          if (event.message.type === 'text') {
            await handleTextMessage(event);
          } else if (event.message.type === 'image') {
            console.log('📸 圖片訊息完整資料:', JSON.stringify(event.message, null, 2));
            await handleImageMessage(event);
          } else {
            console.log('❓ 不支援的訊息類型:', event.message.type);
          }
          break;

        case 'postback':
          await handlePostbackEvent(event);
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
};
