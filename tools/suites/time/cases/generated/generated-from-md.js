#!/usr/bin/env node
/** 自動生成：time - 2025-08-10T12:09:17.127Z */

const path = require('path');
const { UnifiedTestRunner } = require(path.resolve(__dirname, '../../../../..', 'qa-system/core/UnifiedTestRunner'));

(async () => {
  const runner = new UnifiedTestRunner({ mode: process.env.QA_MODE || 'both' });
  const tests = [
  {
    "id": "A1.1-B",
    "name": "A1.1-B 時間格式多樣性（美式 PM/AM）",
    "suite": "time",
    "target": "prod",
    "steps": [
      {
        "input": "Lumi後天晚上八點半要上鋼琴課"
      }
    ],
    "expectedKeywords": [
      "確認",
      "Lumi",
      "鋼琴課",
      "8:30"
    ],
    "source": "/Users/jw-mba/Desktop/Projects/course-mvp-beta/QA/plans/plan-comprehensive-2025-08-10.md",
    "collectingSteps": true
  },
  {
    "id": "A1.1-C",
    "name": "A1.1-C 中文數字時間（十點三十分）",
    "suite": "time",
    "target": "prod",
    "steps": [
      {
        "input": "小光明天上午十點三十分英文課"
      }
    ],
    "expectedKeywords": [
      "確認",
      "小光",
      "英文課",
      "10:30"
    ],
    "source": "/Users/jw-mba/Desktop/Projects/course-mvp-beta/QA/plans/plan-comprehensive-2025-08-10.md",
    "collectingSteps": true
  },
  {
    "id": "A1.3-A",
    "name": "A1.3-A 無效時間格式（25點）",
    "suite": "time",
    "target": "prod",
    "steps": [
      {
        "input": "小明明天25點上數學課"
      }
    ],
    "expectedKeywords": [
      "時間格式不正確",
      "重新輸入"
    ],
    "expectedCode": "INVALID_TIME",
    "source": "/Users/jw-mba/Desktop/Projects/course-mvp-beta/QA/plans/plan-comprehensive-2025-08-10.md",
    "collectingSteps": true
  },
  {
    "id": "A1.3-B",
    "name": "A1.3-B 過去時間（昨日下午）",
    "suite": "time",
    "target": "prod",
    "steps": [
      {
        "input": "小明昨天下午2點上數學課"
      }
    ],
    "expectedKeywords": [
      "無法新增過去時間",
      "重新輸入"
    ],
    "expectedCode": "INVALID_PAST_TIME",
    "source": "/Users/jw-mba/Desktop/Projects/course-mvp-beta/QA/plans/plan-comprehensive-2025-08-10.md",
    "collectingSteps": true
  },
  {
    "id": "A2.1-A",
    "name": "A2.1-A 每週重複課程（標準）",
    "suite": "time",
    "target": "prod",
    "steps": [
      {
        "input": "Lumi每週三下午3點要上鋼琴課"
      }
    ],
    "expectedKeywords": [
      "確認",
      "Lumi",
      "鋼琴課",
      "每週三"
    ],
    "source": "/Users/jw-mba/Desktop/Projects/course-mvp-beta/QA/plans/plan-comprehensive-2025-08-10.md",
    "collectingSteps": true
  },
  {
    "id": "A2.1-B",
    "name": "A2.1-B 多天每週重複（一三五）",
    "suite": "time",
    "target": "prod",
    "steps": [
      {
        "input": "小光每週一三五上午10點英文課"
      }
    ],
    "expectedKeywords": [
      "確認",
      "小光",
      "英文課",
      "每週一",
      "每週三",
      "每週五"
    ],
    "source": "/Users/jw-mba/Desktop/Projects/course-mvp-beta/QA/plans/plan-comprehensive-2025-08-10.md",
    "collectingSteps": true
  },
  {
    "id": "A2.1-C",
    "name": "A2.1-C 每日重複課程（功能開啟）",
    "suite": "time",
    "target": "prod",
    "steps": [
      {
        "input": "小明每天早上8點晨練課"
      }
    ],
    "expectedKeywords": [
      "確認",
      "小明",
      "晨練課",
      "每天"
    ],
    "source": "/Users/jw-mba/Desktop/Projects/course-mvp-beta/QA/plans/plan-comprehensive-2025-08-10.md",
    "collectingSteps": true
  },
  {
    "id": "A2.1-D",
    "name": "A2.1-D 每日重複（變體表達）",
    "suite": "time",
    "target": "prod",
    "steps": [
      {
        "input": "安排Lumi每日下午5點瑜伽課"
      }
    ],
    "expectedKeywords": [
      "確認",
      "Lumi",
      "瑜伽課",
      "每天",
      "17:00"
    ],
    "source": "/Users/jw-mba/Desktop/Projects/course-mvp-beta/QA/plans/plan-comprehensive-2025-08-10.md",
    "collectingSteps": true
  },
  {
    "id": "A2.1-E",
    "name": "A2.1-E 每月重複（目前標示未完成）",
    "suite": "time",
    "target": "prod",
    "steps": [
      {
        "input": "小光每月第一個週一上午10點評鑑"
      }
    ],
    "expectedKeywords": [
      "評鑑",
      "每月"
    ],
    "expectedCode": "NOT_IMPLEMENTED_MONTHLY",
    "source": "/Users/jw-mba/Desktop/Projects/course-mvp-beta/QA/plans/plan-comprehensive-2025-08-10.md",
    "collectingSteps": true
  },
  {
    "id": "A2.2-A",
    "name": "A2.2-A 重複關鍵詞識別（定期/每週）",
    "suite": "time",
    "target": "prod",
    "steps": [
      {
        "input": "安排小明定期游泳課每週二晚上7點"
      }
    ],
    "expectedKeywords": [
      "確認",
      "小明",
      "游泳課",
      "每週二",
      "19:00"
    ],
    "source": "/Users/jw-mba/Desktop/Projects/course-mvp-beta/QA/plans/plan-comprehensive-2025-08-10.md",
    "collectingSteps": true
  },
  {
    "id": "A2.2-B",
    "name": "A2.2-B 模糊重複表達（每個星期四）",
    "suite": "time",
    "target": "prod",
    "steps": [
      {
        "input": "Lumi固定每個星期四下午兩點鋼琴課"
      }
    ],
    "expectedKeywords": [
      "確認",
      "Lumi",
      "鋼琴課",
      "每週四",
      "14:00"
    ],
    "source": "/Users/jw-mba/Desktop/Projects/course-mvp-beta/QA/plans/plan-comprehensive-2025-08-10.md",
    "collectingSteps": true
  },
  {
    "id": "A2.2-C",
    "name": "A2.2-C 重複類型區分（daily/weekly/monthly）",
    "suite": "time",
    "target": "prod",
    "steps": [
      {
        "input": "小明每天早上8點英文課"
      },
      {
        "input": "小明每週一早上8點英文課"
      },
      {
        "input": "小明每月1號早上8點英文課"
      }
    ],
    "expectedKeywords": [
      "每月",
      "1號",
      "08:00"
    ],
    "source": "/Users/jw-mba/Desktop/Projects/course-mvp-beta/QA/plans/plan-comprehensive-2025-08-10.md",
    "collectingSteps": true
  },
  {
    "id": "A2.2-D",
    "name": "A2.2-D 功能開關（每日重複關閉時降級）",
    "suite": "time",
    "target": "prod",
    "steps": [
      {
        "input": "小明每天早上8點英文課"
      }
    ],
    "expectedKeywords": [
      "英文課",
      "08:00"
    ],
    "source": "/Users/jw-mba/Desktop/Projects/course-mvp-beta/QA/plans/plan-comprehensive-2025-08-10.md",
    "collectingSteps": true
  },
  {
    "id": "A2.2-E",
    "name": "A2.2-E 重複課時間衝突處理",
    "suite": "time",
    "target": "prod",
    "steps": [
      {
        "input": "小明每天下午2點數學課"
      },
      {
        "input": "小明每天下午2點英文課"
      }
    ],
    "expectedKeywords": [
      "時間衝突",
      "覆蓋"
    ],
    "expectedCode": "TIME_CONFLICT",
    "source": "/Users/jw-mba/Desktop/Projects/course-mvp-beta/QA/plans/plan-comprehensive-2025-08-10.md",
    "collectingSteps": true
  }
];
  const results = await runner.runTests(tests, process.env.QA_MODE || 'both');
  runner.generateReport(results);
  const ok = (results.local ? results.local.failed === 0 : true) && (results.real ? results.real.failed === 0 : true);
  process.exit(ok ? 0 : 1);
})().catch(e => { console.error('❌ 生成測試執行失敗:', e.message); process.exit(1); });
