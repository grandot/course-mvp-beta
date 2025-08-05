#!/usr/bin/env node

/**
 * 檢查和報告 Firestore 索引狀態
 */

require('dotenv').config();
console.log('🔍 檢查 Firestore 索引狀態...');

console.log('\n📋 當前索引配置檢查：');

// 讀取索引配置文件
const fs = require('fs');
const path = require('path');

try {
  const indexPath = path.join(__dirname, '..', 'firestore.indexes.json');
  const indexConfig = JSON.parse(fs.readFileSync(indexPath, 'utf8'));
  
  console.log('✅ 索引配置文件存在');
  console.log(`📊 已配置索引數量: ${indexConfig.indexes.length}`);
  
  // 查找 courses 相關索引
  const courseIndexes = indexConfig.indexes.filter(index => 
    index.collectionGroup === 'courses'
  );
  
  if (courseIndexes.length > 0) {
    console.log('✅ 找到 courses 集合索引:');
    courseIndexes.forEach((index, i) => {
      console.log(`  ${i + 1}. 欄位: ${index.fields.map(f => f.fieldPath).join(', ')}`);
    });
  } else {
    console.log('❌ 未找到 courses 集合索引');
  }
  
} catch (error) {
  console.error('❌ 讀取索引配置失敗:', error.message);
}

console.log('\n🚀 部署索引的方法：');
console.log('1. 手動方式：');
console.log('   - 執行查詢讓 Firestore 產生錯誤');
console.log('   - 點擊錯誤訊息中的連結');
console.log('   - 在 Firebase Console 中創建索引');
console.log('');
console.log('2. CLI 方式（需要登入）：');
console.log('   firebase login');
console.log('   firebase deploy --only firestore:indexes');
console.log('');
console.log('3. 線上 Firebase Console：');
console.log('   https://console.firebase.google.com/project/course-management-bot-da85a/firestore/indexes');

// 測試查詢以觸發索引需求
console.log('\n🧪 測試觸發索引需求...');
const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

try {
  if (!process.env.FIREBASE_PROJECT_ID || !process.env.FIREBASE_PRIVATE_KEY) {
    throw new Error('缺少 Firebase 環境變數');
  }

  const app = initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    }),
  });

  const db = getFirestore(app);
  
  console.log('✅ Firebase Admin SDK 初始化成功');
  console.log('💡 執行查詢測試時會自動提供索引創建連結');
  
} catch (error) {
  console.error('❌ Firebase 初始化失敗:', error.message);
}