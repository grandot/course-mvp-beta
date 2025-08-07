#!/usr/bin/env node

/**
 * QA Orchestrator 命令列工具
 */

const { QAOrchestrator } = require('../qa-system/QAOrchestrator');
const path = require('path');

// 命令列參數解析
function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    command: 'full', // 'full', 'validate', 'config', 'test'
    mode: 'both', // 'local', 'real', 'both'
    testPlan: null,
    config: null
  };
  
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    
    switch (arg) {
      case '--help':
      case '-h':
        showHelp();
        process.exit(0);
        break;
        
      case '--mode':
      case '-m':
        options.mode = args[++i];
        break;
        
      case '--test-plan':
      case '-t':
        options.testPlan = args[++i];
        break;
        
      case '--config':
      case '-c':
        options.config = args[++i];
        break;
        
      case 'validate':
        options.command = 'validate';
        break;
        
      case 'config':
        options.command = 'config';
        break;
        
      case 'test':
        options.command = 'test';
        break;
        
      case 'fix':
        options.command = 'fix';
        break;
        
      case 'full':
      default:
        if (!arg.startsWith('-') && i === 0) {
          options.command = arg;
        }
        break;
    }
  }
  
  return options;
}

// 顯示幫助資訊
function showHelp() {
  console.log(`
🤖 QA Orchestrator - 智能測試編排系統

用法:
  node tools/qa-orchestrator.js [command] [options]

命令:
  full      完整流程：解析 -> 提取 -> 依賴 -> 測試 (預設)
  validate  快速驗證：僅檢查依賴關係，不執行測試
  config    僅生成配置：解析並生成 test-dependencies.yaml
  test      僅執行測試：使用現有配置執行測試
  fix       自動修復：檢測並修復依賴關係問題

選項:
  -m, --mode <mode>        測試模式 (local|real|both) [預設: both]
  -t, --test-plan <file>   測試計劃文件路徑
  -c, --config <file>      輸出配置文件路徑
  -h, --help              顯示此幫助資訊

範例:
  node tools/qa-orchestrator.js                    # 完整流程，雙模式測試
  node tools/qa-orchestrator.js validate           # 快速驗證依賴關係
  node tools/qa-orchestrator.js config             # 僅生成依賴配置
  node tools/qa-orchestrator.js test -m local      # 僅執行本機測試
  node tools/qa-orchestrator.js full -m real       # 完整流程，僅線上測試
`);
}

// 主函數
async function main() {
  const options = parseArgs();
  
  console.log('🤖 QA Orchestrator v1.0.0');
  console.log('='.repeat(50));
  
  // 設置路徑
  const orchestratorOptions = {
    mode: options.mode
  };
  
  if (options.testPlan) {
    orchestratorOptions.testPlanPath = path.resolve(options.testPlan);
  }
  
  if (options.config) {
    orchestratorOptions.dependencyConfigPath = path.resolve(options.config);
  }
  
  try {
    const orchestrator = new QAOrchestrator(orchestratorOptions);
    let success = false;
    
    switch (options.command) {
      case 'full':
        console.log('🚀 執行完整 QA 流程');
        await orchestrator.runFullPipeline();
        success = true;
        break;
        
      case 'validate':
        console.log('⚡ 快速依賴驗證');
        success = await orchestrator.quickValidate();
        break;
        
      case 'config':
        console.log('⚙️  生成依賴配置');
        success = await orchestrator.generateConfigOnly();
        break;
        
      case 'test':
        console.log('🧪 執行測試');
        const testCases = await orchestrator.parseTestPlan();
        const enrichedTestCases = await orchestrator.extractEntities(testCases);
        const results = await orchestrator.executeTests(enrichedTestCases);
        success = true;
        break;
        
      case 'fix':
        console.log('🔧 自動修復依賴關係');
        success = await orchestrator.autoFix();
        break;
        
      default:
        console.error(`❌ 未知命令: ${options.command}`);
        showHelp();
        process.exit(1);
    }
    
    if (success) {
      console.log('\n🎉 QA Orchestrator 執行完成！');
      process.exit(0);
    } else {
      console.log('\n❌ QA Orchestrator 執行失敗');
      process.exit(1);
    }
    
  } catch (error) {
    console.error('\n❌ 執行過程發生錯誤:');
    console.error(error.message);
    
    if (process.env.NODE_ENV === 'development') {
      console.error('\n🔍 錯誤堆疊:');
      console.error(error.stack);
    }
    
    process.exit(1);
  }
}

// 處理未捕獲的異常
process.on('uncaughtException', (error) => {
  console.error('❌ 未捕獲的異常:', error.message);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ 未處理的 Promise 拒絕:', reason);
  process.exit(1);
});

// 執行主函數
if (require.main === module) {
  main().catch(error => {
    console.error('❌ 主函數執行失敗:', error.message);
    process.exit(1);
  });
}