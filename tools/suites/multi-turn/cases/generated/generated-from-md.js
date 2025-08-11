#!/usr/bin/env node
/** 自動生成：multi - 2025-08-11T02:07:48.035Z */

const path = require('path');
const { UnifiedTestRunner } = require(path.resolve(__dirname, '../../../../..', 'qa-system/core/UnifiedTestRunner'));

(async () => {
  const runner = new UnifiedTestRunner({ mode: process.env.QA_MODE || 'both' });
  const tests = [
  {
    "id": "A1.2-A",
    "name": "A1.2-A 缺少學生資訊（啟動補問）",
    "suite": "multi",
    "target": "prod",
    "steps": [
      {
        "input": "明天下午3點要上數學課"
      },
      {
        "input": "小明"
      }
    ],
    "expectedKeywords": [
      "確認",
      "小明",
      "數學課",
      "15:00",
      "成功"
    ],
    "expectedCode": "ADD_COURSE_OK",
    "source": "/Users/jw-mba/Desktop/Projects/course-mvp-beta/QA/plans/plan-comprehensive-2025-08-10.md",
    "collectingSteps": true
  },
  {
    "id": "A1.2-B",
    "name": "A1.2-B 缺少時間資訊（補問）",
    "suite": "multi",
    "target": "prod",
    "steps": [
      {
        "input": "小明要上數學課"
      },
      {
        "input": "明天下午2點"
      }
    ],
    "expectedKeywords": [
      "確認",
      "小明",
      "數學課",
      "14:00",
      "成功"
    ],
    "expectedCode": "ADD_COURSE_OK",
    "source": "/Users/jw-mba/Desktop/Projects/course-mvp-beta/QA/plans/plan-comprehensive-2025-08-10.md",
    "collectingSteps": true
  },
  {
    "id": "A1.2-C",
    "name": "A1.2-C 多輪完整（學生→課程→時間）",
    "suite": "multi",
    "target": "prod",
    "steps": [
      {
        "input": "小明要上課"
      },
      {
        "input": "數學課"
      },
      {
        "input": "明天下午2點"
      }
    ],
    "expectedKeywords": [
      "確認",
      "小明",
      "數學課",
      "14:00",
      "成功"
    ],
    "expectedCode": "ADD_COURSE_OK",
    "source": "/Users/jw-mba/Desktop/Projects/course-mvp-beta/QA/plans/plan-comprehensive-2025-08-10.md",
    "collectingSteps": true
  }
];
  const results = await runner.runTests(tests, process.env.QA_MODE || 'both');
  runner.generateReport(results);
  const ok = (results.local ? results.local.failed === 0 : true) && (results.real ? results.real.failed === 0 : true);
  process.exit(ok ? 0 : 1);
})().catch(e => { console.error('❌ 生成測試執行失敗:', e.message); process.exit(1); });
