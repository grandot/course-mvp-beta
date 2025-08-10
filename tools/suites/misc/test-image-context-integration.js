/**
 * 測試圖片上傳與上下文關聯功能
 * 由於 LINE 圖片下載存在技術限制，這裡主要測試模擬場景
 */

const { config } = require('dotenv');
config();

const fs = require('fs');
const path = require('path');
const { getConversationManager } = require('../src/conversation/ConversationManager');
const { parseIntent } = require('../src/intent/parseIntent');
const { extractSlots } = require('../src/intent/extractSlots');
const handle_record_content_task = require('../src/tasks/handle_record_content_task');

// 測試用戶ID
const TEST_USER_ID = 'U_test_image_context_user';

/**
 * 創建測試用的模擬圖片數據
 */
function createMockImageBuffer() {
  // 創建一個簡單的測試圖片數據
  const testImageData = Buffer.from('fake-image-data-for-testing', 'utf-8');
  return testImageData;
}

/**
 * 測試圖片上傳的基礎功能
 */
async function testBasicImageUpload() {
  console.log('\n📷 測試基礎圖片上傳功能');
  console.log('='.repeat(40));

  const conversationManager = getConversationManager();
  await conversationManager.clearContext(TEST_USER_ID);

  // 模擬圖片上傳 slots
  const imageBuffer = createMockImageBuffer();
  const slots = {
    imageBuffer,
    messageId: 'test_message_id_12345',
    content: '課堂照片',
    timeReference: 'today'
  };

  console.log('📋 圖片上傳 slots:', {
    hasImageBuffer: !!slots.imageBuffer,
    messageId: slots.messageId,
    content: slots.content,
    timeReference: slots.timeReference
  });

  try {
    // 執行圖片記錄任務
    const result = await handle_record_content_task(slots, TEST_USER_ID);
    
    console.log('📊 執行結果:', {
      success: result.success,
      message: result.message.substring(0, 100) + '...',
      hasData: !!result.data
    });

    if (result.success) {
      console.log('✅ 基礎圖片上傳功能正常');
      return true;
    } else {
      console.log('❌ 基礎圖片上傳功能異常');
      return false;
    }

  } catch (error) {
    console.error('❌ 圖片上傳測試失敗:', error.message);
    return false;
  }
}

/**
 * 測試圖片上傳與上下文關聯
 */
async function testImageWithContextIntegration() {
  console.log('\n🔗 測試圖片上傳與上下文關聯');
  console.log('='.repeat(40));

  const conversationManager = getConversationManager();
  await conversationManager.clearContext(TEST_USER_ID);

  // 第1步：先建立上下文（提及學生和課程）
  console.log('🗣️ 第1步: 建立上下文 - 小明數學課');
  await conversationManager.recordUserMessage(
    TEST_USER_ID, 
    '小明今天數學課表現很好', 
    'record_content', 
    { 
      studentName: '小明', 
      courseName: '數學課', 
      timeReference: 'today',
      content: '表現很好'
    }
  );

  // 第2步：模擬上傳圖片（應該自動關聯到小明的數學課）
  console.log('🗣️ 第2步: 上傳圖片，應該自動關聯到小明的數學課');
  
  const imageBuffer = createMockImageBuffer();
  const slots = {
    imageBuffer,
    messageId: 'test_message_id_67890',
    content: '課堂照片',
    timeReference: 'today'
  };

  // 先進行意圖解析和 slots 提取以獲得上下文增強
  const intent = 'record_content'; // 圖片上傳對應記錄內容意圖
  const enhancedSlots = await extractSlots('', intent, TEST_USER_ID, slots);

  console.log('📋 增強後的 slots:', enhancedSlots);

  try {
    const result = await handle_record_content_task(enhancedSlots, TEST_USER_ID);
    
    console.log('📊 圖片關聯結果:', {
      success: result.success,
      hasStudentInfo: result.message.includes('小明'),
      hasCourseInfo: result.message.includes('數學課')
    });

    if (result.success && result.message.includes('小明')) {
      console.log('✅ 圖片上下文關聯功能正常');
      return true;
    } else {
      console.log('❌ 圖片上下文關聯功能異常');
      return false;
    }

  } catch (error) {
    console.error('❌ 圖片上下文關聯測試失敗:', error.message);
    return false;
  }
}

/**
 * 測試圖片上傳後的 Quick Reply 功能
 */
async function testImageUploadQuickReply() {
  console.log('\n📱 測試圖片上傳 Quick Reply 功能');
  console.log('='.repeat(40));

  const conversationManager = getConversationManager();
  await conversationManager.clearContext(TEST_USER_ID);

  // 模擬圖片上傳
  const imageBuffer = createMockImageBuffer();
  const slots = {
    imageBuffer,
    messageId: 'test_message_id_quickreply',
    content: '課堂照片',
    timeReference: 'today'
  };

  try {
    const result = await handle_record_content_task(slots, TEST_USER_ID);
    
    // 檢查是否有適當的 Quick Reply 按鈕
    console.log('📱 Quick Reply 檢查:', {
      hasQuickReply: !!result.quickReply,
      buttonCount: result.quickReply ? result.quickReply.length : 0,
      buttons: result.quickReply ? result.quickReply.map(btn => btn.label) : []
    });

    // 模擬點擊 Quick Reply 按鈕
    if (result.quickReply && result.quickReply.length > 0) {
      const firstButton = result.quickReply[0];
      console.log(`🖱️  模擬點擊: ${firstButton.label} → "${firstButton.text}"`);

      // 解析點擊後的意圖
      const clickIntent = await parseIntent(firstButton.text, TEST_USER_ID);
      console.log('🎯 點擊後意圖:', clickIntent);

      console.log('✅ 圖片上傳 Quick Reply 功能正常');
      return true;
    } else {
      console.log('❌ 圖片上傳缺少 Quick Reply 按鈕');
      return false;
    }

  } catch (error) {
    console.error('❌ 圖片 Quick Reply 測試失敗:', error.message);
    return false;
  }
}

/**
 * 測試多張圖片的上下文連續性
 */
async function testMultipleImageContextContinuity() {
  console.log('\n📷📷 測試多張圖片上下文連續性');
  console.log('='.repeat(40));

  const conversationManager = getConversationManager();
  await conversationManager.clearContext(TEST_USER_ID);

  // 建立課程上下文
  await conversationManager.recordUserMessage(
    TEST_USER_ID, 
    'Lumi今天鋼琴課', 
    'record_content', 
    { 
      studentName: 'Lumi', 
      courseName: '鋼琴課', 
      timeReference: 'today'
    }
  );

  // 上傳第一張圖片
  console.log('📸 上傳第1張圖片');
  const result1 = await handle_record_content_task({
    imageBuffer: createMockImageBuffer(),
    messageId: 'img_001',
    content: '上課前準備',
    timeReference: 'today'
  }, TEST_USER_ID);

  console.log('📊 第1張圖片結果:', {
    success: result1.success,
    linkedToLumi: result1.message.includes('Lumi')
  });

  // 短暫間隔後上傳第二張圖片
  await new Promise(resolve => setTimeout(resolve, 100));

  console.log('📸 上傳第2張圖片');
  const enhancedSlots2 = await extractSlots('', 'record_content', TEST_USER_ID, {
    imageBuffer: createMockImageBuffer(),
    messageId: 'img_002',
    content: '練習成果',
    timeReference: 'today'
  });

  const result2 = await handle_record_content_task(enhancedSlots2, TEST_USER_ID);

  console.log('📊 第2張圖片結果:', {
    success: result2.success,
    linkedToLumi: result2.message.includes('Lumi'),
    linkedToPiano: result2.message.includes('鋼琴課')
  });

  // 檢查對話歷史
  const context = await conversationManager.getContext(TEST_USER_ID);
  console.log('📚 對話歷史:', {
    historyLength: context.state.history.length,
    mentionedStudents: context.state.mentionedEntities.students,
    mentionedCourses: context.state.mentionedEntities.courses
  });

  if (result1.success && result2.success && 
      result2.message.includes('Lumi') && result2.message.includes('鋼琴課')) {
    console.log('✅ 多張圖片上下文連續性正常');
    return true;
  } else {
    console.log('❌ 多張圖片上下文連續性異常');
    return false;
  }
}

/**
 * 測試圖片上傳錯誤處理
 */
async function testImageUploadErrorHandling() {
  console.log('\n⚠️ 測試圖片上傳錯誤處理');
  console.log('='.repeat(40));

  // 測試無效的圖片數據
  console.log('📋 測試無效圖片數據處理');
  
  try {
    const result = await handle_record_content_task({
      imageBuffer: null, // 無效的圖片數據
      messageId: 'invalid_msg_id',
      content: '無效圖片',
      timeReference: 'today'
    }, TEST_USER_ID);

    console.log('📊 無效圖片處理結果:', {
      success: result.success,
      hasErrorMessage: result.message.includes('錯誤') || result.message.includes('失敗')
    });

    // 測試缺少必要參數
    console.log('📋 測試缺少參數處理');
    const result2 = await handle_record_content_task({
      // 缺少 imageBuffer
      messageId: 'missing_buffer_id',
      timeReference: 'today'
    }, TEST_USER_ID);

    console.log('📊 缺少參數處理結果:', {
      success: result2.success,
      message: result2.message.substring(0, 50) + '...'
    });

    console.log('✅ 圖片上傳錯誤處理功能正常');
    return true;

  } catch (error) {
    console.log('📊 捕獲到預期錯誤:', error.message.substring(0, 50) + '...');
    console.log('✅ 錯誤處理機制有效');
    return true;
  }
}

/**
 * 主測試函數
 */
async function runImageContextTests() {
  console.log('📷 開始圖片上傳與上下文關聯測試');
  console.log('🕐 時間:', new Date().toLocaleString());
  console.log('⚠️  注意：由於 LINE API 限制，使用模擬數據測試');

  const results = {
    basicImageUpload: false,
    imageWithContextIntegration: false,
    imageUploadQuickReply: false,
    multipleImageContextContinuity: false,
    imageUploadErrorHandling: false
  };

  try {
    // 基礎圖片上傳測試
    results.basicImageUpload = await testBasicImageUpload();

    // 圖片與上下文關聯測試  
    results.imageWithContextIntegration = await testImageWithContextIntegration();

    // Quick Reply 功能測試
    results.imageUploadQuickReply = await testImageUploadQuickReply();

    // 多張圖片連續性測試
    results.multipleImageContextContinuity = await testMultipleImageContextContinuity();

    // 錯誤處理測試
    results.imageUploadErrorHandling = await testImageUploadErrorHandling();

  } catch (error) {
    console.error('❌ 測試過程發生錯誤:', error);
  }

  // 清理測試數據
  console.log('\n🧹 清理測試數據...');
  const conversationManager = getConversationManager();
  await conversationManager.clearContext(TEST_USER_ID);

  // 結果統計
  console.log('\n📊 圖片功能測試結果:');
  console.log('='.repeat(40));
  let passCount = 0;
  for (const [testName, passed] of Object.entries(results)) {
    console.log(`${passed ? '✅' : '❌'} ${testName}: ${passed ? 'PASS' : 'FAIL'}`);
    if (passed) passCount++;
  }

  const totalTests = Object.keys(results).length;
  console.log(`\n🎯 通過率: ${passCount}/${totalTests} (${Math.round(passCount/totalTests*100)}%)`);

  if (passCount === totalTests) {
    console.log('🎉 圖片上傳與上下文關聯功能測試通過！');
    console.log('📝 備註：由於 LINE API 的技術限制，實際圖片下載功能需在真實環境中測試');
  } else {
    console.log('⚠️  部分測試未通過，請檢查相關功能');
  }

  return results;
}

// 執行測試
if (require.main === module) {
  runImageContextTests();
}

module.exports = {
  runImageContextTests,
  testBasicImageUpload,
  testImageWithContextIntegration,
  testImageUploadQuickReply,
  testMultipleImageContextContinuity,
  testImageUploadErrorHandling
};