/**
 * 檢查 Firebase Storage 設置狀態
 */

require('dotenv').config();
const FirebaseService = require('./src/internal/firebaseService');

console.log('🔍 檢查 Firebase Storage 設置狀態...\n');

async function checkStorageSetup() {
  try {
    const healthResult = await FirebaseService.healthCheck();
    
    console.log('📊 健康檢查結果:');
    console.log(`   整體狀態: ${healthResult.status}`);
    console.log(`   Firestore: ${healthResult.firestore.status}`);
    console.log(`   Storage: ${healthResult.storage.status}`);
    
    if (healthResult.storage.status === 'healthy') {
      console.log('\n✅ Firebase Storage 設置完成！');
      console.log('🎉 圖片上傳功能已可正常使用');
    } else {
      console.log('\n⚠️ Firebase Storage 需要設置:');
      console.log(`   錯誤: ${healthResult.storage.error}`);
      console.log(`   建議: ${healthResult.storage.suggestion}`);
      
      console.log('\n📋 設置步驟:');
      console.log('1. 前往 https://console.firebase.google.com/');
      console.log('2. 選擇專案: course-management-bot-da85a');
      console.log('3. 左側選單點選 "Storage"');
      console.log('4. 點擊 "開始使用" 創建 bucket');
      console.log('5. Bucket 名稱: course-management-bot-da85a.appspot.com');
    }
    
  } catch (error) {
    console.error('❌ 檢查失敗:', error.message);
  }
}

checkStorageSetup();