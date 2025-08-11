/**
 * IntentRouter
 * 決策中心（簡化版）：Safety（提醒/取消）→ AI（主判）→ 簡單規則/回退
 * 目標：讓 Regex/規則只做「確定性」小事，其餘交給 AI。
 */

const { loadIntentRules, parseIntentByRules, parseIntentByAI } = require('../intent/parseIntent');
const { getConversationManager } = require('../conversation/ConversationManager');

function chooseQueryOrAdd(text) {
  const msg = String(text || '');
  const hasAny = (kws) => kws.some((k) => msg.includes(k));
  const addCues = ['要上', '安排', '新增'];
  const timeHints = ['點', ':', '上午', '中午', '下午', '晚上', '每週', '每周', '每天', '每月'];
  const queryCues = ['課表', '查詢', '看一下', '有什麼課', '今天', '明天', '後天', '這週', '下週', '本週', '課程安排', '幾點'];
  const looksLikeAdd = hasAny(addCues) && hasAny(timeHints);
  const looksLikeQuery = hasAny(queryCues);
  if (looksLikeAdd) return 'add_course';
  if (looksLikeQuery) return 'query_schedule';
  return null;
}

async function routeIntent(ctx) {
  const text = ctx.text;

  // 1) Safety（不可覆蓋）
  if (ctx.cues.hasReminder) return { intent: 'set_reminder', source: 'safety' };
  if (ctx.cues.hasCancel) return { intent: 'cancel_course', source: 'safety' };

  // 2) AI 主判（若啟用）
  if (process.env.ENABLE_AI_FALLBACK === 'true') {
    try {
      const aiIntent = await parseIntentByAI(text);
      if (aiIntent && aiIntent !== 'unknown') {
        return { intent: aiIntent, source: 'ai' };
      }
    } catch (_) {}
  }

  // 3) 簡單可確定規則（僅處理明顯情形）
  // 明確的修改詞
  if (/[修改更改改到改成換到換成]/.test(text)) {
    return { intent: 'modify_course', source: 'simple' };
  }
  // 明確的新增（新增詞 + 時間詞）
  const simple = chooseQueryOrAdd(text);
  if (simple === 'add_course') {
    return { intent: 'add_course', source: 'simple' };
  }

  // 4) 規則回退
  const ruleIntent = parseIntentByRules(text);
  if (ruleIntent) return { intent: ruleIntent, source: 'rule' };

  // 5) 最後回退：若像查詢則給查詢，否則 unknown
  if (simple === 'query_schedule') {
    return { intent: 'query_schedule', source: 'simple' };
  }
  return { intent: 'unknown', source: 'fallback' };
}

module.exports = {
  routeIntent,
};


