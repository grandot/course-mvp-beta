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
  
  return keywords.some(keyword => message.includes(keyword));
}

/**
 * 檢查訊息是否匹配模式
 */
function matchesPatterns(message, patterns) {
  if (!patterns || patterns.length === 0) return false;
  
  return patterns.some(pattern => {
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
  
  return requiredKeywords.some(keyword => message.includes(keyword));
}

/**
 * 檢查是否包含排除詞
 */
function hasExclusions(message, exclusions) {
  if (!exclusions || exclusions.length === 0) return false;
  
  return exclusions.some(exclusion => message.includes(exclusion));
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
        rule
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
    console.log('🔍 意圖候選列表:', candidates.map(c => `${c.intent}(${c.score})`).join(', '));
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
判斷以下語句的意圖，回傳 JSON 格式：

語句：「${message}」

可能的意圖：
- add_course: 新增課程
- create_recurring_course: 創建重複課程  
- query_schedule: 查詢課表
- set_reminder: 設定提醒
- cancel_course: 取消課程
- record_content: 記錄課程內容
- modify_course: 修改課程
- unknown: 無法識別

回傳格式：{"intent": "意圖名稱", "confidence": 0.8}
如果不確定，請回傳：{"intent": "unknown", "confidence": 0.0}
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
 * 主要意圖解析函式
 */
async function parseIntent(message) {
  if (!message || typeof message !== 'string') {
    return 'unknown';
  }

  const cleanMessage = message.trim();
  console.log('🎯 開始解析意圖:', cleanMessage);

  // 第一階段：規則匹配
  const ruleBasedIntent = parseIntentByRules(cleanMessage);
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

module.exports = {
  parseIntent,
  loadIntentRules,
  parseIntentByRules,
  parseIntentByAI
};