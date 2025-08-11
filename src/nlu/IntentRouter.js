/**
 * IntentRouter
 * 單一決策中心：Safety → Query → Modify → Others → AI 補判 → 仲裁
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
  if (ctx.cues.hasReminder) return { intent: 'set_reminder', source: 'override' };
  if (ctx.cues.hasCancel) return { intent: 'cancel_course', source: 'override' };

  // 2) Query（問句 + 查詢詞；僅在同時命中新增+時間才讓新增搶過）
  if (ctx.cues.isQuestion) {
    const q = chooseQueryOrAdd(text);
    if (q === 'query_schedule') return { intent: 'query_schedule', source: 'override' };
  }

  // 3) Modify 快徑
  if (/[修改更改改到改成換到換成]/.test(text)) {
    return { intent: 'modify_course', source: 'override' };
  }

  // 4) 規則決策
  const ruleIntent = parseIntentByRules(text);
  if (ruleIntent) return { intent: ruleIntent, source: 'rule' };

  // 5) AI 補判（僅在啟用時）
  if (process.env.ENABLE_AI_FALLBACK === 'true') {
    try {
      const aiIntent = await parseIntentByAI(text);
      if (aiIntent && aiIntent !== 'unknown') {
        return { intent: aiIntent, source: 'ai' };
      }
    } catch (_) {}
  }

  // 6) 仲裁：缺省 unknown
  return { intent: 'unknown', source: 'rule' };
}

module.exports = {
  routeIntent,
};


