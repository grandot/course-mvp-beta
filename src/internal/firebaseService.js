/**
 * FirebaseService - Firebase Firestore 操作實現
 * 職責：數據持久化存儲
 * 架構層級：Internal Implementation
 */

const admin = require('firebase-admin');

class FirebaseService {
  static isInitialized = false;
  static db = null;

  /**
   * 初始化 Firebase Admin SDK
   */
  static initialize() {
    if (this.isInitialized) {
      return this.db;
    }

    try {
      // 檢查必要的環境變數
      const requiredEnvs = [
        'FIREBASE_PROJECT_ID',
        'FIREBASE_CLIENT_EMAIL',
        'FIREBASE_PRIVATE_KEY'
      ];

      for (const env of requiredEnvs) {
        if (!process.env[env]) {
          throw new Error(`Missing required environment variable: ${env}`);
        }
      }

      // 配置 Firebase Admin
      const serviceAccount = {
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n')
      };

      // 初始化 Firebase App
      if (!admin.apps.length) {
        admin.initializeApp({
          credential: admin.credential.cert(serviceAccount),
          databaseURL: `https://${process.env.FIREBASE_PROJECT_ID}.firebaseio.com`
        });
      }

      this.db = admin.firestore();
      this.isInitialized = true;

      console.log('✅ Firebase initialized successfully');
      return this.db;

    } catch (error) {
      console.error('❌ Firebase initialization failed:', error.message);
      throw new Error(`Firebase initialization failed: ${error.message}`);
    }
  }

  /**
   * 獲取 Firestore 實例
   */
  static getDb() {
    if (!this.isInitialized) {
      return this.initialize();
    }
    return this.db;
  }

  /**
   * 創建文檔
   */
  static async createDocument(collection, data) {
    try {
      const db = this.getDb();
      const docRef = await db.collection(collection).add({
        ...data,
        created_at: admin.firestore.FieldValue.serverTimestamp(),
        updated_at: admin.firestore.FieldValue.serverTimestamp()
      });

      return {
        success: true,
        id: docRef.id,
        data: {
          id: docRef.id,
          ...data
        }
      };
    } catch (error) {
      console.error(`❌ Create document failed in ${collection}:`, error);
      throw new Error(`Database create failed: ${error.message}`);
    }
  }

  /**
   * 查詢文檔
   */
  static async queryDocuments(collection, filters = {}) {
    try {
      const db = this.getDb();
      let query = db.collection(collection);

      // 應用篩選條件
      Object.entries(filters).forEach(([field, value]) => {
        if (value !== undefined && value !== null) {
          query = query.where(field, '==', value);
        }
      });

      const snapshot = await query.get();
      const results = [];

      snapshot.forEach(doc => {
        results.push({
          id: doc.id,
          ...doc.data()
        });
      });

      return results;
    } catch (error) {
      console.error(`❌ Query documents failed in ${collection}:`, error);
      throw new Error(`Database query failed: ${error.message}`);
    }
  }

  /**
   * 更新文檔
   */
  static async updateDocument(collection, docId, data) {
    try {
      const db = this.getDb();
      await db.collection(collection).doc(docId).update({
        ...data,
        updated_at: admin.firestore.FieldValue.serverTimestamp()
      });

      return {
        success: true,
        id: docId,
        data: {
          id: docId,
          ...data
        }
      };
    } catch (error) {
      console.error(`❌ Update document failed in ${collection}:`, error);
      throw new Error(`Database update failed: ${error.message}`);
    }
  }

  /**
   * 刪除文檔
   */
  static async deleteDocument(collection, docId) {
    try {
      const db = this.getDb();
      await db.collection(collection).doc(docId).delete();

      return {
        success: true,
        id: docId
      };
    } catch (error) {
      console.error(`❌ Delete document failed in ${collection}:`, error);
      throw new Error(`Database delete failed: ${error.message}`);
    }
  }

  /**
   * 健康檢查
   */
  static async healthCheck() {
    try {
      const db = this.getDb();
      // 嘗試讀取一個小的集合來測試連接
      await db.collection('_health').limit(1).get();
      return { status: 'healthy', timestamp: new Date().toISOString() };
    } catch (error) {
      console.error('❌ Firebase health check failed:', error);
      return { status: 'unhealthy', error: error.message, timestamp: new Date().toISOString() };
    }
  }
}

module.exports = FirebaseService;