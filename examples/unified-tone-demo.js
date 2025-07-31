/**
 * 統一語氣系統展示
 * 🎯 第一性原則重構後的實際效果展示
 */

const { UnifiedToneManager } = require('../src/tone/toneManager');

function demonstrateUnifiedTone() {
  console.log('🎭 統一溫暖活潑語氣系統展示\n');
  
  const toneManager = new UnifiedToneManager();
  
  // 展示不同場景下的一致語氣
  const scenarios = [
    {
      name: '新增課程',
      userInput: '明天下午3點小美大提琴課',
      context: { taskType: 'record_course' }
    },
    {
      name: '缺少信息',
      userInput: '每週三游泳課',
      context: { hasErrors: true }
    },
    {
      name: '延續對話',
      userInput: '再來',
      context: { isFollowUp: true }
    },
    {
      name: '任務完成',
      userInput: '',
      context: { isSuccess: true }
    }
  ];
  
  scenarios.forEach((scenario, index) => {
    console.log(`${index + 1}. 場景：${scenario.name}`);
    console.log(`   用戶輸入："${scenario.userInput}"`);
    
    // 獲取對應場景的範例
    const scenarioKey = scenario.name === '新增課程' ? 'new_course' : 
                       scenario.name === '缺少信息' ? 'need_info' :
                       scenario.name === '延續對話' ? 'follow_up' : 'success';
    
    const examples = toneManager.getFewShotExamples(scenarioKey, scenario.context, 1);
    
    if (examples.length > 0) {
      console.log(`   AI回覆："${examples[0].bot}"`);
    }
    
    // 展示統一語氣特點
    console.log(`   🌟 語氣特點：溫暖親切 + 適度活潑 + 一致體驗`);
    console.log('');
  });
  
  console.log('🎯 核心價值：');
  console.log('✅ 用戶每次互動都感受到同一個熟悉助理');
  console.log('✅ 語氣溫暖親切，讓課程管理有溫度');
  console.log('✅ 適度活潑，增加互動樂趣但不過度');
  console.log('✅ 系統簡化，維護容易，性能更好');
}

// 執行展示
demonstrateUnifiedTone();