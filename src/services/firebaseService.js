const admin = require('firebase-admin');

/**
 * Firebase Firestore 服務封裝
 * 負責所有業務資料的存取和管理
 */

let db = null;

/**
 * 初始化 Firebase Admin SDK
 */
function initializeFirebase() {
  if (!db) {
    try {
      // 確保 dotenv 已載入（防止環境變數未載入）
      if (typeof require !== 'undefined') {
        try {
          require('dotenv').config();
        } catch (e) {
          // dotenv 可能已載入或不可用，忽略錯誤
        }
      }

      // 檢查必要的環境變數
      const requiredEnvVars = ['FIREBASE_PROJECT_ID', 'FIREBASE_PRIVATE_KEY', 'FIREBASE_CLIENT_EMAIL', 'FIREBASE_STORAGE_BUCKET'];
      const missingVars = requiredEnvVars.filter((varName) => !process.env[varName]);

      if (missingVars.length > 0) {
        throw new Error(`❌ 缺少 Firebase 環境變數: ${missingVars.join(', ')}`);
      }

      // 初始化 Firebase Admin
      if (!admin.apps.length) {
        admin.initializeApp({
          credential: admin.credential.cert({
            projectId: process.env.FIREBASE_PROJECT_ID,
            privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
            clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
          }),
          projectId: process.env.FIREBASE_PROJECT_ID,
          storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
        });
      }

      db = admin.firestore();
      console.log('✅ Firebase 服務初始化完成');
    } catch (error) {
      console.error('❌ Firebase 初始化失敗:', error);
      throw error;
    }
  }
  return db;
}

/**
 * 家長 (Parents) 相關操作
 */

/**
 * 取得或創建家長資料
 */
async function getOrCreateParent(userId, displayName = null) {
  try {
    const firestore = initializeFirebase();
    const parentRef = firestore.collection('parents').doc(userId);
    const parentDoc = await parentRef.get();

    if (parentDoc.exists) {
      return parentDoc.data();
    }
    // 創建新家長資料
    const newParent = {
      lineUserId: userId,
      displayName: displayName || '未設定',
      students: [],
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    await parentRef.set(newParent);
    console.log('✅ 創建新家長資料:', userId);
    return newParent;
  } catch (error) {
    console.error('❌ 家長資料操作失敗:', error);
    throw error;
  }
}

/**
 * 學生 (Students) 相關操作
 */

/**
 * 取得學生資料
 */
async function getStudent(userId, studentName) {
  try {
    const parent = await getOrCreateParent(userId);
    const student = parent.students?.find((s) => s.studentName === studentName);

    if (!student) {
      console.log('❓ 學生不存在:', studentName);
      return null;
    }

    return student;
  } catch (error) {
    console.error('❌ 取得學生資料失敗:', error);
    throw error;
  }
}

/**
 * 取得用戶的所有學生列表
 */
async function getStudentsByUser(userId) {
  try {
    const parent = await getOrCreateParent(userId);
    return parent.students || [];
  } catch (error) {
    console.error('❌ 取得學生列表失敗:', error);
    throw error;
  }
}

/**
 * 新增學生資料
 */
async function addStudent(userId, studentName, calendarId) {
  try {
    const firestore = initializeFirebase();
    const parentRef = firestore.collection('parents').doc(userId);

    const newStudent = {
      studentName,
      calendarId,
      createdAt: new Date(),
    };

    await parentRef.update({
      students: admin.firestore.FieldValue.arrayUnion(newStudent),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    console.log('✅ 新增學生資料:', studentName);
    return newStudent;
  } catch (error) {
    console.error('❌ 新增學生失敗:', error);
    throw error;
  }
}

/**
 * 更新學生的 calendarId（自動修復用）
 */
async function updateStudentCalendarId(userId, studentName, newCalendarId) {
  try {
    const firestore = initializeFirebase();
    const parentRef = firestore.collection('parents').doc(userId);
    const snap = await parentRef.get();
    if (!snap.exists) throw new Error(`找不到家長文件: ${userId}`);

    const parent = snap.data();
    const students = Array.isArray(parent.students) ? [...parent.students] : [];
    const idx = students.findIndex((s) => s.studentName === studentName);
    if (idx === -1) throw new Error(`找不到學生: ${studentName}`);

    students[idx] = { ...students[idx], calendarId: newCalendarId };

    await parentRef.update({
      students,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    console.log('✅ 已更新 calendarId:', studentName, newCalendarId);
    return students[idx];
  } catch (error) {
    console.error('❌ 更新學生 calendarId 失敗:', error);
    throw error;
  }
}

/**
 * 課程 (Courses) 相關操作
 */

/**
 * 儲存課程資料
 */
async function saveCourse(courseData) {
  try {
    const firestore = initializeFirebase();
    const coursesRef = firestore.collection('courses');

    const courseDoc = {
      ...courseData,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    const docRef = await coursesRef.add(courseDoc);
    const courseId = docRef.id;

    // 更新文件以包含 courseId
    await docRef.update({ courseId });

    console.log('✅ 課程資料已儲存:', courseId);
    return { courseId, ...courseDoc };
  } catch (error) {
    console.error('❌ 儲存課程失敗:', error);
    throw error;
  }
}

/**
 * 根據學生查詢課程
 */
async function getCoursesByStudent(userId, studentName, options = {}) {
  try {
    const firestore = initializeFirebase();
    let query = firestore.collection('courses')
      .where('userId', '==', userId)
      .where('studentName', '==', studentName);

    // 日期範圍篩選
    if (options.startDate) {
      query = query.where('courseDate', '>=', options.startDate);
    }
    if (options.endDate) {
      query = query.where('courseDate', '<=', options.endDate);
    }

    // 排序
    query = query.orderBy('courseDate').orderBy('scheduleTime');

    const snapshot = await query.get();
    const courses = [];

    snapshot.forEach((doc) => {
      courses.push({ id: doc.id, ...doc.data() });
    });

    console.log(`📚 查詢到 ${courses.length} 筆課程資料`);
    return courses;
  } catch (error) {
    console.error('❌ 查詢課程失敗:', error);
    throw error;
  }
}

/**
 * 根據條件查找特定課程
 */
async function findCourse(userId, studentName, courseName, courseDate = null) {
  try {
    const firestore = initializeFirebase();
    let query = firestore.collection('courses')
      .where('userId', '==', userId)
      .where('studentName', '==', studentName)
      .where('courseName', '==', courseName);

    if (courseDate) {
      query = query.where('courseDate', '==', courseDate);
    }

    const snapshot = await query.get();

    if (snapshot.empty) {
      return null;
    }

    // 如果有多筆結果，取最近的一筆
    const courses = [];
    snapshot.forEach((doc) => {
      courses.push({ id: doc.id, ...doc.data() });
    });

    courses.sort((a, b) => new Date(b.courseDate) - new Date(a.courseDate));
    return courses[0];
  } catch (error) {
    console.error('❌ 查找課程失敗:', error);
    throw error;
  }
}

/**
 * 更新課程記錄（內容、照片等）
 */
async function updateCourseRecord(courseId, recordData) {
  try {
    const firestore = initializeFirebase();
    const courseRef = firestore.collection('courses').doc(courseId);

    const updateData = {
      courseRecord: {
        ...recordData,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    await courseRef.update(updateData);
    console.log('✅ 課程記錄已更新:', courseId);
    return true;
  } catch (error) {
    console.error('❌ 更新課程記錄失敗:', error);
    throw error;
  }
}

/**
 * 提醒 (Reminders) 相關操作
 */

/**
 * 創建提醒記錄
 */
async function createReminder(reminderData) {
  try {
    const firestore = initializeFirebase();
    const remindersRef = firestore.collection('reminders');

    const reminderDoc = {
      ...reminderData,
      executed: false,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    const docRef = await remindersRef.add(reminderDoc);
    const reminderId = docRef.id;

    // 更新文件以包含 reminderId
    await docRef.update({ reminderId });

    console.log('✅ 提醒記錄已創建:', reminderId);
    return { reminderId, ...reminderDoc };
  } catch (error) {
    console.error('❌ 創建提醒失敗:', error);
    throw error;
  }
}

/**
 * 查詢需要執行的提醒
 */
async function getPendingReminders() {
  try {
    const firestore = initializeFirebase();
    const now = new Date();

    const snapshot = await firestore.collection('reminders')
      .where('executed', '==', false)
      .where('triggerTime', '<=', now)
      .get();

    const reminders = [];
    snapshot.forEach((doc) => {
      reminders.push({ id: doc.id, ...doc.data() });
    });

    console.log(`⏰ 找到 ${reminders.length} 筆待執行提醒`);
    return reminders;
  } catch (error) {
    console.error('❌ 查詢提醒失敗:', error);
    throw error;
  }
}

/**
 * 標記提醒為已執行
 */
async function markReminderExecuted(reminderId) {
  try {
    const firestore = initializeFirebase();
    const reminderRef = firestore.collection('reminders').doc(reminderId);

    await reminderRef.update({
      executed: true,
      executedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    console.log('✅ 提醒已標記為執行:', reminderId);
    return true;
  } catch (error) {
    console.error('❌ 標記提醒執行失敗:', error);
    throw error;
  }
}

/**
 * 刪除課程
 */
async function deleteCourse(courseId) {
  try {
    const firestore = initializeFirebase();
    const courseRef = firestore.collection('courses').doc(courseId);

    await courseRef.update({
      cancelled: true,
      cancelledAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    console.log('✅ 課程已標記為取消:', courseId);
    return true;
  } catch (error) {
    console.error('❌ 刪除課程失敗:', error);
    throw error;
  }
}

/**
 * 測試 Firebase 連接
 */
async function testConnection() {
  try {
    const firestore = initializeFirebase();
    // 嘗試讀取一個測試文件
    await firestore.collection('_test').doc('connection').set({
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      status: 'ok',
    });

    console.log('🔗 Firebase 連接測試成功');
    return true;
  } catch (error) {
    console.error('❌ Firebase 連接測試失敗:', error);
    return false;
  }
}

/**
 * 添加文檔到指定集合
 */
async function addDocument(collectionName, data) {
  try {
    const firestore = initializeFirebase();
    const collectionRef = firestore.collection(collectionName);

    const docData = {
      ...data,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    const docRef = await collectionRef.add(docData);
    console.log(`✅ 文檔已添加到 ${collectionName}:`, docRef.id);
    return docRef;
  } catch (error) {
    console.error(`❌ 添加文檔失敗 (${collectionName}):`, error);
    throw error;
  }
}

/**
 * 更新文檔
 */
async function updateDocument(collectionName, docId, data) {
  try {
    const firestore = initializeFirebase();
    const docRef = firestore.collection(collectionName).doc(docId);

    const updateData = {
      ...data,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    await docRef.update(updateData);
    console.log(`✅ 文檔已更新 (${collectionName}/${docId})`);
    return true;
  } catch (error) {
    console.error(`❌ 更新文檔失敗 (${collectionName}/${docId}):`, error);
    throw error;
  }
}

/**
 * 取得集合參照 (用於複雜查詢)
 */
function getCollection(collectionName) {
  const firestore = initializeFirebase();
  return firestore.collection(collectionName);
}

/**
 * 物理刪除指定集合的文件
 */
async function deleteDocument(collectionName, docId) {
  try {
    const firestore = initializeFirebase();
    await firestore.collection(collectionName).doc(docId).delete();
    console.log(`🗑️ 已物理刪除文檔 (${collectionName}/${docId})`);
    return true;
  } catch (error) {
    console.error(`❌ 物理刪除文檔失敗 (${collectionName}/${docId}):`, error);
    return false;
  }
}

/**
 * Firebase Storage 圖片上傳功能
 */

/**
 * 上傳圖片到 Firebase Storage
 * @param {Buffer} imageBuffer - 圖片二進位資料
 * @param {string} courseId - 課程ID
 * @param {string} fileName - 檔案名稱
 * @returns {Promise<string>} 公開圖片網址
 */
async function uploadImage(imageBuffer, courseId, fileName) {
  try {
    console.log(`🖼️ 開始上傳圖片: ${fileName} 到課程 ${courseId}`);

    // 初始化 Firebase (確保 Storage 可用)
    initializeFirebase();

    // 建立 Storage 參考路徑
    const timestamp = Date.now();
    const safeFileName = fileName.replace(/[^a-zA-Z0-9.-]/g, '_');
    const storagePath = `courses-images/${courseId}/${timestamp}_${safeFileName}`;

    const bucket = admin.storage().bucket();
    const file = bucket.file(storagePath);

    // 上傳圖片
    await file.save(imageBuffer, {
      metadata: {
        contentType: 'image/jpeg',
        cacheControl: 'public, max-age=31536000',
        metadata: {
          courseId,
          uploadedAt: new Date().toISOString(),
        },
      },
    });

    // 設定公開存取權限
    await file.makePublic();

    // 建立公開網址
    const publicUrl = `https://storage.googleapis.com/${bucket.name}/${storagePath}`;

    console.log(`✅ 圖片上傳成功: ${publicUrl}`);
    return publicUrl;
  } catch (error) {
    console.error('❌ 圖片上傳失敗:', error);
    throw new Error(`圖片上傳失敗: ${error.message}`);
  }
}

/**
 * 批量上傳多張圖片
 * @param {Array<{buffer: Buffer, fileName: string}>} images - 圖片陣列
 * @param {string} courseId - 課程ID
 * @returns {Promise<Array<string>>} 公開圖片網址陣列
 */
async function uploadMultipleImages(images, courseId) {
  try {
    console.log(`🖼️ 開始批量上傳 ${images.length} 張圖片到課程 ${courseId}`);

    const uploadPromises = images.map((image, index) => {
      const fileName = image.fileName || `image_${index + 1}.jpg`;
      return uploadImage(image.buffer, courseId, fileName);
    });

    const imageUrls = await Promise.all(uploadPromises);

    console.log(`✅ 批量上傳完成，共 ${imageUrls.length} 張圖片`);
    return imageUrls;
  } catch (error) {
    console.error('❌ 批量圖片上傳失敗:', error);
    throw new Error(`批量圖片上傳失敗: ${error.message}`);
  }
}

/**
 * 刪除 Storage 中的圖片
 * @param {string} imageUrl - 圖片公開網址
 * @returns {Promise<boolean>} 刪除是否成功
 */
async function deleteImage(imageUrl) {
  try {
    // 從 URL 解析出 Storage 路徑
    const url = new URL(imageUrl);
    const pathMatch = url.pathname.match(/\/([^\/]+)\/(.*)/);

    if (!pathMatch) {
      throw new Error('無法解析圖片路徑');
    }

    const bucketName = pathMatch[1];
    const filePath = pathMatch[2];

    const bucket = admin.storage().bucket(bucketName);
    const file = bucket.file(filePath);

    await file.delete();
    console.log(`🗑️ 圖片已刪除: ${filePath}`);
    return true;
  } catch (error) {
    console.error('❌ 刪除圖片失敗:', error);
    return false;
  }
}

module.exports = {
  // 初始化
  initializeFirebase,
  testConnection,
  // 關閉
  shutdownFirebase: async function shutdownFirebase() {
    try {
      if (admin && admin.apps && admin.apps.length > 0) {
        await Promise.all(admin.apps.map((app) => app.delete().catch(() => {})));
      }
      db = null;
      console.log('🧹 Firebase 已關閉');
      return true;
    } catch (e) {
      console.warn('⚠️ Firebase 關閉時發生例外:', e?.message || e);
      return false;
    }
  },

  // 通用操作
  addDocument,
  updateDocument,
  getCollection,
  deleteDocument,

  // 家長操作
  getOrCreateParent,

  // 學生操作
  getStudent,
  getStudentsByUser,
  addStudent,
  updateStudentCalendarId,

  // 課程操作
  saveCourse,
  getCoursesByStudent,
  findCourse,
  updateCourseRecord,
  deleteCourse,

  // 提醒操作
  createReminder,
  getPendingReminders,
  markReminderExecuted,

  // 圖片上傳操作
  uploadImage,
  uploadMultipleImages,
  deleteImage,
};
