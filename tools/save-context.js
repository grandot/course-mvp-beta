const fs = require('fs');
const path = require('path');

function nowIsoUtc() {
  return new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
}

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function generateDefaultContent(iso) {
  return [
    '## AI 任務上下文（聊天）',
    '',
    `- 最後更新：${iso}（UTC）`,
    '',
    '### 當前重點',
    '- 簡化 NLU：Safety → AI（主判）→ 簡單規則兜底。',
    '- 線上通過率主因：AI 超時與下游「澄清/導引/複合意圖分解」不足。',
    '- 目前要求：停止所有測試；僅保存聊天上下文。',
    '',
    '### 最近變更（已部署）',
    '- `src/intent/parseIntent.js`：AI 超時 5000ms、信心閾值 0.3、診斷日誌強化。',
    '',
    '### 當前狀態',
    '- AI Fallback 已開；測試暫停。',
    '',
    '### 下一步（待指示）',
    '1) 補澄清邏輯  2) 補導引  3) 複合意圖分解（稍後）',
    '',
  ].join('\n');
}

function updateExistingContent(content, iso) {
  const hasMarker = content.includes('AI 任務上下文（聊天）');
  const replaced = content.replace(/(最後更新：)[^\n]*/g, `$1${iso}（UTC）`);
  if (replaced !== content) return replaced;
  // 若沒有標記或無「最後更新」行，前置一個標頭區塊
  const header = generateDefaultContent(iso);
  return `${header}\n${content}`;
}

function main() {
  const contextPath = path.resolve('AI_TASK_CONTEXT.md');
  const iso = nowIsoUtc();

  let output;
  if (fs.existsSync(contextPath)) {
    const prev = fs.readFileSync(contextPath, 'utf8');
    output = updateExistingContent(prev, iso);
  } else {
    output = generateDefaultContent(iso);
  }

  fs.writeFileSync(contextPath, output, 'utf8');
  console.log(`[save-context] 已更新聊天上下文：${contextPath}`);
}

main();
