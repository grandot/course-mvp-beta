#!/usr/bin/env node

/**
 * Render MCP 自動設定腳本
 * 用法：node scripts/setup-render-mcp.js
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const os = require('os');

console.log('🔧 Render MCP 自動設定工具\n');

// 1. 檢查 API Key
const apiKey = process.env.RENDER_API_TOKEN;
if (!apiKey) {
  console.error('❌ 錯誤：在 .env 文件中找不到 RENDER_API_TOKEN');
  process.exit(1);
}

console.log(`✅ 找到 Render API Key: ${apiKey.substring(0, 8)}...`);

// 2. 找到 Claude Code 設定文件路徑
const homeDir = os.homedir();
const possiblePaths = [
  path.join(homeDir, '.claude', 'claude_desktop_config.json'),
  path.join(homeDir, '.config', 'Claude', 'claude_desktop_config.json'),
  path.join(homeDir, 'Library', 'Application Support', 'Claude', 'claude_desktop_config.json'),
  path.join(homeDir, 'AppData', 'Roaming', 'Claude', 'claude_desktop_config.json')
];

let configPath = null;
for (const p of possiblePaths) {
  if (fs.existsSync(p)) {
    configPath = p;
    break;
  }
}

if (!configPath) {
  // 如果沒找到，創建預設路徑
  const defaultPath = path.join(homeDir, '.claude', 'claude_desktop_config.json');
  const dir = path.dirname(defaultPath);
  
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    console.log(`📁 創建設定目錄: ${dir}`);
  }
  
  configPath = defaultPath;
  console.log(`📝 將創建新的設定文件: ${configPath}`);
} else {
  console.log(`📝 找到現有設定文件: ${configPath}`);
}

// 3. 讀取或創建設定
let config = {};
if (fs.existsSync(configPath)) {
  try {
    const content = fs.readFileSync(configPath, 'utf8');
    config = JSON.parse(content);
    console.log('✅ 成功讀取現有設定');
  } catch (error) {
    console.log('⚠️  設定文件格式錯誤，將重新創建');
    config = {};
  }
} else {
  console.log('📝 創建新的設定文件');
}

// 4. 添加 Render MCP 設定
if (!config.mcpServers) {
  config.mcpServers = {};
}

config.mcpServers.render = {
  command: "npx",
  args: ["-y", "@render/mcp-server"],
  env: {
    RENDER_API_KEY: apiKey
  }
};

// 5. 寫入設定文件
try {
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
  console.log('✅ 成功寫入 MCP 設定\n');
  
  console.log('🎯 設定完成！請執行以下步驟：');
  console.log('1. 重啟 Claude Code');
  console.log('2. 重啟後，Claude 就能直接查看你的 Render 日誌了\n');
  
  console.log('🔍 測試方法：');
  console.log('- 告訴 Claude："查看我最近的 Render 日誌"');
  console.log('- 或："我剛才輸入XXX但結果不對，幫我查日誌"');
  
} catch (error) {
  console.error(`❌ 寫入設定失敗: ${error.message}`);
  console.log('\n🛠️  手動設定方法：');
  console.log(`1. 打開文件: ${configPath}`);
  console.log('2. 添加以下內容：');
  console.log(JSON.stringify({
    mcpServers: {
      render: {
        command: "npx",
        args: ["-y", "@render/mcp-server"],
        env: {
          RENDER_API_KEY: apiKey
        }
      }
    }
  }, null, 2));
}