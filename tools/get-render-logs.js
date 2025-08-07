#!/usr/bin/env node

/**
 * Render 應用程式日誌獲取工具
 * 用於模擬測試時獲取和分析 Render 上的應用程式日誌
 */

const { execSync, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

// Render 服務配置
const RENDER_CONFIG = {
  SERVICE_ID: 'srv-d21f9u15pdvs73frvns0',
  SERVICE_NAME: 'course-mvp-beta',
  LOG_DIR: './test-results/render-logs'
};

// 確保日誌目錄存在
if (!fs.existsSync(RENDER_CONFIG.LOG_DIR)) {
  fs.mkdirSync(RENDER_CONFIG.LOG_DIR, { recursive: true });
}

/**
 * 獲取 Render 服務日誌
 */
async function getRenderLogs(options = {}) {
  const {
    limit = 100,        // 獲取日誌條數
    follow = false,     // 是否持續監聽
    since = null,       // 從什麼時間開始 (ISO string)
    output = 'text',    // 輸出格式: text, json
    saveFile = true     // 是否保存到文件
  } = options;

  console.log('📜 獲取 Render 應用程式日誌...');
  console.log(`🎯 服務: ${RENDER_CONFIG.SERVICE_NAME} (${RENDER_CONFIG.SERVICE_ID})`);
  console.log(`📊 限制: ${limit} 條日誌`);

  try {
    // 構建 render logs 命令
    let command = `render logs -r ${RENDER_CONFIG.SERVICE_ID} --limit ${limit}`;
    
    if (output === 'json') {
      command += ' -o json';
    }
    
    if (since) {
      command += ` --start "${since}"`;
    }

    console.log(`🔧 執行命令: ${command}`);

    let logs;
    if (follow) {
      // 持續監聽模式
      console.log('👁️  開始持續監聽日誌 (Ctrl+C 停止)...');
      const followCommand = command + ' --follow';
      
      const child = spawn('sh', ['-c', followCommand], {
        stdio: 'pipe'
      });

      child.stdout.on('data', (data) => {
        const logEntry = data.toString();
        console.log(logEntry);
        
        if (saveFile) {
          const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
          const filename = `render-logs-follow-${timestamp}.log`;
          fs.appendFileSync(path.join(RENDER_CONFIG.LOG_DIR, filename), logEntry);
        }
      });

      child.stderr.on('data', (data) => {
        console.error('stderr:', data.toString());
      });

      child.on('close', (code) => {
        console.log(`\\n📡 日誌監聽結束 (退出碼: ${code})`);
      });

      return { following: true, process: child };

    } else {
      // 一次性獲取模式
      const startTime = Date.now();
      logs = execSync(command, { 
        encoding: 'utf8', 
        timeout: 30000,
        maxBuffer: 10 * 1024 * 1024 // 10MB buffer
      });
      const responseTime = Date.now() - startTime;

      console.log(`✅ 日誌獲取完成 (${responseTime}ms)`);
      
      // 解析日誌
      let parsedLogs;
      if (output === 'json') {
        try {
          parsedLogs = logs.split('\\n')
            .filter(line => line.trim())
            .map(line => JSON.parse(line));
          console.log(`📋 解析到 ${parsedLogs.length} 條日誌`);
        } catch (error) {
          console.warn('⚠️ JSON 解析失敗，使用原始文本');
          parsedLogs = logs;
        }
      } else {
        parsedLogs = logs;
        const lineCount = logs.split('\\n').length;
        console.log(`📋 獲取到 ${lineCount} 行日誌`);
      }

      // 保存到文件
      if (saveFile) {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = `render-logs-${timestamp}.${output === 'json' ? 'json' : 'log'}`;
        const filepath = path.join(RENDER_CONFIG.LOG_DIR, filename);
        
        if (output === 'json' && Array.isArray(parsedLogs)) {
          fs.writeFileSync(filepath, JSON.stringify(parsedLogs, null, 2));
        } else {
          fs.writeFileSync(filepath, parsedLogs);
        }
        
        console.log(`💾 日誌已保存: ${filepath}`);
      }

      return {
        success: true,
        logs: parsedLogs,
        responseTime,
        logCount: Array.isArray(parsedLogs) ? parsedLogs.length : logs.split('\\n').length
      };
    }

  } catch (error) {
    console.error('❌ 獲取日誌失敗:', error.message);
    
    if (error.message.includes('not authenticated')) {
      console.log('💡 請先登入 Render CLI: render auth login');
    }
    
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * 獲取測試期間的日誌
 */
async function getTestPeriodLogs(testStartTime, testEndTime = null) {
  const endTime = testEndTime || new Date();
  const duration = endTime - testStartTime;
  
  console.log('🧪 獲取測試期間的日誌...');
  console.log(`📅 測試開始: ${testStartTime.toISOString()}`);
  console.log(`📅 測試結束: ${endTime.toISOString()}`);
  console.log(`⏱️  測試時長: ${duration}ms (${(duration/1000).toFixed(1)}秒)`);

  // 獲取測試開始前 30 秒到測試結束後 10 秒的日誌
  const logStartTime = new Date(testStartTime.getTime() - 30000);
  
  return await getRenderLogs({
    since: logStartTime.toISOString(),
    limit: 500,
    output: 'json',
    saveFile: true
  });
}

/**
 * 分析日誌中的錯誤和警告
 */
function analyzeLogs(logs) {
  console.log('🔍 分析日誌內容...');
  
  const analysis = {
    errors: [],
    warnings: [],
    requests: [],
    responses: [],
    performance: {
      slowRequests: [],
      averageResponseTime: 0
    }
  };

  const logText = Array.isArray(logs) 
    ? logs.map(entry => entry.message || entry.text || JSON.stringify(entry)).join('\\n')
    : logs;

  const lines = logText.split('\\n');

  lines.forEach((line, index) => {
    // 檢查錯誤
    if (line.includes('ERROR') || line.includes('Error:') || line.includes('❌')) {
      analysis.errors.push({ line: index + 1, content: line });
    }

    // 檢查警告
    if (line.includes('WARN') || line.includes('Warning:') || line.includes('⚠️')) {
      analysis.warnings.push({ line: index + 1, content: line });
    }

    // 檢查 HTTP 請求
    if (line.includes('POST /webhook') || line.includes('GET /health')) {
      analysis.requests.push({ line: index + 1, content: line });
    }

    // 檢查回應時間
    const responseTimeMatch = line.match(/(\\d+)ms/);
    if (responseTimeMatch) {
      const responseTime = parseInt(responseTimeMatch[1]);
      if (responseTime > 3000) {
        analysis.performance.slowRequests.push({ 
          line: index + 1, 
          responseTime, 
          content: line 
        });
      }
    }
  });

  console.log(`📊 分析結果:`);
  console.log(`   錯誤: ${analysis.errors.length} 條`);
  console.log(`   警告: ${analysis.warnings.length} 條`);
  console.log(`   請求: ${analysis.requests.length} 條`);
  console.log(`   慢請求 (>3s): ${analysis.performance.slowRequests.length} 條`);

  return analysis;
}

/**
 * 搜尋特定關鍵詞的日誌
 */
async function searchLogs(keywords, options = {}) {
  console.log(`🔍 搜尋日誌關鍵詞: ${keywords.join(', ')}`);
  
  const result = await getRenderLogs({
    limit: options.limit || 200,
    output: 'text',
    saveFile: false
  });

  if (!result.success) {
    return result;
  }

  const lines = result.logs.split('\\n');
  const matches = [];

  lines.forEach((line, index) => {
    const matchedKeywords = keywords.filter(keyword => 
      line.toLowerCase().includes(keyword.toLowerCase())
    );
    
    if (matchedKeywords.length > 0) {
      matches.push({
        line: index + 1,
        content: line,
        keywords: matchedKeywords
      });
    }
  });

  console.log(`✅ 找到 ${matches.length} 條匹配的日誌`);

  return {
    success: true,
    matches,
    totalLines: lines.length
  };
}

/**
 * 主程式
 */
async function main() {
  const args = process.argv.slice(2);

  if (args.includes('--help') || args.includes('-h')) {
    console.log('📖 Render 日誌獲取工具');
    console.log('');
    console.log('使用方法:');
    console.log('  node tools/get-render-logs.js [options]');
    console.log('');
    console.log('選項:');
    console.log('  --recent             獲取最近的日誌 (預設 100 條)');
    console.log('  --follow             持續監聽日誌');
    console.log('  --limit <數量>       指定獲取日誌條數');
    console.log('  --json               使用 JSON 格式輸出');
    console.log('  --since <時間>       從指定時間開始 (ISO 格式)');
    console.log('  --search <關鍵詞>    搜尋包含關鍵詞的日誌');
    console.log('  --analyze            分析日誌中的錯誤和性能問題');
    console.log('  --test-period <開始時間>  獲取測試期間的日誌');
    console.log('  --help, -h           顯示此說明');
    console.log('');
    console.log('範例:');
    console.log('  npm run logs:render                    # 獲取最近日誌');
    console.log('  npm run logs:render -- --follow        # 持續監聽');
    console.log('  npm run logs:render -- --limit 50      # 獲取 50 條日誌');
    console.log('  npm run logs:render -- --search "ERROR,webhook"  # 搜尋關鍵詞');
    return;
  }

  try {
    if (args.includes('--follow')) {
      await getRenderLogs({ follow: true });
      
    } else if (args.includes('--search')) {
      const searchIndex = args.indexOf('--search');
      const searchTerms = args[searchIndex + 1]?.split(',') || ['ERROR'];
      await searchLogs(searchTerms);
      
    } else if (args.includes('--test-period')) {
      const timeIndex = args.indexOf('--test-period');
      const startTime = new Date(args[timeIndex + 1]);
      await getTestPeriodLogs(startTime);
      
    } else {
      // 預設：獲取最近日誌
      const options = {};
      
      if (args.includes('--limit')) {
        const limitIndex = args.indexOf('--limit');
        options.limit = parseInt(args[limitIndex + 1]) || 100;
      }
      
      if (args.includes('--json')) {
        options.output = 'json';
      }
      
      if (args.includes('--since')) {
        const sinceIndex = args.indexOf('--since');
        options.since = args[sinceIndex + 1];
      }

      const result = await getRenderLogs(options);
      
      if (result.success && args.includes('--analyze')) {
        const analysis = analyzeLogs(result.logs);
        
        // 保存分析結果
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const analysisPath = path.join(RENDER_CONFIG.LOG_DIR, `log-analysis-${timestamp}.json`);
        fs.writeFileSync(analysisPath, JSON.stringify(analysis, null, 2));
        console.log(`📊 分析結果已保存: ${analysisPath}`);
      }
    }

  } catch (error) {
    console.error('❌ 執行失敗:', error.message);
    process.exit(1);
  }
}

// 如果直接執行此檔案
if (require.main === module) {
  main();
}

module.exports = {
  getRenderLogs,
  getTestPeriodLogs,
  analyzeLogs,
  searchLogs
};