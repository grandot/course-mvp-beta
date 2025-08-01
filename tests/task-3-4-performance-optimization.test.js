/**
 * Task 3.4 測試：映射表缓存和性能優化验证
 * 验证增强版缓存系统的性能改善效果
 */

const { getEnhancedSemanticNormalizer } = require('../src/services/enhancedSemanticNormalizer');

describe('Task 3.4: 映射表缓存和性能優化測試', () => {
  let normalizer;

  beforeAll(() => {
    normalizer = getEnhancedSemanticNormalizer();
  });

  // 只在特定测试中清理缓存
  beforeEach(() => {
    // 不自动清理缓存，让预计算映射保持有效
  });

  describe('🎯 預計算映射性能測試', () => {
    
    test('預計算映射應在初始化時建立', () => {
      const stats = normalizer.getCacheStats();
      
      // 验证预计算映射已建立
      expect(stats.cache_breakdown.precomputed_mappings).toBeGreaterThan(0);
      expect(stats.cache_breakdown.intent_mapping_cache).toBeGreaterThan(0);
      
      console.log('預計算映射統計:', stats.cache_breakdown);
    });

    test('常用Intent應從預計算緩存快速響應', async () => {
      // 清理缓存以测试缓存效果
      normalizer.clearCache();
      
      const commonIntents = ['記錄課程', '查詢課表', '修改課程', '取消課程'];
      
      // 第一轮访问 - 不使用预计算缓存（故意使用不同的intent）
      const startTime = performance.now();
      for (let i = 0; i < 100; i++) {
        normalizer.normalizeIntent(`測試Intent${i}`); // 每次都是新的
      }
      const firstRoundTime = performance.now() - startTime;
      
      // 第二轮访问 - 使用预计算缓存
      const cachedStartTime = performance.now();
      for (let i = 0; i < 100; i++) {
        const result = normalizer.normalizeIntent('記錄課程'); // 相同的intent
        
        // 验证结果正确性
        expect(result.mapped_intent).not.toBe('unknown');
        expect(result.confidence).toBeGreaterThan(0.9);
      }
      const cachedTime = performance.now() - cachedStartTime;
      
      // 缓存访问应该明显更快
      expect(cachedTime).toBeLessThan(firstRoundTime);
      
      console.log(`首次访问时间: ${firstRoundTime.toFixed(2)}ms, 缓存访问时间: ${cachedTime.toFixed(2)}ms`);
      console.log(`性能提升: ${((firstRoundTime - cachedTime) / firstRoundTime * 100).toFixed(1)}%`);
    });
  });

  describe('🎯 分層緩存系統測試', () => {
    
    test('不同類型的映射應使用對應的緩存層', () => {
      // 直接映射 - 应该使用Intent映射缓存
      const directResult = normalizer.normalizeIntent('記錄課程');
      expect(directResult.mapping_source).toBe('precomputed_direct');
      
      // 模糊匹配 - 应该使用模糊匹配缓存
      const fuzzyResult = normalizer.normalizeIntent('记录課程'); // 简体字变形
      
      // 验证分层缓存
      const stats = normalizer.getCacheStats();
      expect(stats.cache_breakdown.intent_mapping_cache).toBeGreaterThan(0);
      
      // 如果有模糊匹配，检查模糊匹配缓存
      if (fuzzyResult.mapping_source === 'fuzzy') {
        expect(stats.cache_breakdown.fuzzy_match_cache).toBeGreaterThan(0);
      }
    });

    test('緩存命中率應達到預期目標', () => {
      // 重置统计以确保准确计算
      normalizer.initializeCacheStats();
      
      const testIntents = [
        '記錄課程', '查詢課表', '修改課程', '取消課程', // 第一轮 - 预计算命中
        '記錄課程', '查詢課表', '修改課程', '取消課程', // 第二轮 - 重复访问，应该命中
        '記錄課程', '記錄課程', '記錄課程', '記錄課程', // 多次重复同一个
        '查詢課表', '查詢課表', '查詢課表'  // 多次重复另一个
      ];
      
      // 执行测试
      testIntents.forEach(intent => {
        const result = normalizer.normalizeIntent(intent);
        expect(result).toBeDefined();
      });
      
      const stats = normalizer.getCacheStats();
      
      // 验证性能指标
      expect(stats.performance_stats).toBeDefined();
      expect(stats.performance_stats.total_requests).toBeGreaterThan(0);
      expect(stats.performance_stats.cache_hits).toBeGreaterThan(0);
      
      const hitRatio = parseFloat(stats.performance_stats.hit_ratio);
      expect(hitRatio).toBeGreaterThan(60); // 应该超过60%命中率
      
      console.log('緩存命中率測試結果:', stats.performance_stats);
    });
  });

  describe('🎯 響應時間性能測試', () => {
    
    test('平均響應時間應符合性能要求', () => {
      const iterations = 100;
      const testIntent = '記錄課程';
      
      // 预热缓存
      normalizer.normalizeIntent(testIntent);
      
      const startTime = Date.now();
      
      // 执行性能测试
      for (let i = 0; i < iterations; i++) {
        normalizer.normalizeIntent(testIntent);
      }
      
      const totalTime = Date.now() - startTime;
      const averageTime = totalTime / iterations;
      
      // 验证性能目标 - 每次调用应该在合理时间内完成
      expect(averageTime).toBeLessThan(5); // 5ms per normalization
      
      const stats = normalizer.getCacheStats();
      console.log(`性能測試結果 - 平均響應時間: ${averageTime.toFixed(2)}ms`);
      console.log(`統計信息: ${stats.performance_stats?.avg_response_time || 'N/A'}`);
    });

    test('大量並發請求的性能表現', async () => {
      const testCases = [
        '記錄課程', '查詢課表', '修改課程', '取消課程', '清空課表',
        '設提醒', '記錄內容', '上傳照片', '查詢內容', '修改內容'
      ];
      
      const iterations = 50;
      const startTime = Date.now();
      
      // 模拟并发请求
      const promises = [];
      for (let i = 0; i < iterations; i++) {
        const testCase = testCases[i % testCases.length];
        promises.push(Promise.resolve(normalizer.normalizeIntent(testCase)));
      }
      
      await Promise.all(promises);
      
      const totalTime = Date.now() - startTime;
      const throughput = (iterations * 1000) / totalTime; // requests per second
      
      // 验证吞吐量
      expect(throughput).toBeGreaterThan(100); // 至少100 RPS
      
      console.log(`並發性能測試 - 吞吐量: ${throughput.toFixed(0)} RPS`);
      console.log(`總耗時: ${totalTime}ms for ${iterations} requests`);
    });
  });

  describe('🎯 緩存管理和優化測試', () => {
    
    test('LRU緩存清理機制應正常工作', () => {
      // 填充缓存到接近上限
      const maxSize = normalizer.maxCacheSize;
      
      for (let i = 0; i < maxSize + 500; i++) {
        const testIntent = `測試Intent${i}`;
        normalizer.normalizeIntent(testIntent);
      }
      
      const stats = normalizer.getCacheStats();
      const totalCacheSize = stats.total_cache_size;
      
      // 验证缓存大小被合理控制
      expect(totalCacheSize).toBeLessThanOrEqual(maxSize * 1.5);
      
      console.log(`LRU清理測試 - 緩存大小: ${totalCacheSize}/${maxSize}`);
      console.log(`緩存利用率: ${stats.cache_utilization}`);
    });

    test('緩存統計應提供完整的性能數據', () => {
      // 执行一些操作来生成统计数据
      const testIntents = ['記錄課程', '查詢課表', '修改課程'];
      testIntents.forEach(intent => normalizer.normalizeIntent(intent));
      
      const stats = normalizer.getCacheStats();
      
      // 验证统计数据完整性
      expect(stats.total_cache_size).toBeDefined();
      expect(stats.cache_utilization).toBeDefined();
      expect(stats.cache_breakdown).toBeDefined();
      expect(stats.performance_stats).toBeDefined();
      expect(stats.optimization_suggestions).toBeDefined();
      
      // 验证缓存分解统计
      const breakdown = stats.cache_breakdown;
      expect(breakdown.general_cache).toBeGreaterThanOrEqual(0);
      expect(breakdown.intent_mapping_cache).toBeGreaterThan(0);
      expect(breakdown.entity_mapping_cache).toBeGreaterThanOrEqual(0);
      expect(breakdown.fuzzy_match_cache).toBeGreaterThanOrEqual(0);
      expect(breakdown.precomputed_mappings).toBeGreaterThan(0);
      
      console.log('完整緩存統計:', JSON.stringify(stats, null, 2));
    });

    test('優化建議應基於實際性能數據', () => {
      // 执行测试以生成性能数据
      for (let i = 0; i < 20; i++) {
        normalizer.normalizeIntent('記錄課程');
      }
      
      const stats = normalizer.getCacheStats();
      const suggestions = stats.optimization_suggestions;
      
      expect(Array.isArray(suggestions)).toBe(true);
      expect(suggestions.length).toBeGreaterThan(0);
      
      // 验证建议内容合理性
      suggestions.forEach(suggestion => {
        expect(typeof suggestion).toBe('string');
        expect(suggestion.length).toBeGreaterThan(0);
      });
      
      console.log('優化建議:', suggestions);
    });
  });

  describe('🎯 Task 3.4 验收标准验证', () => {
    
    test('✅ normalizer 處理時間減少 > 50%', async () => {
      // 创建一个不使用缓存的版本进行对比
      const testIntent = '記錄課程';
      
      // 不使用缓存的情况 - 清空缓存
      normalizer.clearCache();
      
      const startTimeNonCached = Date.now();
      for (let i = 0; i < 10; i++) {
        normalizer.normalizeIntent(testIntent + i); // 每次都是新的
      }
      const nonCachedTime = Date.now() - startTimeNonCached;
      
      // 使用缓存的情况
      const startTimeCached = Date.now();
      for (let i = 0; i < 10; i++) {
        normalizer.normalizeIntent(testIntent); // 相同的intent，应该命中缓存
      }
      const cachedTime = Date.now() - startTimeCached;
      
      const improvement = ((nonCachedTime - cachedTime) / nonCachedTime * 100);
      
      console.log(`性能改善測試: 非緩存 ${nonCachedTime}ms vs 緩存 ${cachedTime}ms`);
      console.log(`改善幅度: ${improvement.toFixed(1)}%`);
      
      // 验收标准：处理时间减少 > 50%
      expect(improvement).toBeGreaterThan(50);
    });

    test('✅ 緩存命中率 > 60%', () => {
      // 重置统计以确保准确计算
      normalizer.initializeCacheStats();
      
      const commonIntents = [];
      // 创建大量重复的常用Intent来确保高命中率
      for (let i = 0; i < 5; i++) {
        commonIntents.push('記錄課程', '查詢課表', '修改課程', '取消課程');
      }
      
      // 执行测试
      commonIntents.forEach(intent => {
        normalizer.normalizeIntent(intent);
      });
      
      const stats = normalizer.getCacheStats();
      const hitRatio = parseFloat(stats.performance_stats.hit_ratio);
      
      console.log(`緩存命中率測試: ${hitRatio}%`);
      console.log(`統計詳情:`, stats.performance_stats);
      
      // 验收标准：缓存命中率 > 60%
      expect(hitRatio).toBeGreaterThan(60);
    });
  });
});