/**
 * 測試數據管理器
 * 負責測試環境的數據準備、清理和隔離
 * 基於第一性原則設計，確保測試環境完全可控
 */

const admin = require('firebase-admin');
const path = require('path');
const { exec } = require('child_process');
const { promisify } = require('util');

const execAsync = promisify(exec);

class TestDataManager {
  constructor() {
    this.testUserPrefix = 'U_test_';
    this.testStudentPrefix = '測試';
    this.testCoursePrefix = '測試';
    this.testUserId = 'U_test_user_qa';
    
    // 標準測試數據模板
    this.standardStudents = [
      { name: '測試小明', testId: 'test_student_001' },
      { name: '測試Lumi', testId: 'test_student_002' },
      { name: '測試小光', testId: 'test_student_003' }
    ];
    
    this.standardCourses = [
      {
        studentName: '測試小明',
        courseName: '測試數學課',
        scheduleTime: '14:00',
        timeReference: 'tomorrow',
        isRecurring: false
      },
      {
        studentName: '測試Lumi',
        courseName: '測試鋼琴課',
        scheduleTime: '15:30',
        dayOfWeek: 3, // 週三
        isRecurring: true
      },
      {
        studentName: '測試小光',
        courseName: '測試英文課',
        scheduleTime: '10:00',
        dayOfWeek: 1, // 週一
        isRecurring: true
      }
    ];
    
    this.createdData = {
      students: new Set(),
      courses: new Set(),
      reminders: new Set(),
      conversations: new Set()
    };
  }

  /**
   * 初始化 Firebase 連接（如果尚未初始化）
   */
  async initializeFirebase() {
    try {
      if (!admin.apps.length) {
        // 使用環境變數或服務帳戶密鑰初始化
        if (process.env.FIREBASE_PROJECT_ID) {
          admin.initializeApp({
            credential: admin.credential.applicationDefault(),
            projectId: process.env.FIREBASE_PROJECT_ID,
          });
        } else {
          throw new Error('Firebase 配置缺失');
        }
      }
      
      this.firestore = admin.firestore();
      this.storage = admin.storage();
      
      console.log('✅ Firebase 初始化成功');
      return true;
    } catch (error) {
      console.error('❌ Firebase 初始化失敗:', error.message);
      return false;
    }
  }

  /**
   * 檢查測試環境狀態
   */
  async checkTestEnvironment() {
    console.log('🔍 檢查測試環境...');
    
    const checks = {
      firebase: false,
      redis: false,
      lineBot: false,
      openai: false
    };
    
    try {
      // Firebase 檢查
      checks.firebase = await this.initializeFirebase();
      
      // Redis 檢查
      try {
        const { getRedisService } = require('../../src/services/redisService');
        const redisService = getRedisService();
        if (redisService && redisService.client) {
          await redisService.client.ping();
          checks.redis = true;
        }
      } catch (error) {
        console.warn('⚠️ Redis 連接檢查失敗:', error.message);
      }
      
      // LINE Bot 檢查
      checks.lineBot = !!process.env.LINE_CHANNEL_ACCESS_TOKEN;
      
      // OpenAI 檢查
      checks.openai = !!process.env.OPENAI_API_KEY;
      
    } catch (error) {
      console.error('❌ 環境檢查失敗:', error);
    }
    
    console.log('📊 環境檢查結果:', checks);
    
    const criticalServices = ['firebase', 'lineBot', 'openai'];
    const criticalFailed = criticalServices.some(service => !checks[service]);
    
    if (criticalFailed) {
      console.error('❌ 關鍵服務未就緒，無法執行測試');
      return false;
    }
    
    console.log('✅ 測試環境檢查通過');
    return true;
  }

  /**
   * 清理所有測試數據
   */
  async cleanupAllTestData() {
    console.log('🧹 開始清理測試數據...');
    
    if (!this.firestore) {
      console.error('❌ Firestore 未初始化');
      return false;
    }
    
    try {
      let totalCleaned = 0;
      
      // 清理測試用戶的對話狀態
      console.log('🗑️ 清理對話狀態...');
      const conversationsRef = this.firestore.collection('conversations');
      const conversationQuery = conversationsRef.where('userId', '>=', this.testUserPrefix)
                                                .where('userId', '<', this.testUserPrefix + 'z');
      
      const conversationSnapshot = await conversationQuery.get();
      const conversationBatch = this.firestore.batch();
      
      conversationSnapshot.docs.forEach(doc => {
        conversationBatch.delete(doc.ref);
        totalCleaned++;
      });
      
      if (conversationSnapshot.docs.length > 0) {
        await conversationBatch.commit();
        console.log(`✅ 清理對話狀態: ${conversationSnapshot.docs.length} 筆`);
      }
      
      // 清理測試課程
      console.log('🗑️ 清理測試課程...');
      const coursesRef = this.firestore.collection('courses');
      const courseQuery = coursesRef.where('userId', '==', this.testUserId);
      
      const courseSnapshot = await courseQuery.get();
      const courseBatch = this.firestore.batch();
      
      courseSnapshot.docs.forEach(doc => {
        courseBatch.delete(doc.ref);
        totalCleaned++;
      });
      
      if (courseSnapshot.docs.length > 0) {
        await courseBatch.commit();
        console.log(`✅ 清理測試課程: ${courseSnapshot.docs.length} 筆`);
      }
      
      // 清理測試學生
      console.log('🗑️ 清理測試學生...');
      const parentsRef = this.firestore.collection('parents').doc(this.testUserId);
      const parentDoc = await parentsRef.get();
      
      if (parentDoc.exists) {
        await parentsRef.delete();
        totalCleaned++;
        console.log('✅ 清理測試學生資料');
      }
      
      // 清理測試提醒
      console.log('🗑️ 清理測試提醒...');
      const remindersRef = this.firestore.collection('reminders');
      const reminderQuery = remindersRef.where('userId', '==', this.testUserId);
      
      const reminderSnapshot = await reminderQuery.get();
      const reminderBatch = this.firestore.batch();
      
      reminderSnapshot.docs.forEach(doc => {
        reminderBatch.delete(doc.ref);
        totalCleaned++;
      });
      
      if (reminderSnapshot.docs.length > 0) {
        await reminderBatch.commit();
        console.log(`✅ 清理測試提醒: ${reminderSnapshot.docs.length} 筆`);
      }
      
      // 清理 Redis 測試數據
      try {
        const { getRedisService } = require('../../src/services/redisService');
        const redisService = getRedisService();
        
        if (redisService && redisService.client) {
          const testKeys = await redisService.client.keys(`*${this.testUserId}*`);
          if (testKeys.length > 0) {
            await redisService.client.del(...testKeys);
            console.log(`✅ 清理 Redis 測試數據: ${testKeys.length} 筆`);
            totalCleaned += testKeys.length;
          }
        }
      } catch (error) {
        console.warn('⚠️ Redis 清理跳過:', error.message);
      }
      
      console.log(`🎉 測試數據清理完成，共清理 ${totalCleaned} 筆資料`);
      
      // 重置追蹤記錄
      Object.keys(this.createdData).forEach(key => {
        this.createdData[key].clear();
      });
      
      return true;
    } catch (error) {
      console.error('❌ 清理測試數據失敗:', error);
      return false;
    }
  }

  /**
   * 為指定階段準備測試數據
   */
  async setupPhaseData(phase) {
    console.log(`📋 準備 Phase ${phase} 測試數據...`);
    
    switch (phase) {
      case 'A':
        return await this.setupPhaseAData();
      case 'B':
        return await this.setupPhaseBData();
      case 'C':
        return await this.setupPhaseCData();
      default:
        console.error('❌ 未知的測試階段:', phase);
        return false;
    }
  }

  /**
   * 準備 Phase A 數據（無需預置數據，只需環境檢查）
   */
  async setupPhaseAData() {
    console.log('📋 Phase A: 獨立功能測試（無需預置數據）');
    
    // Phase A 不需要預置數據，只需要確保環境乾淨
    const cleaned = await this.cleanupAllTestData();
    if (!cleaned) {
      return false;
    }
    
    console.log('✅ Phase A 數據準備完成');
    return true;
  }

  /**
   * 準備 Phase B 數據（需要 Phase A 的成功執行結果）
   */
  async setupPhaseBData() {
    console.log('📋 Phase B: 依賴功能測試（基於 Phase A 數據）');
    
    // Phase B 需要驗證 Phase A 是否已經執行並成功建立了基礎數據
    const hasBasicData = await this.verifyPhaseAResults();
    
    if (!hasBasicData) {
      console.error('❌ Phase A 數據不存在，無法執行 Phase B');
      return false;
    }
    
    console.log('✅ Phase B 數據準備完成（已驗證 Phase A 數據存在）');
    return true;
  }

  /**
   * 準備 Phase C 數據（需要 Phase A + B 的完整數據）
   */
  async setupPhaseCData() {
    console.log('📋 Phase C: 複雜操作測試（基於完整數據環境）');
    
    // Phase C 需要驗證前面階段的數據
    const hasCompleteData = await this.verifyPhaseBResults();
    
    if (!hasCompleteData) {
      console.error('❌ Phase B 數據不完整，無法執行 Phase C');
      return false;
    }
    
    console.log('✅ Phase C 數據準備完成（已驗證完整數據環境）');
    return true;
  }

  /**
   * 驗證 Phase A 執行結果
   */
  async verifyPhaseAResults() {
    try {
      // 檢查是否有測試用戶建立的學生資料
      const parentsRef = this.firestore.collection('parents').doc(this.testUserId);
      const parentDoc = await parentsRef.get();
      
      if (!parentDoc.exists) {
        console.log('⚠️ Phase A 未建立學生資料');
        return false;
      }
      
      const parentData = parentDoc.data();
      if (!parentData.students || parentData.students.length === 0) {
        console.log('⚠️ Phase A 未建立學生列表');
        return false;
      }
      
      // 檢查是否有建立的課程
      const coursesRef = this.firestore.collection('courses');
      const courseQuery = coursesRef.where('userId', '==', this.testUserId);
      const courseSnapshot = await courseQuery.get();
      
      if (courseSnapshot.empty) {
        console.log('⚠️ Phase A 未建立課程');
        return false;
      }
      
      console.log(`✅ Phase A 驗證通過: ${parentData.students.length} 個學生, ${courseSnapshot.size} 門課程`);
      return true;
      
    } catch (error) {
      console.error('❌ Phase A 結果驗證失敗:', error);
      return false;
    }
  }

  /**
   * 驗證 Phase B 執行結果
   */
  async verifyPhaseBResults() {
    try {
      // 首先驗證 Phase A 的結果
      const hasPhaseA = await this.verifyPhaseAResults();
      if (!hasPhaseA) {
        return false;
      }
      
      // 檢查是否有課程內容記錄
      const coursesRef = this.firestore.collection('courses');
      const courseQuery = coursesRef.where('userId', '==', this.testUserId);
      const courseSnapshot = await courseQuery.get();
      
      let hasRecords = false;
      courseSnapshot.docs.forEach(doc => {
        const data = doc.data();
        if (data.courseRecord && (data.courseRecord.notes || data.courseRecord.photos)) {
          hasRecords = true;
        }
      });
      
      // 檢查是否有設定的提醒
      const remindersRef = this.firestore.collection('reminders');
      const reminderQuery = remindersRef.where('userId', '==', this.testUserId);
      const reminderSnapshot = await reminderQuery.get();
      
      console.log(`✅ Phase B 驗證: 課程記錄=${hasRecords}, 提醒數=${reminderSnapshot.size}`);
      return true;
      
    } catch (error) {
      console.error('❌ Phase B 結果驗證失敗:', error);
      return false;
    }
  }

  /**
   * 獲取測試數據摘要
   */
  async getTestDataSummary() {
    try {
      const summary = {
        timestamp: new Date().toISOString(),
        students: 0,
        courses: 0,
        reminders: 0,
        conversations: 0
      };
      
      // 學生數量
      const parentsRef = this.firestore.collection('parents').doc(this.testUserId);
      const parentDoc = await parentsRef.get();
      
      if (parentDoc.exists) {
        const parentData = parentDoc.data();
        summary.students = parentData.students ? parentData.students.length : 0;
      }
      
      // 課程數量
      const coursesRef = this.firestore.collection('courses');
      const courseQuery = coursesRef.where('userId', '==', this.testUserId);
      const courseSnapshot = await courseQuery.get();
      summary.courses = courseSnapshot.size;
      
      // 提醒數量
      const remindersRef = this.firestore.collection('reminders');
      const reminderQuery = remindersRef.where('userId', '==', this.testUserId);
      const reminderSnapshot = await reminderQuery.get();
      summary.reminders = reminderSnapshot.size;
      
      // 對話狀態
      const conversationsRef = this.firestore.collection('conversations');
      const conversationQuery = conversationsRef.where('userId', '==', this.testUserId);
      const conversationSnapshot = await conversationQuery.get();
      summary.conversations = conversationSnapshot.size;
      
      return summary;
    } catch (error) {
      console.error('❌ 獲取測試數據摘要失敗:', error);
      return null;
    }
  }

  /**
   * 驗證測試前置條件
   */
  async verifyPrerequisites(testCase) {
    const { phase, dependencies = [] } = testCase;
    
    if (dependencies.length === 0) {
      return true; // 無依賴的測試用例
    }
    
    // 根據依賴類型檢查
    for (const dep of dependencies) {
      switch (dep) {
        case 'basic_students':
          const hasStudents = await this.verifyPhaseAResults();
          if (!hasStudents) {
            console.log(`❌ 前置條件未滿足: ${dep}`);
            return false;
          }
          break;
          
        case 'basic_courses':
          // 已在 verifyPhaseAResults 中檢查
          break;
          
        case 'course_records':
          const hasRecords = await this.verifyPhaseBResults();
          if (!hasRecords) {
            console.log(`❌ 前置條件未滿足: ${dep}`);
            return false;
          }
          break;
          
        default:
          console.warn(`⚠️ 未知的依賴類型: ${dep}`);
      }
    }
    
    return true;
  }

  /**
   * 測試結束後的清理
   */
  async postTestCleanup() {
    console.log('🧹 執行測試結束清理...');
    
    // 保留最近的測試數據摘要用於分析
    const summary = await this.getTestDataSummary();
    if (summary) {
      console.log('📊 最終測試數據摘要:', summary);
    }
    
    // 執行完整清理
    return await this.cleanupAllTestData();
  }
}

// 建立全域實例
const testDataManager = new TestDataManager();

// 匯出主要方法
module.exports = {
  TestDataManager,
  
  // 便利方法
  checkEnvironment: () => testDataManager.checkTestEnvironment(),
  cleanupAll: () => testDataManager.cleanupAllTestData(),
  setupPhase: (phase) => testDataManager.setupPhaseData(phase),
  verifyPrerequisites: (testCase) => testDataManager.verifyPrerequisites(testCase),
  getSummary: () => testDataManager.getTestDataSummary(),
  postCleanup: () => testDataManager.postTestCleanup(),
  
  // 測試數據常數
  TEST_USER_ID: testDataManager.testUserId,
  TEST_STUDENT_PREFIX: testDataManager.testStudentPrefix,
  TEST_COURSE_PREFIX: testDataManager.testCoursePrefix,
};

// 如果直接執行此腳本
if (require.main === module) {
  async function runTestDataManagerCLI() {
    const args = process.argv.slice(2);
    const command = args[0];
    
    switch (command) {
      case 'check':
        await testDataManager.checkTestEnvironment();
        break;
        
      case 'clean':
        await testDataManager.cleanupAllTestData();
        break;
        
      case 'setup':
        const phase = args[1] || 'A';
        await testDataManager.setupPhaseData(phase);
        break;
        
      case 'summary':
        const summary = await testDataManager.getTestDataSummary();
        console.log('📊 測試數據摘要:', JSON.stringify(summary, null, 2));
        break;
        
      default:
        console.log(`
使用方法:
  node test-data-manager.js check   # 檢查測試環境
  node test-data-manager.js clean   # 清理測試數據
  node test-data-manager.js setup A # 準備階段數據 (A/B/C)
  node test-data-manager.js summary # 查看數據摘要
        `);
    }
  }
  
  runTestDataManagerCLI().catch(console.error);
}