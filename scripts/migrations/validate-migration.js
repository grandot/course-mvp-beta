/**
 * 驗證遷移腳本完整性
 */

const path = require('path');
const fs = require('fs');

function validateMigrationScript() {
  console.log('🔍 驗證遷移腳本完整性...');

  const migrationFile = path.join(__dirname, '001_slot_template_setup.js');
  
  // 檢查文件是否存在
  if (!fs.existsSync(migrationFile)) {
    console.error('❌ 遷移腳本文件不存在');
    return false;
  }

  // 檢查必要的依賴項
  const requiredDependencies = [
    'firebase-admin',
    'fs',
    'path',
    'child_process'
  ];

  const content = fs.readFileSync(migrationFile, 'utf8');
  
  for (const dep of requiredDependencies) {
    if (!content.includes(`require('${dep}')`)) {
      console.error(`❌ 缺少必要依賴: ${dep}`);
      return false;
    }
  }

  // 檢查必要的方法
  const requiredMethods = [
    'setupCollections',
    'deployIndexes', 
    'deploySecurityRules',
    'loadSlotTemplates',
    'setupSystemConfig',
    'validateMigration',
    'rollback',
    'generateSecurityRules'
  ];

  for (const method of requiredMethods) {
    const patterns = [
      `async ${method}(`,
      `${method}() {`,
      `${method}(`
    ];
    
    const found = patterns.some(pattern => content.includes(pattern));
    if (!found) {
      console.error(`❌ 缺少必要方法: ${method}`);
      return false;
    }
  }

  // 檢查安全規則生成內容
  if (!content.includes('rules_version') || !content.includes('cloud.firestore')) {
    console.error('❌ 安全規則生成內容不完整');
    return false;
  }

  // 檢查所有必要的集合
  const requiredCollections = [
    'user_slot_states',
    'slot_templates',
    'slot_execution_logs', 
    'slot_metrics'
  ];

  for (const collection of requiredCollections) {
    if (!content.includes(collection)) {
      console.error(`❌ 缺少集合處理: ${collection}`);
      return false;
    }
  }

  console.log('✅ 遷移腳本完整性驗證通過');
  console.log('📋 發現的功能:');
  console.log('  ✓ 集合初始化');
  console.log('  ✓ 索引部署');
  console.log('  ✓ 安全規則設定');
  console.log('  ✓ 模板載入');
  console.log('  ✓ 系統配置');
  console.log('  ✓ 驗證機制');
  console.log('  ✓ 回滾功能');

  return true;
}

// 檢查相關配置文件
function validateConfigFiles() {
  console.log('\n🔍 檢查相關配置文件...');

  const configFiles = [
    {
      path: path.join(process.cwd(), 'firestore.indexes.json'),
      name: 'Firestore 索引配置',
      required: true
    },
    {
      path: path.join(process.cwd(), 'config', 'firestore-collections.json'),
      name: 'Firestore 集合配置',
      required: true
    },
    {
      path: path.join(process.cwd(), 'config', 'slot-templates'),
      name: 'Slot Template 目錄',
      required: true,
      isDirectory: true
    }
  ];

  let allGood = true;

  for (const config of configFiles) {
    if (config.isDirectory) {
      if (fs.existsSync(config.path) && fs.statSync(config.path).isDirectory()) {
        const files = fs.readdirSync(config.path).filter(f => f.endsWith('.json') && f !== 'schema.json');
        console.log(`  ✓ ${config.name} 存在 (${files.length} 個模板文件)`);
      } else {
        console.log(`  ❌ ${config.name} 目錄不存在`);
        allGood = false;
      }
    } else {
      if (fs.existsSync(config.path)) {
        console.log(`  ✓ ${config.name} 存在`);
      } else {
        console.log(`  ${config.required ? '❌' : '⚠️'} ${config.name} 不存在`);
        if (config.required) allGood = false;
      }
    }
  }

  return allGood;
}

// 提供使用指南
function showUsageGuide() {
  console.log('\n📖 遷移腳本使用指南:');
  console.log('');
  console.log('前置準備:');
  console.log('  1. 設定 Firebase 認證: export GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json');
  console.log('  2. 設定專案ID: export FIREBASE_PROJECT_ID=your-project-id');
  console.log('  3. 安裝 Firebase CLI: npm install -g firebase-tools');
  console.log('  4. 登入 Firebase: firebase login');
  console.log('');
  console.log('執行遷移:');
  console.log('  node scripts/migrations/001_slot_template_setup.js');
  console.log('');
  console.log('回滾遷移 (僅開發環境):');
  console.log('  NODE_ENV=development node scripts/migrations/001_slot_template_setup.js rollback');
  console.log('');
  console.log('⚠️ 注意事項:');
  console.log('  - 生產環境會阻止回滾操作');
  console.log('  - 索引和安全規則部署需要 Firebase CLI');
  console.log('  - 首次執行可能需要等待索引建立完成');
}

if (require.main === module) {
  const scriptValid = validateMigrationScript();
  const configValid = validateConfigFiles();
  
  if (scriptValid && configValid) {
    console.log('\n🎉 所有檢查通過，遷移腳本已準備就緒！');
    showUsageGuide();
  } else {
    console.log('\n❌ 發現問題，請修正後再執行遷移');
    process.exit(1);
  }
}

module.exports = { validateMigrationScript, validateConfigFiles };