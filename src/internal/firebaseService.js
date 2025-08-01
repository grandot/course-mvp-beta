/**
 * FirebaseService - Firebase Firestore 操作實現
 * 職責：數據持久化存儲
 * 架構層級：Internal Implementation
 */

const admin = require('firebase-admin');

class FirebaseService {
  static isInitialized = false;
  static db = null;
  static storage = null;

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
          databaseURL: `https://${process.env.FIREBASE_PROJECT_ID}.firebaseio.com`,
          storageBucket: process.env.FIREBASE_STORAGE_BUCKET || `${process.env.FIREBASE_PROJECT_ID}.appspot.com`
        });
      }

      this.db = admin.firestore();
      this.storage = admin.storage();
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
   * 獲取單個文檔
   */
  static async getDocument(collection, docId) {
    try {
      const db = this.getDb();
      const doc = await db.collection(collection).doc(docId).get();

      if (!doc.exists) {
        return {
          exists: false,
          id: docId,
          data: null
        };
      }

      return {
        exists: true,
        id: doc.id,
        data: doc.data()
      };
    } catch (error) {
      console.error(`❌ Get document failed in ${collection}:`, error);
      throw new Error(`Database get failed: ${error.message}`);
    }
  }

  /**
   * 更新文檔
   */
  static async updateDocument(collection, docId, data) {
    try {
      const db = this.getDb();
      // 使用 set 與 merge 選項，如果文檔不存在會自動創建
      await db.collection(collection).doc(docId).set({
        ...data,
        updated_at: admin.firestore.FieldValue.serverTimestamp()
      }, { merge: true });

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
   * 健康檢查（包含 Storage）
   */
  static async healthCheck() {
    const results = {
      timestamp: new Date().toISOString(),
      firestore: { status: 'unknown' },
      storage: { status: 'unknown' }
    };

    // 檢查 Firestore
    try {
      const db = this.getDb();
      await db.collection('_health').limit(1).get();
      results.firestore = { status: 'healthy' };
    } catch (error) {
      console.error('❌ Firestore health check failed:', error);
      results.firestore = { status: 'unhealthy', error: error.message };
    }

    // 檢查 Storage
    try {
      const storage = this.getStorage();
      const bucket = storage.bucket();
      await bucket.exists();
      results.storage = { status: 'healthy' };
    } catch (error) {
      console.error('❌ Storage health check failed:', error);
      results.storage = { 
        status: 'unhealthy', 
        error: error.message,
        suggestion: 'Please enable Firebase Storage and create default bucket'
      };
    }

    const overallHealthy = results.firestore.status === 'healthy' && results.storage.status === 'healthy';
    return {
      status: overallHealthy ? 'healthy' : 'partial',
      ...results
    };
  }

  /**
   * 獲取 Storage 實例
   */
  static getStorage() {
    if (!this.isInitialized) {
      this.initialize();
    }
    return this.storage;
  }

  /**
   * 上傳文件到 Firebase Storage
   * @param {Buffer} buffer - 文件數據
   * @param {string} filePath - 存儲路徑
   * @param {Object} metadata - 文件元數據
   * @returns {Promise<Object>} 上傳結果
   */
  static async uploadFile(buffer, filePath, metadata = {}) {
    try {
      const storage = this.getStorage();
      const bucket = storage.bucket();
      const file = bucket.file(filePath);

      // 設置元數據
      const fileMetadata = {
        metadata: {
          ...metadata,
          uploadTime: new Date().toISOString()
        },
        // 設置內容類型
        contentType: metadata.contentType || 'image/jpeg'
      };

      // 上傳文件
      await file.save(buffer, fileMetadata);

      // 獲取下載URL
      const [downloadURL] = await file.getSignedUrl({
        action: 'read',
        expires: '03-09-2491' // 長期有效URL
      });

      return {
        success: true,
        filePath,
        downloadURL,
        fileSize: buffer.length,
        metadata: fileMetadata.metadata
      };

    } catch (error) {
      console.error(`❌ File upload failed to ${filePath}:`, error);
      throw new Error(`Storage upload failed: ${error.message}`);
    }
  }

  /**
   * 獲取文件下載URL
   * @param {string} filePath - 文件路徑
   * @returns {Promise<string>} 下載URL
   */
  static async getDownloadURL(filePath) {
    try {
      const storage = this.getStorage();
      const bucket = storage.bucket();
      const file = bucket.file(filePath);

      const [downloadURL] = await file.getSignedUrl({
        action: 'read',
        expires: '03-09-2491'
      });

      return downloadURL;
    } catch (error) {
      console.error(`❌ Get download URL failed for ${filePath}:`, error);
      throw new Error(`Get download URL failed: ${error.message}`);
    }
  }

  /**
   * 刪除文件
   * @param {string} filePath - 文件路徑
   * @returns {Promise<boolean>} 刪除結果
   */
  static async deleteFile(filePath) {
    try {
      const storage = this.getStorage();
      const bucket = storage.bucket();
      const file = bucket.file(filePath);

      await file.delete();
      return true;
    } catch (error) {
      console.error(`❌ File delete failed for ${filePath}:`, error);
      throw new Error(`File delete failed: ${error.message}`);
    }
  }
}

module.exports = FirebaseService;