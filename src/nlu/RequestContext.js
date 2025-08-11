/**
 * RequestContext
 * 封裝一次請求在意圖決策所需的上下文資訊
 */

const { getConversationManager } = require('../conversation/ConversationManager');

function detectCues(text) {
  const clean = String(text || '').trim();
  const has = (kw) => clean.includes(kw);
  const hasAny = (kws) => kws.some((k) => clean.includes(k));
  return {
    isQuestion: /[?？]$/.test(clean) || hasAny(['請問', '嗎', '呢']),
    hasReminder: has('提醒'),
    hasCancel: hasAny(['取消', '刪除', '刪掉']),
  };
}

async function createRequestContext(userId, text, req = null) {
  const cm = getConversationManager();
  const pinnedSession = await cm.getActiveQuerySession(userId);
  const mode = (req && (req.headers['x-qa-mode'] || req.query?.qaMode))
    ? 'qa'
    : (String(userId || '').startsWith('U_test_') ? 'qa' : 'prod');

  return {
    userId,
    text: String(text || ''),
    mode,
    cues: detectCues(text),
    session: {
      pinnedStudent: pinnedSession?.studentName || null,
      pinnedTimeRef: pinnedSession?.timeReference || null,
    },
  };
}

module.exports = {
  createRequestContext,
};


