/**
 * Slot Template System 資料遷移腳本
 * 設置 Firestore 集合和初始資料
 */

const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// 初始化 Firebase Admin (如果尚未初始化)
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.applicationDefault(),
    projectId: process.env.FIREBASE_PROJECT_ID
  });
}

const db = admin.firestore();

class SlotTemplateMigration {
  constructor() {
    this.db = db;
  }

  /**
   * 執行完整的遷移
   */
  async run() {
    console.log('🚀 開始 Slot Template System 資料遷移...');
    
    try {
      // 1. 檢查和創建集合
      await this.setupCollections();
      
      // 2. 部署 Firestore 索引
      await this.deployIndexes();
      
      // 3. 設定安全規則
      await this.deploySecurityRules();
      
      // 4. 載入 Slot Template 配置到 Firestore
      await this.loadSlotTemplates();
      
      // 5. 設置系統配置
      await this.setupSystemConfig();
      
      // 6. 驗證遷移結果
      await this.validateMigration();
      
      console.log('✅ Slot Template System 資料遷移完成！');
    } catch (error) {
      console.error('❌ 遷移失敗:', error);
      throw error;
    }
  }

  /**
   * 設置集合結構
   */
  async setupCollections() {
    console.log('📁 設置 Firestore 集合結構...');
    
    const collections = [
      'user_slot_states',
      'slot_templates', 
      'slot_execution_logs',
      'slot_metrics'
    ];

    for (const collectionName of collections) {
      // 檢查集合是否存在，不存在則創建一個空文檔來初始化
      const collectionRef = this.db.collection(collectionName);
      const snapshot = await collectionRef.limit(1).get();
      
      if (snapshot.empty) {
        console.log(`  創建集合: ${collectionName}`);
        // 創建一個臨時文檔來初始化集合，稍後會刪除
        const tempDocRef = await collectionRef.add({
          _temp: true,
          created_at: admin.firestore.FieldValue.serverTimestamp()
        });
        
        // 立即刪除臨時文檔
        await tempDocRef.delete();
      } else {
        console.log(`  集合已存在: ${collectionName}`);
      }
    }
  }

  /**
   * 載入 Slot Template 配置到 Firestore
   */
  async loadSlotTemplates() {
    console.log('📋 載入 Slot Template 配置...');
    
    const templatesDir = path.join(process.cwd(), 'config', 'slot-templates');
    
    try {
      const files = await fs.promises.readdir(templatesDir);
      const templateFiles = files.filter(file => 
        file.endsWith('.json') && file !== 'schema.json'
      );

      for (const file of templateFiles) {
        const templatePath = path.join(templatesDir, file);
        const templateContent = await fs.promises.readFile(templatePath, 'utf8');
        const template = JSON.parse(templateContent);
        
        // 檢查模板是否已存在
        const existingTemplate = await this.db
          .collection('slot_templates')
          .doc(template.template_id)
          .get();

        const templateDoc = {
          template_id: template.template_id,
          template_name: template.template_name,
          version: template.version,
          enabled: true,
          template_config: template,
          created_at: admin.firestore.FieldValue.serverTimestamp(),
          updated_at: admin.firestore.FieldValue.serverTimestamp(),
          created_by: 'system_migration'
        };

        if (existingTemplate.exists) {
          console.log(`  更新模板: ${template.template_id} v${template.version}`);
          await this.db
            .collection('slot_templates')
            .doc(template.template_id)
            .update({
              ...templateDoc,
              created_at: existingTemplate.data().created_at // 保留原創建時間
            });
        } else {
          console.log(`  新增模板: ${template.template_id} v${template.version}`);
          await this.db
            .collection('slot_templates')
            .doc(template.template_id)
            .set(templateDoc);
        }
      }
    } catch (error) {
      console.error('載入模板失敗:', error);
      throw error;
    }
  }

  /**
   * 部署 Firestore 索引
   */
  async deployIndexes() {
    console.log('🔍 部署 Firestore 索引...');
    
    try {
      const indexFile = path.join(process.cwd(), 'firestore.indexes.json');
      
      // 檢查索引文件是否存在
      if (!fs.existsSync(indexFile)) {
        console.log('  ⚠️ firestore.indexes.json 不存在，跳過索引部署');
        return;
      }

      // 讀取索引配置
      const indexConfig = JSON.parse(fs.readFileSync(indexFile, 'utf8'));
      console.log(`  發現 ${indexConfig.indexes.length} 個索引配置`);

      // 檢查 Firebase CLI 是否可用
      try {
        execSync('firebase --version', { stdio: 'pipe' });
      } catch (error) {
        console.log('  ⚠️ Firebase CLI 未安裝，請手動部署索引:');
        console.log(`     firebase deploy --only firestore:indexes --project ${process.env.FIREBASE_PROJECT_ID}`);
        return;
      }

      // 使用 Firebase CLI 部署索引
      const projectId = process.env.FIREBASE_PROJECT_ID;
      if (!projectId) {
        throw new Error('FIREBASE_PROJECT_ID 環境變數未設定');
      }

      console.log(`  部署索引到專案: ${projectId}`);
      try {
        execSync(`firebase deploy --only firestore:indexes --project ${projectId}`, { 
          stdio: 'inherit',
          cwd: process.cwd()
        });
        console.log('  ✅ 索引部署完成');
      } catch (error) {
        console.log('  ⚠️ 索引部署失敗，請手動執行:');
        console.log(`     firebase deploy --only firestore:indexes --project ${projectId}`);
        console.log(`     錯誤: ${error.message}`);
      }
    } catch (error) {
      console.error('  ❌ 索引部署過程發生錯誤:', error.message);
      throw error;
    }
  }

  /**
   * 設定安全規則
   */
  async deploySecurityRules() {
    console.log('🔒 設定 Firestore 安全規則...');
    
    try {
      // 創建安全規則文件
      const rulesContent = this.generateSecurityRules();
      const rulesFile = path.join(process.cwd(), 'firestore.rules');
      
      // 寫入規則文件
      fs.writeFileSync(rulesFile, rulesContent);
      console.log('  ✅ 安全規則文件已生成: firestore.rules');

      // 檢查 Firebase CLI 是否可用
      try {
        execSync('firebase --version', { stdio: 'pipe' });
      } catch (error) {
        console.log('  ⚠️ Firebase CLI 未安裝，請手動部署安全規則:');
        console.log(`     firebase deploy --only firestore:rules --project ${process.env.FIREBASE_PROJECT_ID}`);
        return;
      }

      // 使用 Firebase CLI 部署安全規則
      const projectId = process.env.FIREBASE_PROJECT_ID;
      if (!projectId) {
        throw new Error('FIREBASE_PROJECT_ID 環境變數未設定');
      }

      console.log(`  部署安全規則到專案: ${projectId}`);
      try {
        execSync(`firebase deploy --only firestore:rules --project ${projectId}`, { 
          stdio: 'inherit',
          cwd: process.cwd()
        });
        console.log('  ✅ 安全規則部署完成');
      } catch (error) {
        console.log('  ⚠️ 安全規則部署失敗，請手動執行:');
        console.log(`     firebase deploy --only firestore:rules --project ${projectId}`);
        console.log(`     錯誤: ${error.message}`);
      }
    } catch (error) {
      console.error('  ❌ 安全規則設定過程發生錯誤:', error.message);
      throw error;
    }
  }

  /**
   * 生成 Firestore 安全規則
   */
  generateSecurityRules() {
    return `rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    
    // 輔助函數：檢查用戶是否有特定角色
    function hasRole(role) {
      return request.auth != null && 
             request.auth.token.get('role', '') == role;
    }
    
    // 輔助函數：檢查用戶是否為系統用戶
    function isSystem() {
      return hasRole('system');
    }
    
    // 輔助函數：檢查用戶是否為管理員
    function isAdmin() {
      return hasRole('admin');
    }
    
    // user_slot_states 集合規則
    match /user_slot_states/{documentId} {
      allow read, write: if request.auth != null && 
                           request.auth.uid == resource.data.user_id;
      allow create: if request.auth != null && 
                      request.auth.uid == request.resource.data.user_id;
    }
    
    // slot_templates 集合規則
    match /slot_templates/{documentId} {
      allow read: if request.auth != null;
      allow write, create: if request.auth != null && isAdmin();
    }
    
    // slot_execution_logs 集合規則
    match /slot_execution_logs/{documentId} {
      allow read: if request.auth != null && 
                    (isAdmin() || request.auth.uid == resource.data.user_id);
      allow write: if request.auth != null && isSystem();
      allow create: if request.auth != null;
    }
    
    // slot_metrics 集合規則
    match /slot_metrics/{documentId} {
      allow read: if request.auth != null && isAdmin();
      allow write, create: if request.auth != null && isSystem();
    }
    
    // system_config 集合規則
    match /system_config/{documentId} {
      allow read: if request.auth != null && isAdmin();
      allow write, create: if request.auth != null && isAdmin();
    }
    
    // 預設拒絕所有其他操作
    match /{document=**} {
      allow read, write: if false;
    }
  }
}`;
  }

  /**
   * 設置系統配置
   */
  async setupSystemConfig() {
    console.log('⚙️ 設置系統配置...');
    
    const systemConfig = {
      slot_template_system: {
        enabled: false, // 初始為關閉狀態
        version: '1.0.0',
        features: {
          multi_turn_conversation: true,
          slot_validation: true,
          automatic_completion: true,
          conflict_resolution: true
        },
        settings: {
          default_timeout_minutes: 30,
          max_conversation_turns: 10,
          cache_ttl_seconds: 300,
          log_retention_days: 90
        },
        updated_at: admin.firestore.FieldValue.serverTimestamp(),
        updated_by: 'system_migration'
      }
    };

    // 檢查系統配置是否存在
    const configRef = this.db.collection('system_config').doc('slot_template');
    const configSnapshot = await configRef.get();

    if (configSnapshot.exists) {
      console.log('  更新系統配置');
      await configRef.update(systemConfig);
    } else {
      console.log('  創建系統配置');
      await configRef.set({
        ...systemConfig,
        created_at: admin.firestore.FieldValue.serverTimestamp()
      });
    }
  }

  /**
   * 驗證遷移結果
   */
  async validateMigration() {
    console.log('🔍 驗證遷移結果...');
    
    // 檢查模板是否載入成功
    const templatesSnapshot = await this.db.collection('slot_templates').get();
    console.log(`  ✓ 載入了 ${templatesSnapshot.size} 個 Slot Template`);

    // 檢查系統配置
    const configSnapshot = await this.db.collection('system_config').doc('slot_template').get();
    if (configSnapshot.exists) {
      console.log('  ✓ 系統配置已設置');
    } else {
      throw new Error('系統配置設置失敗');
    }

    // 檢查集合存在性
    const collections = ['user_slot_states', 'slot_execution_logs', 'slot_metrics'];
    for (const collectionName of collections) {
      try {
        // 嘗試查詢集合 (即使是空的)
        await this.db.collection(collectionName).limit(1).get();
        console.log(`  ✓ 集合 ${collectionName} 已準備就緒`);
      } catch (error) {
        throw new Error(`集合 ${collectionName} 設置失敗: ${error.message}`);
      }
    }

    // 檢查索引配置文件
    const indexFile = path.join(process.cwd(), 'firestore.indexes.json');
    if (fs.existsSync(indexFile)) {
      const indexConfig = JSON.parse(fs.readFileSync(indexFile, 'utf8'));
      console.log(`  ✓ 索引配置文件存在 (${indexConfig.indexes.length} 個索引)`);
    } else {
      console.log('  ⚠️ 索引配置文件不存在');
    }

    // 檢查安全規則文件
    const rulesFile = path.join(process.cwd(), 'firestore.rules');
    if (fs.existsSync(rulesFile)) {
      console.log('  ✓ 安全規則文件已生成');
    } else {
      console.log('  ⚠️ 安全規則文件未生成');
    }

    console.log('📋 遷移摘要:');
    console.log(`  - 已設置 ${collections.length + 1} 個 Firestore 集合`);
    console.log(`  - 已載入 ${templatesSnapshot.size} 個 Slot Template`);
    console.log('  - 已配置系統設定');
    console.log('  - 已設置安全規則 (如有 Firebase CLI)');
    console.log('  - 已部署索引 (如有 Firebase CLI)');
  }

  /**
   * 回滾遷移 (開發環境使用)
   */
  async rollback() {
    console.log('🔄 回滾 Slot Template System 遷移...');
    
    if (process.env.NODE_ENV === 'production') {
      throw new Error('生產環境不允許回滾操作');
    }

    try {
      // 刪除系統配置
      await this.db.collection('system_config').doc('slot_template').delete();
      console.log('  ✓ 已刪除系統配置');

      // 刪除所有 Slot Template
      const templatesSnapshot = await this.db.collection('slot_templates').get();
      const batch = this.db.batch();
      templatesSnapshot.docs.forEach(doc => {
        batch.delete(doc.ref);
      });
      await batch.commit();
      console.log(`  ✓ 已刪除 ${templatesSnapshot.size} 個模板`);

      // 清空其他集合的資料 (但保留集合結構)
      const collectionsToClean = ['user_slot_states', 'slot_execution_logs', 'slot_metrics'];
      for (const collectionName of collectionsToClean) {
        const snapshot = await this.db.collection(collectionName).get();
        if (!snapshot.empty) {
          const batch = this.db.batch();
          snapshot.docs.forEach(doc => {
            batch.delete(doc.ref);
          });
          await batch.commit();
          console.log(`  ✓ 已清空集合 ${collectionName} (${snapshot.size} 個文檔)`);
        }
      }

      // 移除本地生成的文件
      const filesToRemove = [
        path.join(process.cwd(), 'firestore.rules')
      ];
      
      for (const file of filesToRemove) {
        if (fs.existsSync(file)) {
          fs.unlinkSync(file);
          console.log(`  ✓ 已刪除文件: ${path.basename(file)}`);
        }
      }

      console.log('✅ 回滾完成');
      console.log('⚠️ 注意: Firestore 索引和安全規則需要手動回滾:');
      console.log('   - 索引: 在 Firebase Console 中手動刪除相關索引');
      console.log('   - 安全規則: 在 Firebase Console 中恢復之前的規則');
    } catch (error) {
      console.error('❌ 回滾失敗:', error);
      throw error;
    }
  }
}

// 如果直接執行此腳本
if (require.main === module) {
  const migration = new SlotTemplateMigration();
  
  const command = process.argv[2];
  
  if (command === 'rollback') {
    migration.rollback()
      .then(() => process.exit(0))
      .catch(error => {
        console.error(error);
        process.exit(1);
      });
  } else {
    migration.run()
      .then(() => process.exit(0))
      .catch(error => {
        console.error(error);
        process.exit(1);
      });
  }
}

module.exports = SlotTemplateMigration;