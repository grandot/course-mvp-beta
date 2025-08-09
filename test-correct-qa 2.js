#!/usr/bin/env node

/**
 * 使用正確的QA系統架構執行測試
 */

require('dotenv').config();
const { QAOrchestrator } = require('./qa-system/QAOrchestrator');

async function runCorrectQA() {
  console.log('🎯 使用正確的QA系統架構');
  console.log('📋 檢查環境變數...');
  
  const requiredEnvs = {
    'WEBHOOK_URL': process.env.WEBHOOK_URL,
    'LINE_CHANNEL_SECRET': process.env.LINE_CHANNEL_SECRET,
    'OPENAI_API_KEY': process.env.OPENAI_API_KEY,
    'FIREBASE_PROJECT_ID': process.env.FIREBASE_PROJECT_ID
  };
  
  let allEnvsPresent = true;
  Object.entries(requiredEnvs).forEach(([key, value]) => {
    const status = value ? '✅' : '❌';
    console.log(`${key}: ${status}`);
    if (!value) allEnvsPresent = false;
  });
  
  if (!allEnvsPresent) {
    console.log('❌ 缺少必要環境變數，請檢查 .env 文件');
    return;
  }
  
  try {
    const orchestrator = new QAOrchestrator({ 
      mode: 'real'  // 只執行真實環境測試
    });
    
    // 先執行快速驗證
    console.log('\n⚡ 執行快速驗證...');
    const isValid = await orchestrator.quickValidate();
    
    if (isValid) {
      console.log('✅ 驗證通過，開始完整流程');
      const results = await orchestrator.runFullPipeline();
      return results;
    } else {
      console.log('❌ 驗證失敗，嘗試自動修復');
      const fixed = await orchestrator.autoFix();
      return fixed;
    }
    
  } catch (error) {
    console.error('❌ QA系統執行失敗:', error.message);
    console.log('\n🔍 錯誤分析:');
    console.log('這表明我們需要：');
    console.log('1. 檢查 qa-system 和現有工具的整合');
    console.log('2. 驗證 TestDataManager 的 Firebase 連接');
    console.log('3. 確保所有依賴正確安裝');
    
    return false;
  }
}

if (require.main === module) {
  runCorrectQA().then(result => {
    if (result) {
      console.log('\n🎉 QA系統執行完成');
      process.exit(0);
    } else {
      console.log('\n❌ QA系統執行失敗');
      process.exit(1);
    }
  }).catch(error => {
    console.error('未處理的錯誤:', error);
    process.exit(1);
  });
}