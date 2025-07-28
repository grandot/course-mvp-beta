/**
 * Slot Template 資料結構測試
 */

const fs = require('fs');
const path = require('path');

describe('Slot Template 資料結構', () => {
  describe('Firestore 集合配置', () => {
    test('firestore-collections.json 應該存在且格式正確', () => {
      const configPath = path.join(process.cwd(), 'config', 'firestore-collections.json');
      expect(fs.existsSync(configPath)).toBe(true);
      
      const configContent = fs.readFileSync(configPath, 'utf8');
      const config = JSON.parse(configContent);
      
      expect(config.collections).toBeDefined();
      expect(typeof config.collections).toBe('object');
      
      // 檢查必要的集合
      const requiredCollections = [
        'user_slot_states',
        'slot_templates',
        'slot_execution_logs',
        'slot_metrics'
      ];
      
      requiredCollections.forEach(collectionName => {
        expect(config.collections[collectionName]).toBeDefined();
        expect(config.collections[collectionName].description).toBeDefined();
        expect(config.collections[collectionName].document_structure).toBeDefined();
      });
    });

    test('user_slot_states 集合結構應該正確', () => {
      const configPath = path.join(process.cwd(), 'config', 'firestore-collections.json');
      const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      
      const userStateStructure = config.collections.user_slot_states.document_structure;
      
      // 檢查必要欄位
      expect(userStateStructure.user_id).toBeDefined();
      expect(userStateStructure.user_id.type).toBe('string');
      expect(userStateStructure.user_id.required).toBe(true);
      
      expect(userStateStructure.created_at).toBeDefined();
      expect(userStateStructure.created_at.type).toBe('timestamp');
      
      expect(userStateStructure.updated_at).toBeDefined();
      expect(userStateStructure.updated_at.type).toBe('timestamp');
      
      expect(userStateStructure.active_task).toBeDefined();
      expect(userStateStructure.active_task.type).toBe('object');
      
      expect(userStateStructure.settings).toBeDefined();
      expect(userStateStructure.settings.type).toBe('object');
    });

    test('active_task 嵌套結構應該正確', () => {
      const configPath = path.join(process.cwd(), 'config', 'firestore-collections.json');
      const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      
      const activeTaskSchema = config.collections.user_slot_states.document_structure.active_task.schema;
      
      // 檢查 active_task 的必要欄位
      expect(activeTaskSchema.task_id).toBeDefined();
      expect(activeTaskSchema.intent).toBeDefined();
      expect(activeTaskSchema.template_id).toBeDefined();
      expect(activeTaskSchema.status).toBeDefined();
      expect(activeTaskSchema.slot_state).toBeDefined();
      expect(activeTaskSchema.completion_score).toBeDefined();
      expect(activeTaskSchema.missing_slots).toBeDefined();
      expect(activeTaskSchema.history).toBeDefined();
      expect(activeTaskSchema.metadata).toBeDefined();
      
      // 檢查狀態枚舉值
      expect(activeTaskSchema.status.enum).toContain('incomplete');
      expect(activeTaskSchema.status.enum).toContain('complete');
      expect(activeTaskSchema.status.enum).toContain('cancelled');
      expect(activeTaskSchema.status.enum).toContain('failed');
    });
  });

  describe('Firestore 索引配置', () => {
    test('firestore.indexes.json 應該存在且格式正確', () => {
      const indexPath = path.join(process.cwd(), 'firestore.indexes.json');
      expect(fs.existsSync(indexPath)).toBe(true);
      
      const indexContent = fs.readFileSync(indexPath, 'utf8');
      const indexConfig = JSON.parse(indexContent);
      
      expect(indexConfig.indexes).toBeDefined();
      expect(Array.isArray(indexConfig.indexes)).toBe(true);
      expect(indexConfig.indexes.length).toBeGreaterThan(0);
    });

    test('索引配置應該涵蓋所有必要的查詢模式', () => {
      const indexPath = path.join(process.cwd(), 'firestore.indexes.json');
      const indexConfig = JSON.parse(fs.readFileSync(indexPath, 'utf8'));
      
      // 檢查是否有 user_slot_states 的索引
      const userStateIndexes = indexConfig.indexes.filter(
        index => index.collectionGroup === 'user_slot_states'
      );
      expect(userStateIndexes.length).toBeGreaterThan(0);
      
      // 檢查是否有按 user_id 查詢的索引
      const userIdIndex = userStateIndexes.find(index =>
        index.fields.some(field => field.fieldPath === 'user_id')
      );
      expect(userIdIndex).toBeDefined();
      
      // 檢查是否有 slot_execution_logs 的索引
      const logIndexes = indexConfig.indexes.filter(
        index => index.collectionGroup === 'slot_execution_logs'
      );
      expect(logIndexes.length).toBeGreaterThan(0);
    });

    test('每個索引應該有正確的格式', () => {
      const indexPath = path.join(process.cwd(), 'firestore.indexes.json');
      const indexConfig = JSON.parse(fs.readFileSync(indexPath, 'utf8'));
      
      indexConfig.indexes.forEach((index, i) => {
        // 檢查必要欄位
        expect(index.collectionGroup).toBeDefined();
        expect(typeof index.collectionGroup).toBe('string');
        
        expect(index.queryScope).toBeDefined();
        expect(index.queryScope).toBe('COLLECTION');
        
        expect(index.fields).toBeDefined();
        expect(Array.isArray(index.fields)).toBe(true);
        expect(index.fields.length).toBeGreaterThan(0);
        
        // 檢查每個欄位的格式
        index.fields.forEach((field, j) => {
          expect(field.fieldPath).toBeDefined();
          expect(typeof field.fieldPath).toBe('string');
          
          expect(field.order).toBeDefined();
          expect(['ASCENDING', 'DESCENDING']).toContain(field.order);
        });
      });
    });
  });

  describe('遷移腳本', () => {
    test('遷移腳本應該存在', () => {
      const migrationPath = path.join(process.cwd(), 'scripts', 'migrations', '001_slot_template_setup.js');
      expect(fs.existsSync(migrationPath)).toBe(true);
    });

    test('索引部署腳本應該存在', () => {
      const deployPath = path.join(process.cwd(), 'scripts', 'deploy-firestore-indexes.js');
      expect(fs.existsSync(deployPath)).toBe(true);
    });
  });

  describe('配置完整性檢查', () => {
    test('所有 Slot Template 集合都應該有對應的索引', () => {
      const configPath = path.join(process.cwd(), 'config', 'firestore-collections.json');
      const indexPath = path.join(process.cwd(), 'firestore.indexes.json');
      
      const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      const indexConfig = JSON.parse(fs.readFileSync(indexPath, 'utf8'));
      
      const slotCollections = Object.keys(config.collections).filter(name =>
        name.startsWith('slot_') || name.includes('_slot_')
      );
      
      slotCollections.forEach(collectionName => {
        const hasIndex = indexConfig.indexes.some(
          index => index.collectionGroup === collectionName
        );
        expect(hasIndex).toBe(true);
      });
    });

    test('索引欄位應該對應集合結構中的欄位', () => {
      const configPath = path.join(process.cwd(), 'config', 'firestore-collections.json');
      const indexPath = path.join(process.cwd(), 'firestore.indexes.json');
      
      const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      const indexConfig = JSON.parse(fs.readFileSync(indexPath, 'utf8'));
      
      // 檢查 user_slot_states 的索引
      const userStateCollection = config.collections.user_slot_states;
      const userStateIndexes = indexConfig.indexes.filter(
        index => index.collectionGroup === 'user_slot_states'
      );
      
      userStateIndexes.forEach(index => {
        index.fields.forEach(field => {
          const fieldPath = field.fieldPath;
          
          // 如果是嵌套欄位 (如 active_task.status)
          if (fieldPath.includes('.')) {
            const [rootField, nestedField] = fieldPath.split('.');
            expect(userStateCollection.document_structure[rootField]).toBeDefined();
            
            if (userStateCollection.document_structure[rootField].schema) {
              expect(userStateCollection.document_structure[rootField].schema[nestedField]).toBeDefined();
            }
          } else {
            // 如果是根欄位
            expect(userStateCollection.document_structure[fieldPath]).toBeDefined();
          }
        });
      });
    });
  });
});