/**
 * Firestore 索引部署腳本
 * 協助部署和管理 Firestore 索引
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

class FirestoreIndexManager {
  constructor() {
    this.indexFile = path.join(process.cwd(), 'firestore.indexes.json');
    this.projectId = process.env.FIREBASE_PROJECT_ID;
  }

  /**
   * 驗證索引文件
   */
  validateIndexFile() {
    console.log('📋 驗證 Firestore 索引文件...');
    
    if (!fs.existsSync(this.indexFile)) {
      throw new Error(`索引文件不存在: ${this.indexFile}`);
    }

    try {
      const indexConfig = JSON.parse(fs.readFileSync(this.indexFile, 'utf8'));
      
      if (!indexConfig.indexes || !Array.isArray(indexConfig.indexes)) {
        throw new Error('索引配置格式錯誤: 缺少 indexes 陣列');
      }

      console.log(`  ✓ 發現 ${indexConfig.indexes.length} 個索引配置`);
      
      // 驗證每個索引的格式
      indexConfig.indexes.forEach((index, i) => {
        if (!index.collectionGroup) {
          throw new Error(`索引 ${i} 缺少 collectionGroup`);
        }
        if (!index.fields || !Array.isArray(index.fields)) {
          throw new Error(`索引 ${i} 缺少 fields 陣列`);
        }
      });

      console.log('  ✓ 索引文件格式驗證通過');
      return indexConfig;
    } catch (error) {
      throw new Error(`索引文件解析失敗: ${error.message}`);
    }
  }

  /**
   * 部署索引到 Firebase
   */
  async deployIndexes() {
    console.log('🚀 部署 Firestore 索引...');
    
    if (!this.projectId) {
      throw new Error('請設定 FIREBASE_PROJECT_ID 環境變數');
    }

    try {
      // 驗證索引文件
      this.validateIndexFile();

      // 檢查 Firebase CLI 是否安裝
      try {
        execSync('firebase --version', { stdio: 'pipe' });
      } catch (error) {
        throw new Error('Firebase CLI 未安裝，請執行: npm install -g firebase-tools');
      }

      // 檢查是否已登入
      try {
        execSync('firebase projects:list', { stdio: 'pipe' });
      } catch (error) {
        console.log('請先登入 Firebase: firebase login');
        throw error;
      }

      // 部署索引
      console.log(`  部署到專案: ${this.projectId}`);
      const deployCommand = `firebase deploy --only firestore:indexes --project ${this.projectId}`;
      
      console.log(`  執行指令: ${deployCommand}`);
      execSync(deployCommand, { stdio: 'inherit' });
      
      console.log('✅ 索引部署完成！');
    } catch (error) {
      console.error('❌ 索引部署失敗:', error.message);
      throw error;
    }
  }

  /**
   * 檢查索引狀態
   */
  async checkIndexStatus() {
    console.log('🔍 檢查 Firestore 索引狀態...');
    
    try {
      const command = `firebase firestore:indexes --project ${this.projectId}`;
      console.log(`  執行指令: ${command}`);
      execSync(command, { stdio: 'inherit' });
    } catch (error) {
      console.error('❌ 無法檢查索引狀態:', error.message);
      throw error;
    }
  }

  /**
   * 生成索引建議
   */
  generateIndexSuggestions() {
    console.log('💡 生成索引建議...');
    
    const suggestions = [
      {
        collection: 'user_slot_states',
        reason: '用戶查詢自己的狀態',
        query: 'user_id + updated_at(desc)',
        priority: 'high'
      },
      {
        collection: 'slot_execution_logs',
        reason: '按時間查詢執行日誌',
        query: 'execution_time(desc)',
        priority: 'medium'
      },
      {
        collection: 'slot_metrics',
        reason: '指標統計和報告',
        query: 'date(desc) + template_id',
        priority: 'medium'
      }
    ];

    console.log('\n📊 索引建議:');
    suggestions.forEach((suggestion, i) => {
      console.log(`\n  ${i + 1}. ${suggestion.collection}`);
      console.log(`     原因: ${suggestion.reason}`);
      console.log(`     查詢: ${suggestion.query}`);
      console.log(`     優先級: ${suggestion.priority}`);
    });

    console.log('\n💡 提示:');
    console.log('  - 根據實際查詢模式調整索引');
    console.log('  - 監控查詢效能和索引使用率');
    console.log('  - 定期清理未使用的索引');
  }

  /**
   * 顯示幫助資訊
   */
  showHelp() {
    console.log(`
📚 Firestore 索引管理工具

使用方法:
  node scripts/deploy-firestore-indexes.js [command]

指令:
  deploy     部署索引到 Firebase
  check      檢查索引狀態  
  suggest    生成索引建議
  validate   驗證索引文件
  help       顯示此幫助資訊

環境變數:
  FIREBASE_PROJECT_ID    Firebase 專案 ID

範例:
  npm run deploy:indexes
  node scripts/deploy-firestore-indexes.js deploy
  node scripts/deploy-firestore-indexes.js check
    `);
  }
}

// 執行腳本
if (require.main === module) {
  const manager = new FirestoreIndexManager();
  const command = process.argv[2] || 'help';

  (async () => {
    try {
      switch (command) {
        case 'deploy':
          await manager.deployIndexes();
          break;
        case 'check':
          await manager.checkIndexStatus();
          break;
        case 'suggest':
          manager.generateIndexSuggestions();
          break;
        case 'validate':
          manager.validateIndexFile();
          console.log('✅ 索引文件驗證通過');
          break;
        case 'help':
        default:
          manager.showHelp();
          break;
      }
    } catch (error) {
      console.error('❌ 操作失敗:', error.message);
      process.exit(1);
    }
  })();
}

module.exports = FirestoreIndexManager;