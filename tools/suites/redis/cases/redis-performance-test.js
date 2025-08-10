#!/usr/bin/env node

/**
 * Redis 性能診斷工具
 * 分析 163ms 延遲的根本原因
 */

require('dotenv').config();
const { getRedisService } = require('../src/services/redisService');

class RedisPerformanceAnalyzer {
  constructor() {
    this.redisService = getRedisService();
    this.results = {
      connectionTime: [],
      operationTime: [],
      networkLatency: [],
      analysis: {}
    };
  }

  async runDiagnostics() {
    console.log('🔍 Redis 性能診斷開始...\n');
    
    // 1. 基礎連接測試
    await this.testConnectionLatency();
    
    // 2. 操作性能測試
    await this.testOperationPerformance();
    
    // 3. 網路延遲分析
    await this.analyzeNetworkLatency();
    
    // 4. 生成診斷報告
    this.generateDiagnosticReport();
  }

  async testConnectionLatency() {
    console.log('📡 測試 Redis 連接延遲...');
    
    for (let i = 0; i < 10; i++) {
      const start = Date.now();
      
      try {
        const health = await this.redisService.healthCheck();
        const latency = Date.now() - start;
        
        this.results.connectionTime.push(latency);
        console.log(`  [${i+1}] 連接延遲: ${latency}ms ${health.status === 'healthy' ? '✅' : '❌'}`);
        
      } catch (error) {
        console.log(`  [${i+1}] 連接失敗: ${error.message} ❌`);
        this.results.connectionTime.push(null);
      }
      
      // 間隔100ms避免過載
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  async testOperationPerformance() {
    console.log('\n⚡ 測試 Redis 操作性能...');
    
    const testOperations = [
      { name: 'SET', operation: () => this.redisService.set('test:perf', { test: true }, 60) },
      { name: 'GET', operation: () => this.redisService.get('test:perf') },
      { name: 'DEL', operation: () => this.redisService.del('test:perf') }
    ];
    
    for (const test of testOperations) {
      const times = [];
      
      for (let i = 0; i < 5; i++) {
        const start = Date.now();
        
        try {
          await test.operation();
          const duration = Date.now() - start;
          times.push(duration);
          
        } catch (error) {
          console.log(`  ${test.name} 操作失敗: ${error.message}`);
          times.push(null);
        }
      }
      
      const validTimes = times.filter(t => t !== null);
      const avgTime = validTimes.length > 0 
        ? Math.round(validTimes.reduce((a, b) => a + b, 0) / validTimes.length)
        : 'N/A';
        
      console.log(`  ${test.name} 平均延遲: ${avgTime}ms`);
      this.results.operationTime.push({ operation: test.name, times, average: avgTime });
    }
  }

  async analyzeNetworkLatency() {
    console.log('\n🌐 分析網路延遲...');
    
    // 檢查 Redis 配置
    console.log('📋 Redis 配置信息:');
    console.log(`  主機: ${process.env.REDIS_HOST || 'localhost'}`);
    console.log(`  端口: ${process.env.REDIS_PORT || '6379'}`);
    console.log(`  TLS: ${process.env.REDIS_TLS || 'false'}`);
    
    // 檢查是否為雲端服務
    const isCloudService = process.env.REDIS_HOST && (
      process.env.REDIS_HOST.includes('upstash.io') ||
      process.env.REDIS_HOST.includes('redislabs.com') ||
      process.env.REDIS_HOST.includes('amazonaws.com')
    );
    
    console.log(`  服務類型: ${isCloudService ? '☁️ 雲端服務' : '🏠 本地服務'}`);
    
    if (isCloudService) {
      console.log('  ⚠️ 雲端 Redis 服務通常有 50-200ms 基礎延遲');
    }
  }

  generateDiagnosticReport() {
    console.log('\n📊 性能診斷報告');
    console.log('=================');
    
    // 連接延遲分析
    const validConnections = this.results.connectionTime.filter(t => t !== null);
    const avgConnection = validConnections.length > 0 
      ? Math.round(validConnections.reduce((a, b) => a + b, 0) / validConnections.length)
      : 'N/A';
    const maxConnection = validConnections.length > 0 ? Math.max(...validConnections) : 'N/A';
    const minConnection = validConnections.length > 0 ? Math.min(...validConnections) : 'N/A';
    
    console.log(`\n🔗 連接性能:`);
    console.log(`  平均延遲: ${avgConnection}ms`);
    console.log(`  最大延遲: ${maxConnection}ms`);
    console.log(`  最小延遲: ${minConnection}ms`);
    console.log(`  成功率: ${Math.round(validConnections.length / this.results.connectionTime.length * 100)}%`);
    
    // 性能評級
    let performanceGrade = 'A';
    let recommendation = '✅ 性能良好';
    
    if (avgConnection > 300) {
      performanceGrade = 'D';
      recommendation = '🚨 嚴重性能問題，需立即優化';
    } else if (avgConnection > 200) {
      performanceGrade = 'C';
      recommendation = '⚠️ 性能偏差，建議優化';
    } else if (avgConnection > 100) {
      performanceGrade = 'B';
      recommendation = '🔍 性能可接受，可考慮優化';
    }
    
    console.log(`\n🎯 性能評級: ${performanceGrade}`);
    console.log(`💡 建議: ${recommendation}`);
    
    // 優化建議
    console.log('\n🛠️ 優化建議:');
    
    if (avgConnection > 150) {
      console.log('  1. 🔄 考慮切換到更近的 Redis 區域');
      console.log('  2. 📦 實施 Redis 連接池');
      console.log('  3. 💾 增加本地快取層');
      console.log('  4. ⚡ 使用 Pipeline 批次操作');
    } else {
      console.log('  1. 📊 持續監控性能指標');
      console.log('  2. 🔍 定期檢查網路連接品質');
    }
    
    // 處理時機建議
    console.log('\n⏰ 處理時機建議:');
    
    if (avgConnection > 200) {
      console.log('  🚨 **立即處理** - 影響用戶體驗');
    } else if (avgConnection > 100) {
      console.log('  📅 **本週處理** - 預防性優化');
    } else {
      console.log('  📈 **持續監控** - 暫無急迫性');
    }
    
    // 用戶體驗影響
    console.log('\n👤 用戶體驗影響:');
    const totalLatency = avgConnection + 500; // 假設其他處理時間 500ms
    
    if (totalLatency > 2000) {
      console.log(`  ❌ 總回應時間 ~${totalLatency}ms - 用戶會感到明顯延遲`);
    } else if (totalLatency > 1000) {
      console.log(`  ⚠️ 總回應時間 ~${totalLatency}ms - 輕微影響流暢度`);
    } else {
      console.log(`  ✅ 總回應時間 ~${totalLatency}ms - 用戶體驗良好`);
    }
  }
}

// 執行診斷
if (require.main === module) {
  const analyzer = new RedisPerformanceAnalyzer();
  analyzer.runDiagnostics().catch(console.error);
}

module.exports = { RedisPerformanceAnalyzer };