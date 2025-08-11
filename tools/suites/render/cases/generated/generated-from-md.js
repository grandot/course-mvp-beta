#!/usr/bin/env node
/** 自動生成：render - 2025-08-11T02:07:48.030Z */

const path = require('path');
const { UnifiedTestRunner } = require(path.resolve(__dirname, '../../../../..', 'qa-system/core/UnifiedTestRunner'));

(async () => {
  const runner = new UnifiedTestRunner({ mode: process.env.QA_MODE || 'both' });
  const tests = [
  {
    "id": "A1.1-A",
    "name": "A1.1-A 新增單次課程（標準格式）",
    "suite": "render",
    "target": "prod",
    "steps": [
      {
        "input": "小明明天下午2點要上數學課"
      }
    ],
    "expectedKeywords": [
      "確認",
      "小明",
      "數學課",
      "成功"
    ],
    "expectedCode": "ADD_COURSE_OK",
    "source": "/Users/jw-mba/Desktop/Projects/course-mvp-beta/QA/plans/plan-comprehensive-2025-08-10.md",
    "collectingSteps": true
  },
  {
    "id": "A1.3-C",
    "name": "A1.3-C 模糊語句（意圖不明）",
    "suite": "render",
    "target": "prod",
    "steps": [
      {
        "input": "我想要什麼時候上課來著"
      }
    ],
    "expectedKeywords": [
      "不太理解",
      "請提供具體"
    ],
    "expectedCode": "UNKNOWN_HELP",
    "source": "/Users/jw-mba/Desktop/Projects/course-mvp-beta/QA/plans/plan-comprehensive-2025-08-10.md",
    "collectingSteps": true
  },
  {
    "id": "A3.1-A",
    "name": "A3.1-A 意圖邊界（查詢/新增分流）",
    "suite": "render",
    "target": "prod",
    "steps": [
      {
        "input": "我想了解一下課程安排的情況"
      }
    ],
    "expectedKeywords": [
      "查詢",
      "新增",
      "指引"
    ],
    "source": "/Users/jw-mba/Desktop/Projects/course-mvp-beta/QA/plans/plan-comprehensive-2025-08-10.md",
    "collectingSteps": true
  },
  {
    "id": "A3.1-B",
    "name": "A3.1-B 複合意圖處理（先新增再查詢）",
    "suite": "render",
    "target": "prod",
    "steps": [
      {
        "input": "幫我安排小明數學課，然後查一下他今天有什麼課"
      }
    ],
    "expectedKeywords": [
      "一次",
      "一個",
      "請先",
      "具體"
    ],
    "source": "/Users/jw-mba/Desktop/Projects/course-mvp-beta/QA/plans/plan-comprehensive-2025-08-10.md",
    "collectingSteps": true
  },
  {
    "id": "A3.2-A",
    "name": "A3.2-A 系統錯誤恢復（提供導引）",
    "suite": "render",
    "target": "prod",
    "steps": [
      {
        "input": "（觸發系統錯誤的占位輸入）"
      }
    ],
    "expectedKeywords": [
      "導引",
      "請提供",
      "具體"
    ],
    "expectedCode": "UNKNOWN_HELP",
    "source": "/Users/jw-mba/Desktop/Projects/course-mvp-beta/QA/plans/plan-comprehensive-2025-08-10.md",
    "collectingSteps": true
  },
  {
    "id": "A3.2-B",
    "name": "A3.2-B 輸入修正流程（無效→更正）",
    "suite": "render",
    "target": "prod",
    "steps": [
      {
        "input": "小明明天25點上課"
      },
      {
        "input": "下午2點"
      }
    ],
    "expectedKeywords": [
      "確認",
      "小明"
    ],
    "source": "/Users/jw-mba/Desktop/Projects/course-mvp-beta/QA/plans/plan-comprehensive-2025-08-10.md",
    "collectingSteps": true
  },
  {
    "id": "B1.1-A",
    "name": "B1.1-A 今日課程查詢",
    "suite": "render",
    "target": "prod",
    "steps": [
      {
        "input": "小明今天有什麼課？"
      }
    ],
    "expectedKeywords": [
      "小明",
      "今天",
      "課表"
    ],
    "source": "/Users/jw-mba/Desktop/Projects/course-mvp-beta/QA/plans/plan-comprehensive-2025-08-10.md",
    "collectingSteps": true
  },
  {
    "id": "B1.1-B",
    "name": "B1.1-B 明日課程查詢",
    "suite": "render",
    "target": "prod",
    "steps": [
      {
        "input": "查詢Lumi明天的課表"
      }
    ],
    "expectedKeywords": [
      "Lumi",
      "明天",
      "課表"
    ],
    "source": "/Users/jw-mba/Desktop/Projects/course-mvp-beta/QA/plans/plan-comprehensive-2025-08-10.md",
    "collectingSteps": true
  },
  {
    "id": "B1.1-C",
    "name": "B1.1-C 本週課程查詢（含重複課）",
    "suite": "render",
    "target": "prod",
    "steps": [
      {
        "input": "看一下小光這週的安排"
      }
    ],
    "expectedKeywords": [
      "小光",
      "這週",
      "課表"
    ],
    "source": "/Users/jw-mba/Desktop/Projects/course-mvp-beta/QA/plans/plan-comprehensive-2025-08-10.md",
    "collectingSteps": true
  },
  {
    "id": "B1.2-A",
    "name": "B1.2-A 無課程日查詢（空結果）",
    "suite": "render",
    "target": "prod",
    "steps": [
      {
        "input": "小王今天有什麼課？"
      }
    ],
    "expectedKeywords": [
      "沒有安排課程"
    ],
    "expectedCode": "QUERY_OK_EMPTY",
    "source": "/Users/jw-mba/Desktop/Projects/course-mvp-beta/QA/plans/plan-comprehensive-2025-08-10.md",
    "collectingSteps": true
  },
  {
    "id": "B1.3-A",
    "name": "B1.3-A 特定課程查詢（篩選）",
    "suite": "render",
    "target": "prod",
    "steps": [
      {
        "input": "小明的數學課什麼時候上？"
      }
    ],
    "expectedKeywords": [
      "小明",
      "數學課",
      "時間"
    ],
    "source": "/Users/jw-mba/Desktop/Projects/course-mvp-beta/QA/plans/plan-comprehensive-2025-08-10.md",
    "collectingSteps": true
  },
  {
    "id": "B1.3-B",
    "name": "B1.3-B 每日重複課程查詢",
    "suite": "render",
    "target": "prod",
    "steps": [
      {
        "input": "小明的晨練課每天幾點？"
      }
    ],
    "expectedKeywords": [
      "晨練課",
      "每天",
      "時間"
    ],
    "source": "/Users/jw-mba/Desktop/Projects/course-mvp-beta/QA/plans/plan-comprehensive-2025-08-10.md",
    "collectingSteps": true
  },
  {
    "id": "B1.3-C",
    "name": "B1.3-C 重複課類型識別查詢",
    "suite": "render",
    "target": "prod",
    "steps": [
      {
        "input": "查詢Lumi的重複課程"
      }
    ],
    "expectedKeywords": [
      "Lumi",
      "重複課程",
      "課表"
    ],
    "source": "/Users/jw-mba/Desktop/Projects/course-mvp-beta/QA/plans/plan-comprehensive-2025-08-10.md",
    "collectingSteps": true
  },
  {
    "id": "B2.1-A",
    "name": "B2.1-A 當日課程記錄（標準）",
    "suite": "render",
    "target": "prod",
    "steps": [
      {
        "input": "今天小明的數學課學了分數加減法"
      }
    ],
    "expectedKeywords": [
      "已記錄",
      "小明",
      "數學課",
      "分數加減法"
    ],
    "source": "/Users/jw-mba/Desktop/Projects/course-mvp-beta/QA/plans/plan-comprehensive-2025-08-10.md",
    "collectingSteps": true
  },
  {
    "id": "B2.1-B",
    "name": "B2.1-B 昨日課程補記錄",
    "suite": "render",
    "target": "prod",
    "steps": [
      {
        "input": "補記一下昨天Lumi鋼琴課的內容，練習了小星星"
      }
    ],
    "expectedKeywords": [
      "已記錄",
      "Lumi",
      "鋼琴課",
      "小星星"
    ],
    "source": "/Users/jw-mba/Desktop/Projects/course-mvp-beta/QA/plans/plan-comprehensive-2025-08-10.md",
    "collectingSteps": true
  },
  {
    "id": "B2.2-A",
    "name": "B2.2-A 查詢課程記錄",
    "suite": "render",
    "target": "prod",
    "steps": [
      {
        "input": "小明昨天數學課學了什麼？"
      }
    ],
    "expectedKeywords": [
      "內容",
      "記錄"
    ],
    "source": "/Users/jw-mba/Desktop/Projects/course-mvp-beta/QA/plans/plan-comprehensive-2025-08-10.md",
    "collectingSteps": true
  },
  {
    "id": "B2.3-A",
    "name": "B2.3-A 不存在課程記錄（應提示）",
    "suite": "render",
    "target": "prod",
    "steps": [
      {
        "input": "記錄小明今天化學課的內容"
      }
    ],
    "expectedKeywords": [
      "找不到",
      "請確認",
      "先新增"
    ],
    "expectedCode": "NOT_FOUND",
    "source": "/Users/jw-mba/Desktop/Projects/course-mvp-beta/QA/plans/plan-comprehensive-2025-08-10.md",
    "collectingSteps": true
  },
  {
    "id": "B3.1-A",
    "name": "B3.1-A 標準提醒設定",
    "suite": "render",
    "target": "prod",
    "steps": [
      {
        "input": "提醒我小明的數學課"
      }
    ],
    "expectedKeywords": [
      "提醒",
      "小明",
      "數學課",
      "30分鐘"
    ],
    "source": "/Users/jw-mba/Desktop/Projects/course-mvp-beta/QA/plans/plan-comprehensive-2025-08-10.md",
    "collectingSteps": true
  },
  {
    "id": "B3.1-B",
    "name": "B3.1-B 自訂提醒時間",
    "suite": "render",
    "target": "prod",
    "steps": [
      {
        "input": "Lumi鋼琴課前1小時提醒我"
      }
    ],
    "expectedKeywords": [
      "提醒",
      "Lumi",
      "鋼琴課",
      "60分鐘"
    ],
    "source": "/Users/jw-mba/Desktop/Projects/course-mvp-beta/QA/plans/plan-comprehensive-2025-08-10.md",
    "collectingSteps": true
  },
  {
    "id": "B3.2-A",
    "name": "B3.2-A 不存在課程提醒",
    "suite": "render",
    "target": "prod",
    "steps": [
      {
        "input": "提醒我小明的物理課"
      }
    ],
    "expectedKeywords": [
      "找不到",
      "小明",
      "物理課"
    ],
    "expectedCode": "NOT_FOUND",
    "source": "/Users/jw-mba/Desktop/Projects/course-mvp-beta/QA/plans/plan-comprehensive-2025-08-10.md",
    "collectingSteps": true
  },
  {
    "id": "C1.1-A",
    "name": "C1.1-A 修改課程時間（功能待落地）",
    "suite": "render",
    "target": "prod",
    "steps": [
      {
        "input": "小明的數學課改到下午4點"
      }
    ],
    "expectedKeywords": [
      "修改",
      "小明",
      "數學課",
      "16:00"
    ],
    "source": "/Users/jw-mba/Desktop/Projects/course-mvp-beta/QA/plans/plan-comprehensive-2025-08-10.md",
    "collectingSteps": true
  },
  {
    "id": "C1.1-B",
    "name": "C1.1-B 修改每日重複課時間（系列操作）",
    "suite": "render",
    "target": "prod",
    "steps": [
      {
        "input": "小明每天的晨練課改到早上7點"
      }
    ],
    "expectedKeywords": [
      "修改",
      "每天",
      "07:00",
      "選項"
    ],
    "source": "/Users/jw-mba/Desktop/Projects/course-mvp-beta/QA/plans/plan-comprehensive-2025-08-10.md",
    "collectingSteps": true
  },
  {
    "id": "C1.1-C",
    "name": "C1.1-C 修改重複類型（週→日）",
    "suite": "render",
    "target": "prod",
    "steps": [
      {
        "input": "Lumi的鋼琴課改成每天下午3點"
      }
    ],
    "expectedKeywords": [
      "修改",
      "每天",
      "15:00"
    ],
    "source": "/Users/jw-mba/Desktop/Projects/course-mvp-beta/QA/plans/plan-comprehensive-2025-08-10.md",
    "collectingSteps": true
  },
  {
    "id": "C2.1-A",
    "name": "C2.1-A 取消單次課程",
    "suite": "render",
    "target": "prod",
    "steps": [
      {
        "input": "取消小明明天的數學課"
      }
    ],
    "expectedKeywords": [
      "取消",
      "小明",
      "明天",
      "數學課"
    ],
    "source": "/Users/jw-mba/Desktop/Projects/course-mvp-beta/QA/plans/plan-comprehensive-2025-08-10.md",
    "collectingSteps": true
  },
  {
    "id": "C2.1-B",
    "name": "C2.1-B 取消每日重複課程（提供範圍選項）",
    "suite": "render",
    "target": "prod",
    "steps": [
      {
        "input": "取消小明的晨練課"
      }
    ],
    "expectedKeywords": [
      "只取消今天",
      "明天起所有",
      "刪除整個重複"
    ],
    "expectedCode": "RECURRING_CANCEL_OPTIONS",
    "source": "/Users/jw-mba/Desktop/Projects/course-mvp-beta/QA/plans/plan-comprehensive-2025-08-10.md",
    "collectingSteps": true
  },
  {
    "id": "C2.1-C",
    "name": "C2.1-C 取消下週範圍（部分）",
    "suite": "render",
    "target": "prod",
    "steps": [
      {
        "input": "取消小明下週的晨練課"
      }
    ],
    "expectedKeywords": [
      "已取消",
      "下週",
      "晨練課"
    ],
    "source": "/Users/jw-mba/Desktop/Projects/course-mvp-beta/QA/plans/plan-comprehensive-2025-08-10.md",
    "collectingSteps": true
  },
  {
    "id": "C2.1-D",
    "name": "C2.1-D 類型區分取消（daily/weekly）",
    "suite": "render",
    "target": "prod",
    "steps": [
      {
        "input": "取消小明每天的晨練課"
      },
      {
        "input": "取消Lumi每週三的鋼琴課"
      }
    ],
    "expectedKeywords": [
      "每週三",
      "取消"
    ],
    "source": "/Users/jw-mba/Desktop/Projects/course-mvp-beta/QA/plans/plan-comprehensive-2025-08-10.md",
    "collectingSteps": true
  },
  {
    "id": "C3.1-A",
    "name": "C3.1-A 併發處理測試",
    "suite": "render",
    "target": "prod",
    "steps": [
      {
        "input": "（同時多使用者發起課表查詢，應全部成功）"
      }
    ],
    "expectedKeywords": [
      "成功",
      "查詢",
      "課程"
    ],
    "source": "/Users/jw-mba/Desktop/Projects/course-mvp-beta/QA/plans/plan-comprehensive-2025-08-10.md",
    "collectingSteps": true
  }
];
  const results = await runner.runTests(tests, process.env.QA_MODE || 'both');
  runner.generateReport(results);
  const ok = (results.local ? results.local.failed === 0 : true) && (results.real ? results.real.failed === 0 : true);
  process.exit(ok ? 0 : 1);
})().catch(e => { console.error('❌ 生成測試執行失敗:', e.message); process.exit(1); });
