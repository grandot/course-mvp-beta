/**
 * 處理記錄課程內容任務
 * 支持文字內容記錄和圖片上傳
 */

const firebaseService = require('../services/firebaseService');
const googleCalendarService = require('../services/googleCalendarService');
const lineService = require('../services/lineService');

/**
 * 驗證必要的 slots
 */
function validateSlots(slots) {
  const errors = [];

  // 內容記錄至少需要內容本身或圖片
  if (!slots.content && !slots.imageUrl && !slots.imageBuffer) {
    errors.push('課程內容或圖片');
  }

  return errors;
}

/**
 * 處理時間參考轉換為具體日期
 */
function resolveTimeReference(timeReference) {
  const today = new Date();
  let targetDate;

  switch (timeReference) {
    case 'today':
      targetDate = today;
      break;
    case 'yesterday':
      targetDate = new Date(today);
      targetDate.setDate(today.getDate() - 1);
      break;
    case 'tomorrow':
      targetDate = new Date(today);
      targetDate.setDate(today.getDate() + 1);
      break;
    case 'day_before_yesterday':
      targetDate = new Date(today);
      targetDate.setDate(today.getDate() - 2);
      break;
    default:
      targetDate = today;
  }

  return targetDate.toISOString().split('T')[0]; // YYYY-MM-DD 格式
}

/**
 * 根據學生姓名、課程名稱和日期查找對應的課程
 */
async function findMatchingCourse(studentName, courseName, targetDate) {
  try {
    console.log(`🔍 查找課程: ${studentName} - ${courseName} - ${targetDate}`);

    // 從 Firebase 查詢學生的課程
    const coursesQuery = await firebaseService.getCollection('courses')
      .where('studentName', '==', studentName)
      .get();

    if (coursesQuery.empty) {
      console.log('❓ 未找到該學生的任何課程');
      return null;
    }

    // 查找匹配的課程
    for (const doc of coursesQuery.docs) {
      const courseData = doc.data();

      // 如果有明確的課程名稱，先匹配課程名稱
      if (courseName && courseData.courseName) {
        if (!courseData.courseName.includes(courseName.replace('課', ''))) {
          continue;
        }
      }

      // 檢查日期匹配
      if (courseData.courseDate === targetDate) {
        console.log('✅ 找到匹配的單次課程:', doc.id);
        return { id: doc.id, ...courseData };
      }

      // 對於重複課程，檢查日期是否在重複範圍內
      if (courseData.recurring && courseData.dayOfWeek !== undefined) {
        const targetDateObj = new Date(targetDate);
        if (targetDateObj.getDay() === courseData.dayOfWeek) {
          console.log('✅ 找到匹配的重複課程:', doc.id);
          return { id: doc.id, ...courseData };
        }
      }
    }

    console.log('❓ 未找到完全匹配的課程');
    return null;
  } catch (error) {
    console.error('❌ 查找課程時發生錯誤:', error);
    throw error;
  }
}

/**
 * 主要的記錄內容處理函式
 */
async function handle_record_content_task(slots, userId = null) {
  console.log('📝 開始處理記錄課程內容任務:', slots);

  try {
    // 驗證 slots
    const validationErrors = validateSlots(slots);
    if (validationErrors.length > 0) {
      return {
        success: false,
        code: 'MISSING_CONTENT',
        message: `請提供以下必要資訊：${validationErrors.join('、')}`,
      };
    }

    // 解析時間參考
    let targetDate;
    if (slots.courseDate) {
      targetDate = slots.courseDate;
    } else if (slots.timeReference) {
      targetDate = resolveTimeReference(slots.timeReference);
    } else {
      targetDate = resolveTimeReference('today'); // 預設為今天
    }

    // 尋找對應的課程
    let matchingCourse = null;
    if (slots.studentName) {
      matchingCourse = await findMatchingCourse(
        slots.studentName,
        slots.courseName,
        targetDate,
      );
    }

    // 處理圖片上傳（如果有圖片）
    const uploadedImageUrls = [];
    if (slots.imageBuffer) {
      try {
        console.log('🖼️ 開始處理圖片上傳');
        const fileName = slots.messageId ? `line_image_${slots.messageId}.jpg` : 'course_image.jpg';

        // 如果找到對應課程，使用課程ID；否則使用時間戳作為資料夾
        const courseId = matchingCourse ? matchingCourse.id : `temp_${Date.now()}`;

        const imageUrl = await firebaseService.uploadImage(
          slots.imageBuffer,
          courseId,
          fileName,
        );
        uploadedImageUrls.push(imageUrl);
        console.log('✅ 圖片上傳成功:', imageUrl);
      } catch (uploadError) {
        console.error('❌ 圖片上傳失敗:', uploadError);
        // 圖片上傳失敗不影響文字記錄，繼續處理
      }
    }

    // 準備記錄資料
    const contentRecord = {
      content: slots.content || '',
      imageUrl: slots.imageUrl || null,
      photos: uploadedImageUrls,
      recordDate: targetDate,
      createdAt: new Date().toISOString(),
      userId: userId || 'anonymous',
    };

    // 如果找到對應課程，添加課程關聯資訊
    if (matchingCourse) {
      contentRecord.courseId = matchingCourse.id;
      contentRecord.studentName = matchingCourse.studentName;
      contentRecord.courseName = matchingCourse.courseName;
      contentRecord.scheduleTime = matchingCourse.scheduleTime;
    } else {
      // 沒有找到對應課程，使用 slots 中的資訊
      contentRecord.studentName = slots.studentName || '未指定學生';
      contentRecord.courseName = slots.courseName || '未指定課程';
    }

    // 儲存到 Firebase
    const docRef = await firebaseService.addDocument('course_contents', contentRecord);
    console.log('✅ 課程內容記錄已儲存:', docRef.id);

    // 如果找到對應課程，更新課程的最後記錄時間
    if (matchingCourse) {
      await firebaseService.updateDocument('courses', matchingCourse.id, {
        lastContentUpdate: new Date().toISOString(),
        hasContent: true,
      });
    }

    // 組成成功回應訊息
    let responseMessage = '✅ 課程內容已成功記錄！';

    if (matchingCourse) {
      responseMessage += `\n📚 課程：${matchingCourse.studentName} - ${matchingCourse.courseName}`;
      responseMessage += `\n📅 日期：${targetDate}`;
    } else {
      responseMessage += '\n📝 記錄為獨立內容';
      if (slots.studentName) responseMessage += `\n👨‍🎓 學生：${slots.studentName}`;
      if (slots.courseName) responseMessage += `\n📚 課程：${slots.courseName}`;
      responseMessage += `\n📅 日期：${targetDate}`;
    }

    if (slots.content) responseMessage += `\n💬 內容：${slots.content}`;
    if (slots.imageUrl) responseMessage += '\n🖼️ 已附加圖片';
    if (uploadedImageUrls.length > 0) {
      responseMessage += `\n📸 已上傳 ${uploadedImageUrls.length} 張照片`;
    }

    return {
      success: true,
      code: 'RECORD_CONTENT_OK',
      message: responseMessage,
      data: {
        recordId: docRef.id,
        courseId: matchingCourse?.id || null,
        targetDate,
      },
    };
  } catch (error) {
    console.error('❌ 記錄課程內容失敗:', error);
    return {
      success: false,
      code: 'RECORD_CONTENT_FAILED',
      message: `記錄課程內容時發生錯誤：${error.message}`,
    };
  }
}

module.exports = handle_record_content_task;

// 額外匯出輔助函式供測試使用
module.exports.validateSlots = validateSlots;
module.exports.findMatchingCourse = findMatchingCourse;
module.exports.resolveTimeReference = resolveTimeReference;
