/**
 * TagMarkdownParser - 解析基於 @id/@suite/@steps/@expect 標註的測試情境
 */

const fs = require('fs').promises;
const path = require('path');

class TagMarkdownParser {
  async parseFiles(mdPaths) {
    const all = [];
    for (const p of mdPaths) {
      try {
        const content = await fs.readFile(p, 'utf-8');
        const cases = this.parse(content, p);
        all.push(...cases);
      } catch (e) {
        console.warn(`⚠️ 無法讀取 ${p}: ${e.message}`);
      }
    }
    return all;
  }

  parse(md, sourcePath = '') {
    const lines = md.split(/\r?\n/);
    const cases = [];
    let current = null;
    let currentHeading = '';

    const flush = () => {
      if (!current) return;
      // 預設名稱
      if (!current.name) current.name = currentHeading || current.id || '未命名測試';
      // 步驟正規化
      if (current.steps && current.steps.length === 0 && current.input) {
        current.steps = [{ input: current.input }];
      }
      // 關鍵詞清洗
      if (typeof current.expectedKeywords === 'string') {
        current.expectedKeywords = current.expectedKeywords
          .split(/,|、/).map(s => s.trim()).filter(Boolean);
      }
      cases.push(current);
      current = null;
    };

    for (let raw of lines) {
      const line = raw.trim();
      if (line.startsWith('### ')) {
        // 新段落開始
        flush();
        currentHeading = line.replace(/^###\s+/, '').trim();
        continue;
      }

      const mId = line.match(/^@id:\s*(.+)$/i);
      if (mId) {
        flush();
        current = {
          id: mId[1].trim(),
          name: currentHeading || '',
          suite: '',
          target: '',
          steps: [],
          expectedKeywords: [],
          expectedCode: undefined,
          expectedSuccess: undefined,
          expectedIntent: undefined,
          expectedQuickReplyIncludes: undefined,
          source: sourcePath
        };
        continue;
      }

      if (!current) continue; // 未進入一個用例區塊

      const mSuite = line.match(/^@suite:\s*(.+)$/i);
      if (mSuite) { current.suite = mSuite[1].trim(); continue; }

      const mTarget = line.match(/^@target:\s*(.+)$/i);
      if (mTarget) { current.target = mTarget[1].trim(); continue; }

      // 單行步驟: "- 內容" 或 "1) 內容"
      const mStepBullet = line.match(/^(?:-\s+|\d+\)\s*)(.+)$/);
      if (mStepBullet && (current.collectingSteps || /@steps:/.test(line) || true)) {
        current.steps.push({ input: mStepBullet[1].trim() });
        continue;
      }

      if (/^@steps\s*:/.test(line)) {
        current.collectingSteps = true;
        continue;
      }

      // 期望：關鍵詞
      const mExpectKw = line.match(/^@expect\.keywords(?:\(step=\d+\))?\s*:\s*(.+)$/i);
      if (mExpectKw) {
        const kw = mExpectKw[1].trim();
        // 記錄為全局 expectedKeywords；若未來需要 step 級別可擴展
        current.expectedKeywords = kw.split(/,|、/).map(s => s.trim()).filter(Boolean);
        continue;
      }

      // 期望：結構化 code
      const mExpectCode = line.match(/^@expect\.code\s*:\s*([A-Z0-9_\-]+)$/i);
      if (mExpectCode) { current.expectedCode = mExpectCode[1].trim(); continue; }

      // 期望：success true/false
      const mExpectSuccess = line.match(/^@expect\.success\s*:\s*(true|false|1|0|yes|no)$/i);
      if (mExpectSuccess) {
        const v = mExpectSuccess[1].toLowerCase();
        current.expectedSuccess = (v === 'true' || v === '1' || v === 'yes');
        continue;
      }

      // 期望：意圖名稱
      const mExpectIntent = line.match(/^@expect\.intent\s*:\s*([a-z0-9_]+)$/i);
      if (mExpectIntent) { current.expectedIntent = mExpectIntent[1].trim(); continue; }

      // 期望：QuickReply 應包含（以逗號/頓號分隔）
      const mExpectQR = line.match(/^@expect\.quickReplyIncludes\s*:\s*(.+)$/i);
      if (mExpectQR) {
        current.expectedQuickReplyIncludes = mExpectQR[1]
          .split(/,|、/).map(s => s.trim()).filter(Boolean);
        continue;
      }
    }

    flush();
    return cases;
  }
}

module.exports = { TagMarkdownParser };


