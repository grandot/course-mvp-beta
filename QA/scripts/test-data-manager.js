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
      { name: '小明', testId: 'test_student_001' },
      { name: 'Lumi', testId: 'test_student_002' },
      { name: '小光', testId: 'test_student_003' }
    ];
    
    this.standardCourses = [
      {
        studentName: '小明',
        courseName: '數學課',
        scheduleTime: '14:00',
        timeReference: 'tomorrow',
        isRecurring: false
      },
      {
        studentName: 'Lumi',
        courseName: '鋼琴課',
        scheduleTime: '15:30',
        dayOfWeek: 3, // 週三
        isRecurring: true
      },
      {
        studentName: '小光',
        courseName: '英文課',
        scheduleTime: '10:00',
        dayOfWeek: 1, // 週一
        isRecurring: true
      }
    ];
    
    this.initFirebase();
  }
  
  /**
   * 初始化 Firebase
   */
  initFirebase() {
    try {
      // 檢查是否已經初始化
      if (admin.apps.length > 0) {
        this.firestore = admin.firestore();
        return;
      }
      
      // 從環境變數讀取配置
      const projectId = process.env.FIREBASE_PROJECT_ID;
      const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');
      const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
      
      if (!projectId || !privateKey || !clientEmail) {
        throw new Error('Firebase 環境變數未設定完整');
      }
      
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId,
          privateKey,
          clientEmail
        }),
        projectId
      });
      
      this.firestore = admin.firestore();
      console.log('🔥 Firebase Admin SDK 初始化完成');
      
    } catch (error) {
      console.error('❌ Firebase 初始化失敗:', error);
      throw error;
    }
  }
  
  /**
   * 建立基礎學生和課程數據
   */
  async createBasicStudentsAndCourses() {
    try {
      console.log('📚 建立基礎測試數據...');
      
      // 1. 建立測試家長
      const parentRef = this.firestore.collection('parents').doc(this.testUserId);
      const parentData = {
        lineUserId: this.testUserId,
        displayName: '測試家長',
        students: [],
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      };
      
      await parentRef.set(parentData);
      console.log('✅ 建立測試家長:', this.testUserId);
      
      // 2. 建立測試學生 (不設定 calendarId，讓系統自動創建真實的)
      const students = [];
      for (const studentTemplate of this.standardStudents) {
        const student = {
          studentName: studentTemplate.name,
          // calendarId 移除，讓 ensureStudentCalendar() 自動創建真實的
          createdAt: new Date(),
          testId: studentTemplate.testId
        };
        students.push(student);
      }
      
      // 更新家長文檔，添加學生
      await parentRef.update({
        students: admin.firestore.FieldValue.arrayUnion(...students),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      
      console.log(`✅ 建立 ${students.length} 個測試學生`);
      
      // 3. 建立測試課程
      let courseCount = 0;
      const coursesRef = this.firestore.collection('courses');
      
      for (const courseTemplate of this.standardCourses) {
        const courseData = {
          userId: this.testUserId,
          studentName: courseTemplate.studentName,
          courseName: courseTemplate.courseName,
          scheduleTime: courseTemplate.scheduleTime,
          recurring: courseTemplate.isRecurring,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          testData: true
        };
        
        // 添加日期或重複信息
        if (courseTemplate.timeReference) {
          courseData.timeReference = courseTemplate.timeReference;
          courseData.courseDate = this.resolveTimeReference(courseTemplate.timeReference);
        }
        
        if (courseTemplate.dayOfWeek) {
          courseData.dayOfWeek = courseTemplate.dayOfWeek;
        }
        
        const docRef = await coursesRef.add(courseData);
        await docRef.update({ courseId: docRef.id });
        
        courseCount++;
      }
      
      console.log(`✅ 建立 ${courseCount} 個測試課程`);
      
      // 4. 驗證數據建立成功
      const summary = await this.getTestDataSummary();
      console.log('📊 測試數據摘要:', summary);
      
      return true;
      
    } catch (error) {
      console.error('❌ 建立基礎測試數據失敗:', error);
      return false;
    }
  }
  
  /**
   * 解析時間參考為具體日期
   */
  resolveTimeReference(timeReference) {
    const today = new Date();
    let targetDate;
    
    switch (timeReference) {
      case 'today':
        targetDate = today;
        break;
      case 'tomorrow':
        targetDate = new Date(today);
        targetDate.setDate(today.getDate() + 1);
        break;
      case 'day_after_tomorrow':
        targetDate = new Date(today);
        targetDate.setDate(today.getDate() + 2);
        break;
      case 'yesterday':
        targetDate = new Date(today);
        targetDate.setDate(today.getDate() - 1);
        break;
      default:
        return null;
    }
    
    return targetDate.toISOString().split('T')[0]; // YYYY-MM-DD 格式
  }
  
  /**
   * 清理所有測試數據
   */
  async cleanupAllTestData() {
    try {
      console.log('🧹 清理所有測試數據...');
      
      let cleanedCount = 0;
      
      // 1. 清理測試家長數據
      const parentsRef = this.firestore.collection('parents');
      const parentQuery = parentsRef.where('lineUserId', '==', this.testUserId);
      const parentSnapshot = await parentQuery.get();
      
      if (!parentSnapshot.empty) {
        const batch = this.firestore.batch();
        parentSnapshot.docs.forEach(doc => batch.delete(doc.ref));
        await batch.commit();
        cleanedCount += parentSnapshot.size;
        console.log(`🗑️ 清理家長數據: ${parentSnapshot.size} 筆`);
      }
      
      // 2. 清理測試課程數據
      const coursesRef = this.firestore.collection('courses');
      const courseQuery = coursesRef.where('userId', '==', this.testUserId);
      const courseSnapshot = await courseQuery.get();
      
      if (!courseSnapshot.empty) {
        const batch = this.firestore.batch();
        courseSnapshot.docs.forEach(doc => batch.delete(doc.ref));
        await batch.commit();
        cleanedCount += courseSnapshot.size;
        console.log(`🗑️ 清理課程數據: ${courseSnapshot.size} 筆`);
      }
      
      // 3. 清理測試提醒數據
      const remindersRef = this.firestore.collection('reminders');
      const reminderQuery = remindersRef.where('userId', '==', this.testUserId);
      const reminderSnapshot = await reminderQuery.get();
      
      if (!reminderSnapshot.empty) {
        const batch = this.firestore.batch();
        reminderSnapshot.docs.forEach(doc => batch.delete(doc.ref));
        await batch.commit();
        cleanedCount += reminderSnapshot.size;
        console.log(`🗑️ 清理提醒數據: ${reminderSnapshot.size} 筆`);
      }
      
      console.log(`✅ 清理完成，共清理 ${cleanedCount} 筆數據`);
      return true;
      
    } catch (error) {
      console.error('❌ 清理測試數據失敗:', error);
      return false;
    }
  }
  
  /**
   * 準備指定階段的數據
   */
  async setupPhase(phase) {
    console.log(`🚀 準備 Phase ${phase} 測試環境...`);
    return await this.setupPhaseData(phase);
  }
  
  /**
   * 根據階段設置數據
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
   * 準備 Phase A 數據（只清理環境，不預置數據）
   */
  async setupPhaseAData() {
    console.log('📋 Phase A: 獨立功能測試（無需預置數據）');
    
    const cleaned = await this.cleanupAllTestData();
    if (!cleaned) {
      return false;
    }
    
    console.log('✅ Phase A 數據準備完成（環境已清理）');
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
    
    // Phase B 特定的額外數據準備（如課程記錄、提醒等）
    // TODO: 根據需要添加 Phase B 特定的數據準備邏輯
    
    console.log('✅ Phase B 數據準備完成');
    return true;
  }

  /**
   * 準備 Phase C 數據（需要 Phase A & B 的數據）
   */
  async setupPhaseCData() {
    console.log('📋 Phase C: 複合功能測試（基於 Phase A&B 數據）');
    
    const hasPhaseAData = await this.verifyPhaseAResults();
    const hasPhaseBData = await this.verifyPhaseBResults();
    
    if (!hasPhaseAData || !hasPhaseBData) {
      console.error('❌ Phase A 或 Phase B 數據不完整，無法執行 Phase C');
      return false;
    }
    
    // Phase C 特定的數據準備
    // TODO: 根據需要添加 Phase C 特定的數據準備邏輯
    
    console.log('✅ Phase C 數據準備完成');
    return true;
  }

  /**
   * 驗證 Phase A 執行結果
   */
  async verifyPhaseAResults() {
    try {
      // 檢查是否有測試學生數據
      const parentRef = this.firestore.collection('parents').doc(this.testUserId);
      const parentDoc = await parentRef.get();
      
      if (!parentDoc.exists) {
        return false;
      }
      
      const parentData = parentDoc.data();
      const hasStudents = parentData.students && parentData.students.length > 0;
      
      // 檢查是否有測試課程數據
      const coursesRef = this.firestore.collection('courses');
      const courseQuery = coursesRef.where('userId', '==', this.testUserId);
      const courseSnapshot = await courseQuery.get();
      const hasCourses = courseSnapshot.size > 0;
      
      return hasStudents && hasCourses;
      
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
      // Phase B 的驗證邏輯
      // TODO: 根據具體的 Phase B 測試內容來實現
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
      
      return summary;
      
    } catch (error) {
      console.error('❌ 獲取測試數據摘要失敗:', error);
      return null;
    }
  }
}

module.exports = { TestDataManager };