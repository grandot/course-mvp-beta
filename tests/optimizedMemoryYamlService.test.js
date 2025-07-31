/**
 * OptimizedMemoryYamlService 性能測試
 * 驗證 LRU 快取策略、批量更新機制和記憶體優化
 */

const OptimizedMemoryYamlService = require('../src/services/optimizedMemoryYamlService');
const path = require('path');

class OptimizedMemoryYamlServiceTest {
  
  static async runAllTests() {
    console.log('🚀 開始 OptimizedMemoryYamlService 性能測試...\n');
    
    const testConfig = {
      maxRecords: 10,
      storagePath: path.join(process.cwd(), 'test-optimized-memory'),
      lruCacheSize: 5,        // 小快取方便測試
      cacheTTL: 2000,         // 2 秒 TTL
      batchUpdateEnabled: true,
      batchUpdateInterval: 1000, // 1 秒批量更新
      maxMemoryUsage: 1024 * 1024 // 1MB
    };
    
    const service = new OptimizedMemoryYamlService(testConfig);
    
    const testResults = {
      lruCacheEfficiency: await this.testLRUCacheEfficiency(service),
      batchUpdateMechanism: await this.testBatchUpdateMechanism(service),
      memoryOptimization: await this.testMemoryOptimization(service),
      performanceComparison: await this.testPerformanceComparison(service),
      cacheEviction: await this.testCacheEviction(service)
    };
    
    // 清理測試資料
    await service.cleanup();
    await this.cleanup(testConfig.storagePath);
    
    this.printTestResults(testResults);
    return testResults;
  }

  /**
   * 測試 LRU 快取效率
   */
  static async testLRUCacheEfficiency(service) {
    console.log('🎯 測試 LRU 快取效率...');
    const issues = [];

    try {
      // 第一次讀取 - 應該是快取未命中
      console.log('  📊 測試快取命中率:');
      
      const user1 = 'cache_test_user1';
      const startTime1 = Date.now();
      await service.getUserMemory(user1);
      const firstReadTime = Date.now() - startTime1;
      
      // 第二次讀取同一用戶 - 應該是快取命中
      const startTime2 = Date.now();
      await service.getUserMemory(user1);
      const secondReadTime = Date.now() - startTime2;
      
      console.log(`    第一次讀取: ${firstReadTime}ms (快取未命中)`);
      console.log(`    第二次讀取: ${secondReadTime}ms (快取命中)`);
      
      // 快取命中應該顯著更快
      if (secondReadTime >= firstReadTime) {
        issues.push(`快取效率問題: 第二次讀取 ${secondReadTime}ms >= 第一次 ${firstReadTime}ms`);
      } else {
        const speedup = (firstReadTime / secondReadTime).toFixed(2);
        console.log(`    ✅ 快取加速: ${speedup}x`);
      }
      
      // 檢查統計數據
      const stats = service.getPerformanceStats();
      console.log(`  📈 快取統計: 命中 ${stats.cacheHits}, 未命中 ${stats.cacheMisses}, 命中率 ${stats.hitRate}`);
      
      if (stats.cacheHits === 0) {
        issues.push('快取命中統計錯誤');
      }
      
    } catch (error) {
      issues.push(`LRU 快取效率測試異常: ${error.message}`);
    }

    const passed = issues.length === 0;
    console.log(`  ${passed ? '✅' : '❌'} LRU 快取效率測試`);
    return { category: 'LRU 快取效率', passed, details: issues };
  }

  /**
   * 測試批量更新機制
   */
  static async testBatchUpdateMechanism(service) {
    console.log('\n📦 測試批量更新機制...');
    const issues = [];

    try {
      const testUsers = ['batch_user1', 'batch_user2', 'batch_user3'];
      
      console.log('  🔄 執行多個更新操作:');
      
      const updateStartTime = Date.now();
      const updatePromises = testUsers.map(async (userId, index) => {
        return await service.updateUserMemory(userId, {
          student: `學生${index + 1}`,
          courseName: `課程${index + 1}`,
          teacher: `老師${index + 1}`
        });
      });
      
      const results = await Promise.all(updatePromises);
      const updateEndTime = Date.now();
      
      console.log(`    批量更新完成: ${testUsers.length} 個用戶 (${updateEndTime - updateStartTime}ms)`);
      
      // 檢查是否使用了批量更新
      const batchUpdateResults = results.filter(r => r.method === 'batch_update');
      if (batchUpdateResults.length !== testUsers.length) {
        issues.push(`批量更新機制未生效: ${batchUpdateResults.length}/${testUsers.length}`);
      } else {
        console.log(`    ✅ 批量更新機制生效: ${batchUpdateResults.length} 個更新`);
      }
      
      // 等待批量更新執行
      console.log('  ⏳ 等待批量更新執行...');
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // 檢查統計
      const stats = service.getPerformanceStats();
      console.log(`    📊 批量更新統計: ${stats.batchUpdates} 次`);
      
      if (stats.batchUpdates === 0) {
        issues.push('批量更新統計錯誤');
      }
      
    } catch (error) {
      issues.push(`批量更新機制測試異常: ${error.message}`);
    }

    const passed = issues.length === 0;
    console.log(`  ${passed ? '✅' : '❌'} 批量更新機制測試`);
    return { category: '批量更新機制', passed, details: issues };
  }

  /**
   * 測試記憶體優化
   */
  static async testMemoryOptimization(service) {
    console.log('\n🧠 測試記憶體優化...');
    const issues = [];

    try {
      // 填充快取直到接近記憶體限制
      console.log('  💾 填充快取測試記憶體優化:');
      
      const testUsers = [];
      for (let i = 0; i < 20; i++) {
        testUsers.push(`memory_test_user${i}`);
      }
      
      // 逐個添加用戶到快取
      for (const userId of testUsers) {
        await service.updateUserMemory(userId, {
          student: `學生${userId}`,
          courseName: `課程${userId}`,
          notes: 'x'.repeat(1000) // 添加較大的數據
        });
      }
      
      const stats = service.getPerformanceStats();
      console.log(`    快取大小: ${stats.cacheSize}/${stats.maxCacheSize}`);
      console.log(`    記憶體使用: ${stats.memoryUsageMB}MB/${stats.maxMemoryMB}MB`);
      
      // 檢查快取大小是否受到限制
      if (stats.cacheSize > parseInt(stats.maxCacheSize)) {
        issues.push(`快取大小超過限制: ${stats.cacheSize} > ${stats.maxCacheSize}`);
      } else {
        console.log(`    ✅ 快取大小控制正常`);
      }
      
      // 檢查記憶體使用是否合理
      const memoryUsageMB = parseFloat(stats.memoryUsageMB);
      const maxMemoryMB = parseFloat(stats.maxMemoryMB);
      if (memoryUsageMB > maxMemoryMB * 1.2) { // 允許 20% 緩衝
        console.log(`    ⚠️ 記憶體使用偏高: ${memoryUsageMB}MB > ${maxMemoryMB}MB`);
      } else {
        console.log(`    ✅ 記憶體使用合理`);
      }
      
    } catch (error) {
      issues.push(`記憶體優化測試異常: ${error.message}`);
    }

    const passed = issues.length === 0;
    console.log(`  ${passed ? '✅' : '❌'} 記憶體優化測試`);
    return { category: '記憶體優化', passed, details: issues };
  }

  /**
   * 測試性能對比
   */
  static async testPerformanceComparison(service) {
    console.log('\n⚡ 測試性能對比...');
    const issues = [];

    try {
      const testUser = 'performance_test_user';
      const testIterations = 10;
      
      console.log(`  🏃 執行 ${testIterations} 次讀取操作:`);
      
      // 第一次讀取建立快取
      await service.getUserMemory(testUser);
      
      // 測試快取讀取性能
      const cacheReadTimes = [];
      for (let i = 0; i < testIterations; i++) {
        const startTime = Date.now();
        await service.getUserMemory(testUser);
        cacheReadTimes.push(Date.now() - startTime);
      }
      
      const avgCacheReadTime = cacheReadTimes.reduce((a, b) => a + b, 0) / cacheReadTimes.length;
      console.log(`    平均快取讀取時間: ${avgCacheReadTime.toFixed(2)}ms`);
      
      // 測試更新性能
      const updateTimes = [];
      for (let i = 0; i < 5; i++) {
        const startTime = Date.now();
        await service.updateUserMemory(testUser, {
          student: '測試學生',
          courseName: `測試課程${i}`,
          updateIndex: i
        });
        updateTimes.push(Date.now() - startTime);
      }
      
      const avgUpdateTime = updateTimes.reduce((a, b) => a + b, 0) / updateTimes.length;
      console.log(`    平均更新時間: ${avgUpdateTime.toFixed(2)}ms`);
      
      // 性能基準檢查
      if (avgCacheReadTime > 5) {
        issues.push(`快取讀取性能不佳: ${avgCacheReadTime.toFixed(2)}ms > 5ms`);
      } else {
        console.log(`    ✅ 快取讀取性能良好`);
      }
      
      if (avgUpdateTime > 50) {
        issues.push(`更新性能不佳: ${avgUpdateTime.toFixed(2)}ms > 50ms`);
      } else {
        console.log(`    ✅ 更新性能良好`);
      }
      
    } catch (error) {
      issues.push(`性能對比測試異常: ${error.message}`);
    }

    const passed = issues.length === 0;
    console.log(`  ${passed ? '✅' : '❌'} 性能對比測試`);
    return { category: '性能對比', passed, details: issues };
  }

  /**
   * 測試快取驅逐機制
   */
  static async testCacheEviction(service) {
    console.log('\n🗑️ 測試快取驅逐機制...');
    const issues = [];

    try {
      const maxCacheSize = 5; // 配置的快取大小
      
      console.log(`  📚 測試 LRU 驅逐 (快取大小: ${maxCacheSize}):`);
      
      // 填充快取到最大容量
      const users = [];
      for (let i = 0; i < maxCacheSize; i++) {
        const userId = `eviction_user${i}`;
        users.push(userId);
        await service.getUserMemory(userId);
      }
      
      let stats = service.getPerformanceStats();
      console.log(`    快取填充完成: ${stats.cacheSize}/${maxCacheSize}`);
      
      // 添加新用戶，應該觸發 LRU 驅逐
      const newUser = 'eviction_new_user';
      await service.getUserMemory(newUser);
      
      stats = service.getPerformanceStats();
      console.log(`    添加新用戶後: ${stats.cacheSize}/${maxCacheSize}`);
      
      if (stats.cacheSize > maxCacheSize) {
        issues.push(`快取驅逐失敗: ${stats.cacheSize} > ${maxCacheSize}`);
      } else {
        console.log(`    ✅ LRU 驅逐機制正常`);
      }
      
      // 測試 TTL 驅逐
      console.log('  ⏰ 測試 TTL 驅逐:');
      await new Promise(resolve => setTimeout(resolve, 2500)); // 等待超過 TTL
      
      // 觸發 TTL 清理
      await service.getUserMemory('ttl_test_user');
      
      const finalStats = service.getPerformanceStats();
      console.log(`    TTL 清理後快取大小: ${finalStats.cacheSize}`);
      
      // TTL 清理應該清除過期項目
      if (finalStats.cacheSize > 2) { // 應該只剩下最近的幾個
        console.log(`    ⚠️ TTL 清理可能不完整: ${finalStats.cacheSize} 個項目`);
      } else {
        console.log(`    ✅ TTL 驅逐機制正常`);
      }
      
    } catch (error) {
      issues.push(`快取驅逐機制測試異常: ${error.message}`);
    }

    const passed = issues.length === 0;
    console.log(`  ${passed ? '✅' : '❌'} 快取驅逐機制測試`);
    return { category: '快取驅逐機制', passed, details: issues };
  }

  /**
   * 清理測試檔案
   */
  static async cleanup(testStoragePath) {
    try {
      const fs = require('fs').promises;
      const files = await fs.readdir(testStoragePath);
      for (const file of files) {
        await fs.unlink(path.join(testStoragePath, file));
      }
      await fs.rmdir(testStoragePath);
      console.log('\n🧹 測試檔案清理完成');
    } catch (error) {
      // 忽略清理錯誤
    }
  }

  /**
   * 列印測試結果摘要
   */
  static printTestResults(results) {
    console.log('\n' + '='.repeat(70));
    console.log('📊 OptimizedMemoryYamlService 性能測試結果');
    console.log('='.repeat(70));
    
    let totalPassed = 0;
    let totalTests = 0;
    
    Object.values(results).forEach(result => {
      totalTests++;
      if (result.passed) totalPassed++;
      
      console.log(`${result.passed ? '✅' : '❌'} ${result.category}`);
    });
    
    console.log('\n' + '='.repeat(70));
    console.log(`總結: ${totalPassed}/${totalTests} 項性能測試通過`);
    
    if (totalPassed === totalTests) {
      console.log('🎉 所有性能測試通過！OptimizedMemoryYamlService 性能優化成功');
      console.log('🚀 LRU 快取策略、批量更新機制、記憶體優化全面就緒');
      console.log('⚡ 系統性能已達到生產級標準');
    } else {
      console.log('⚠️  部分性能測試未通過，需要進一步優化');
      
      // 列出失敗的測試
      Object.values(results).forEach(result => {
        if (!result.passed) {
          console.log(`\n❌ ${result.category} 問題:`);
          result.details.forEach(detail => console.log(`   - ${detail}`));
        }
      });
    }
    console.log('='.repeat(70));
  }
}

// 如果直接執行此文件，運行測試
if (require.main === module) {
  OptimizedMemoryYamlServiceTest.runAllTests()
    .then(results => {
      const allPassed = Object.values(results).every(r => r.passed);
      process.exit(allPassed ? 0 : 1);
    })
    .catch(error => {
      console.error('性能測試執行失敗:', error);
      process.exit(1);
    });
}

module.exports = OptimizedMemoryYamlServiceTest;