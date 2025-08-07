const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

/**
 * 解析使用者意圖
 * 三層識別策略：規則匹配 -> 優先級排序 -> OpenAI 備援
 */

// 載入意圖規則配置
let intentRules = null;
function loadIntentRules() {
  if (!intentRules) {
    try {
      const rulesPath = path.join(__dirname, '../../config/mvp/intent-rules.yaml');
      const fileContent = fs.readFileSync(rulesPath, 'utf8');
      intentRules = yaml.load(fileContent);
      console.log('✅ 意圖規則載入成功，共', Object.keys(intentRules).length, '個意圖');
    } catch (error) {
      console.error('❌ 載入意圖規則失敗:', error);
      intentRules = {};
    }
  }
  return intentRules;
}

/**
 * 檢查訊息是否匹配關鍵詞
 */
function matchesKeywords(message, keywords) {
  if (!keywords || keywords.length === 0) return false;

  return keywords.some((keyword) => message.includes(keyword));
}

/**
 * 檢查訊息是否匹配模式
 */
function matchesPatterns(message, patterns) {
  if (!patterns || patterns.length === 0) return false;

  return patterns.some((pattern) => {
    try {
      const regex = new RegExp(pattern);
      return regex.test(message);
    } catch (error) {
      console.warn('⚠️ 無效的正則表達式模式:', pattern);
      return false;
    }
  });
}

/**
 * 檢查是否包含必要關鍵詞
 */
function hasRequiredKeywords(message, requiredKeywords) {
  if (!requiredKeywords || requiredKeywords.length === 0) return true;

  return requiredKeywords.some((keyword) => message.includes(keyword));
}

/**
 * 檢查是否包含排除詞
 */
function hasExclusions(message, exclusions) {
  if (!exclusions || exclusions.length === 0) return false;

  return exclusions.some((exclusion) => message.includes(exclusion));
}

/**
 * 使用規則匹配識別意圖
 */
function parseIntentByRules(message) {
  const rules = loadIntentRules();
  const candidates = [];

  // 遍歷所有意圖規則
  for (const [intentName, rule] of Object.entries(rules)) {
    let score = 0;
    let matched = false;

    // 1. 檢查關鍵詞匹配
    if (matchesKeywords(message, rule.keywords)) {
      score += 10;
      matched = true;
    }

    // 2. 檢查模式匹配
    if (matchesPatterns(message, rule.patterns)) {
      score += 15;
      matched = true;
    }

    // 3. 檢查必要關鍵詞
    if (!hasRequiredKeywords(message, rule.required_keywords)) {
      continue; // 不滿足必要關鍵詞，跳過此意圖
    }

    // 4. 檢查排除詞
    if (hasExclusions(message, rule.exclusions)) {
      continue; // 包含排除詞，跳過此意圖
    }

    // 5. 優先級加權
    const priority = rule.priority || 10;
    score += (20 - priority); // 優先級數字越小，分數越高

    if (matched && score > 0) {
      candidates.push({
        intent: intentName,
        score,
        priority,
        rule,
      });
    }
  }

  // 按分數排序，取最高分
  candidates.sort((a, b) => {
    if (b.score !== a.score) {
      return b.score - a.score; // 分數高的優先
    }
    return a.priority - b.priority; // 分數相同時，優先級數字小的優先
  });

  if (process.env.DEBUG_INTENT_PARSING === 'true') {
    console.log('🔍 意圖候選列表:', candidates.map((c) => `${c.intent}(${c.score})`).join(', '));
  }

  return candidates.length > 0 ? candidates[0].intent : null;
}

/**
 * 使用 OpenAI API 作為備援識別
 */
async function parseIntentByAI(message) {
  try {
    const openaiService = require('../services/openaiService');

    const prompt = `
你是課程管理聊天機器人的意圖分析師。僅處理課程相關語句，嚴格排除無關查詢。

語句：「${message}」

意圖判斷標準：
- 必須明確涉及課程、學習、上課、學生等教育相關內容
- 天氣、心情、狀況、時間等非課程查詢一律識別為 unknown
- 對模糊或不確定的語句設置低信心度

可能的意圖：
- add_course: 新增單次課程（包含明確時間安排）
- create_recurring_course: 創建重複課程（包含重複頻率）
- query_schedule: 查詢課程安排（明確詢問課表或課程）
- set_reminder: 設定課程提醒
- cancel_course: 取消課程
- record_content: 記錄課程內容或學習成果
- modify_course: 修改課程資訊
- unknown: 無關課程或無法識別

❌ 非課程相關語句範例：
"今天天氣如何" → unknown (天氣查詢)
"我心情不好" → unknown (情緒表達)
"現在幾點" → unknown (時間查詢)

✅ 課程相關語句範例：
"今天有什麼課" → query_schedule
"小明數學課表現如何" → record_content
"安排明天英文課" → add_course

回傳格式（僅JSON）：
{"intent": "意圖名稱", "confidence": 0.0到1.0的數字}

對於非課程相關語句，必須回傳：
{"intent": "unknown", "confidence": 0.0}
`;

    const response = await openaiService.chatCompletion(prompt);
    const result = JSON.parse(response);

    if (result.confidence >= 0.6) {
      console.log('🤖 AI 識別意圖:', result.intent, '信心度:', result.confidence);
      return result.intent;
    }

    return 'unknown';
  } catch (error) {
    console.error('❌ AI 意圖識別失敗:', error);
    return 'unknown';
  }
}

/**
 * 主要意圖解析函式（支援上下文感知）
 * @param {string} message - 用戶訊息
 * @param {string} userId - 用戶 ID（用於取得對話上下文）
 * @returns {Promise<string>} 識別的意圖
 */
async function parseIntent(message, userId = null) {
  if (!message || typeof message !== 'string') {
    return 'unknown';
  }

  const cleanMessage = message.trim();
  console.log('🎯 開始解析意圖:', cleanMessage, userId ? `(用戶: ${userId})` : '');

  // 優先檢查期待輸入狀態（補充缺失資訊）
  if (userId) {
    const { getConversationManager } = require('../conversation/ConversationManager');
    const conversationManager = getConversationManager();

    const context = await conversationManager.getContext(userId);
    if (context && context.state.expectingInput.length > 0) {
      console.log('🧠 檢測到期待輸入狀態:', context.state.expectingInput);
      console.log('📋 待補充資料:', context.state.pendingData);

      // 🔄 優先嘗試在原意圖上下文中完整解析
      const completeIntent = await tryCompleteOriginalIntent(cleanMessage, context, userId);
      if (completeIntent) {
        console.log('✅ 上下文完整解析成功:', completeIntent);
        return completeIntent;
      }

      // 完整解析失敗，才進入補充模式
      const supplementIntent = await handleSupplementInput(cleanMessage, context, userId);
      if (supplementIntent) {
        console.log('✅ 補充資訊識別成功:', supplementIntent);
        return supplementIntent;
      }
    }
  }

  // 第一階段：規則匹配
  const ruleBasedIntent = parseIntentByRules(cleanMessage);

  // 檢查是否需要對話上下文
  if (ruleBasedIntent && userId) {
    const needsContext = await checkIfNeedsContext(ruleBasedIntent, cleanMessage);
    if (needsContext) {
      const contextAwareIntent = await parseIntentWithContext(ruleBasedIntent, cleanMessage, userId);
      if (contextAwareIntent) {
        console.log('✅ 上下文感知識別成功:', contextAwareIntent);
        return contextAwareIntent;
      }
    }
  }

  if (ruleBasedIntent) {
    console.log('✅ 規則匹配成功:', ruleBasedIntent);
    return ruleBasedIntent;
  }

  // 第二階段：AI 備援（如果啟用）
  if (process.env.ENABLE_AI_FALLBACK === 'true') {
    console.log('🤖 啟用 AI 備援識別...');
    const aiBasedIntent = await parseIntentByAI(cleanMessage);
    if (aiBasedIntent !== 'unknown') {
      return aiBasedIntent;
    }
  }

  console.log('❓ 無法識別意圖');
  return 'unknown';
}

/**
 * 檢查意圖是否需要對話上下文
 * @param {string} intent - 意圖名稱
 * @param {string} message - 用戶訊息
 * @returns {Promise<boolean>}
 */
async function checkIfNeedsContext(intent, message) {
  const rules = loadIntentRules();
  const rule = rules[intent];

  // 檢查意圖規則中是否標記為需要上下文
  if (rule && rule.requires_context) {
    return true;
  }

  // 檢查是否為操作性意圖
  const contextRequiredIntents = [
    'confirm_action', 'modify_action', 'cancel_action',
    'restart_input', 'correction_intent',
  ];

  return contextRequiredIntents.includes(intent);
}

/**
 * 處理補充缺失資訊的輸入
 * @param {string} message - 用戶訊息
 * @param {object} context - 對話上下文
 * @param {string} userId - 用戶ID
 * @returns {Promise<string|null>}
 */
async function handleSupplementInput(message, context, userId) {
  try {
    const { expectingInput, pendingData } = context.state;

    if (!pendingData || !pendingData.slots || !pendingData.slots.intent) {
      console.log('⚠️ 無待處理的意圖資料');
      return null;
    }

    // 🔍 檢查是否為明確的意圖切換（優先於補充判斷）
    const explicitIntents = ['課表', '查詢', '新增', '刪除', '取消', '設定', '記錄'];
    if (explicitIntents.some(intent => message.includes(intent))) {
      console.log('🔄 檢測到明確意圖切換，清除期待狀態:', message);
      
      // 清除期待輸入狀態
      const { getConversationManager } = require('../conversation/ConversationManager');
      const conversationManager = getConversationManager();
      await conversationManager.clearExpectedInput(userId);
      
      return null; // 返回null讓系統進行正常意圖識別
    }

    // 🕒 檢查期待狀態是否超時（超過2分鐘自動清除）
    if (pendingData.timestamp && Date.now() - pendingData.timestamp > 2 * 60 * 1000) {
      console.log('⏰ 期待輸入狀態已超時，清除狀態');
      
      // 清除超時的期待輸入狀態
      const { getConversationManager } = require('../conversation/ConversationManager');
      const conversationManager = getConversationManager();
      await conversationManager.clearExpectedInput(userId);
      
      return null;
    }

    // 檢查期待的輸入類型
    if (expectingInput.includes('student_name_input')) {
      // 假設用戶輸入的是學生姓名（簡單的姓名檢查）
      if (message.length >= 1 && message.length <= 10 && !message.includes('？') && !message.includes('?')) {
        console.log('✅ 識別為學生姓名補充:', message);
        return 'supplement_student_name';
      }
    }

    if (expectingInput.includes('course_name_input')) {
      // 假設用戶輸入的是課程名稱
      if (message.length >= 1 && message.length <= 20) {
        console.log('✅ 識別為課程名稱補充:', message);
        return 'supplement_course_name';
      }
    }

    if (expectingInput.includes('schedule_time_input')) {
      // 檢查是否包含時間相關詞彙
      if (message.includes('點') || message.includes(':') || /\d+/.test(message)) {
        console.log('✅ 識別為上課時間補充:', message);
        return 'supplement_schedule_time';
      }
    }

    if (expectingInput.includes('course_date_input')) {
      // 檢查是否包含日期相關詞彙
      if (message.includes('明天') || message.includes('後天') || message.includes('今天')
          || message.includes('月') || message.includes('日') || /\d+/.test(message)) {
        console.log('✅ 識別為課程日期補充:', message);
        return 'supplement_course_date';
      }
    }

    if (expectingInput.includes('day_of_week_input')) {
      // 檢查是否包含星期相關詞彙
      if (message.includes('週') || message.includes('星期') || message.includes('禮拜')) {
        console.log('✅ 識別為星期補充:', message);
        return 'supplement_day_of_week';
      }
    }

    console.log('⚠️ 無法識別為期待的補充資訊類型');
    return null;
  } catch (error) {
    console.error('❌ 處理補充輸入失敗:', error);
    return null;
  }
}

/**
 * 基於上下文的意圖識別
 * @param {string} intent - 初步識別的意圖
 * @param {string} message - 用戶訊息
 * @param {string} userId - 用戶 ID
 * @returns {Promise<string|null>}
 */
async function parseIntentWithContext(intent, message, userId) {
  try {
    const { getConversationManager } = require('../conversation/ConversationManager');
    const conversationManager = getConversationManager();

    // 取得對話上下文
    const context = await conversationManager.getContext(userId);
    if (!context) {
      console.log('⚠️ 無對話上下文，無法進行上下文感知識別');
      return null;
    }

    console.log('📋 對話上下文狀態:', {
      currentFlow: context.state.currentFlow,
      expectingInput: context.state.expectingInput,
      lastActionsCount: Object.keys(context.state.lastActions).length,
    });

    // 處理操作性意圖
    if (['confirm_action', 'modify_action', 'cancel_action'].includes(intent)) {
      // 檢查是否有等待處理的操作
      const hasLastActions = Object.keys(context.state.lastActions).length > 0;
      const isExpectingOperation = context.state.expectingInput.some((input) => ['confirmation', 'modification', 'cancellation'].includes(input));

      if (!hasLastActions && !isExpectingOperation) {
        console.log('⚠️ 沒有可操作的上下文，降級處理');
        return 'unknown'; // 沒有操作上下文時，這些意圖無效
      }

      return intent; // 有上下文，保持原意圖
    }

    // 處理糾錯意圖
    if (intent === 'correction_intent') {
      const hasRecentAction = Object.keys(context.state.lastActions).length > 0;
      if (!hasRecentAction) {
        console.log('⚠️ 沒有可糾正的操作，降級處理');
        return 'unknown';
      }
      return intent;
    }

    return intent; // 其他情況保持原意圖
  } catch (error) {
    console.error('❌ 上下文感知識別失敗:', error);
    return null;
  }
}

/**
 * 嘗試在原意圖上下文中完整解析用戶輸入
 * @param {string} message - 用戶訊息
 * @param {object} context - 對話上下文
 * @param {string} userId - 用戶ID
 * @returns {Promise<string|null>}
 */
async function tryCompleteOriginalIntent(message, context, userId) {
  try {
    const { pendingData } = context.state;
    
    if (!pendingData || !pendingData.slots || !pendingData.slots.intent) {
      console.log('⚠️ 無待處理的意圖資料');
      return null;
    }

    const originalIntent = pendingData.slots.intent;
    const existingSlots = pendingData.slots.existingSlots || {};
    
    console.log('🔄 嘗試在原意圖中完整解析:', originalIntent);
    console.log('📋 現有 slots:', existingSlots);

    // 重用現有的 extractSlots 函數在原意圖上下文中解析
    const { extractSlots } = require('./extractSlots');
    const newSlots = await extractSlots(message, originalIntent, userId);
    
    // 合併現有slots和新解析的slots
    const mergedSlots = { ...existingSlots, ...newSlots };
    console.log('🔗 合併後的 slots:', mergedSlots);

    // 檢查是否包含足夠資訊執行原意圖
    if (isCompleteForIntent(mergedSlots, originalIntent)) {
      console.log('✅ 資訊完整，可執行原意圖');
      
      // 清除期待輸入狀態
      const conversationManager = getConversationManager();
      await conversationManager.clearExpectedInput(userId);
      
      // 更新對話上下文的slots，直接更新context
      const context = await conversationManager.getContext(userId);
      context.state.pendingData = {
        ...context.state.pendingData,
        slots: {
          intent: originalIntent,
          existingSlots: mergedSlots,
          missingFields: []
        },
        timestamp: Date.now()
      };
      await conversationManager.saveContext(userId, context);
      
      return originalIntent;
    }
    
    console.log('📝 資訊仍不完整，繼續等待補充');
    return null;
    
  } catch (error) {
    console.error('❌ 原意圖完整解析失敗:', error);
    return null;
  }
}

/**
 * 檢查slots是否足夠完整以執行指定意圖
 * @param {object} slots - 槽位資料
 * @param {string} intent - 意圖名稱
 * @returns {boolean}
 */
function isCompleteForIntent(slots, intent) {
  switch (intent) {
    case 'add_course':
      // 新增課程需要：學生姓名、課程名稱、時間資訊（scheduleTime或courseDate+dayOfWeek）
      const hasStudent = slots.studentName && slots.studentName.trim();
      const hasCourse = slots.courseName && slots.courseName.trim();
      const hasTime = slots.scheduleTime || (slots.courseDate && slots.dayOfWeek);
      
      return hasStudent && hasCourse && hasTime;
      
    case 'query_schedule':
      // 查詢課程只需要一個參數即可
      return slots.studentName || slots.courseName || slots.courseDate;
      
    case 'record_content':
      // 記錄內容需要學生姓名和課程名稱
      return slots.studentName && slots.courseName;
      
    default:
      // 其他意圖的完整性檢查
      return Object.keys(slots).length > 0;
  }
}

module.exports = {
  parseIntent,
  loadIntentRules,
  parseIntentByRules,
  parseIntentByAI,
};
