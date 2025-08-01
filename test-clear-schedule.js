/**
 * 測試清空課表功能修復
 */
const SemanticController = require('./src/services/semanticController');

async function testClearSchedule() {
  console.log('🎯 測試清空課表意圖識別修復...\n');
  
  try {
    console.log('📝 測試: "清空課表"');
    const result = await SemanticController.analyze('清空課表');
    
    console.log(`結果: ${result.final_intent}`);
    console.log(`規則: ${result.used_rule}`);
    console.log(`來源: ${result.source}`);
    console.log(`信心度: ${result.confidence}`);
    console.log(`原因: ${result.reason}`);
    
    if (result.final_intent === 'clear_schedule') {
      console.log('✅ 修復成功！OpenAI 現在返回標準英文意圖名稱');
    } else {
      console.log(`❌ 修復失敗，仍然返回: ${result.final_intent}`);
    }
    
  } catch (error) {
    console.log(`❌ 測試失敗: ${error.message}`);
  }
}

testClearSchedule().catch(console.error);