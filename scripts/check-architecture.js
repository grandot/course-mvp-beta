#!/usr/bin/env node
/**
 * 手動架構約束檢查腳本
 * 用於彌補 ESLint 自定義規則在 CI 環境中的限制
 */

const fs = require('fs');
const path = require('path');
const glob = require('glob');

// 定義架構規則
const ARCHITECTURE_RULES = {
  // Controllers 不能直接調用的服務
  controllers: {
    forbidden: [
      'openaiService',
      'firebaseService', 
      'lineService',
      'intentRuleEngine',
      'timeParser'
    ],
    allowedLayers: ['services']
  },
  
  // Services 不能直接調用的服務
  services: {
    forbidden: [
      'firebaseService',
      'lineService'
    ],
    allowedLayers: ['utils', 'internal'],
    exceptions: {
      'semanticService.js': ['openaiService'] // 語義處理統一入口例外
    }
  },
  
  // Utils 不能調用上層
  utils: {
    forbidden: ['controllers', 'services'],
    allowedLayers: []
  }
};

function checkFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const relativePath = path.relative(process.cwd(), filePath);
  const violations = [];
  
  // 確定文件所屬層級
  let layer = null;
  if (relativePath.includes('src/controllers/')) layer = 'controllers';
  else if (relativePath.includes('src/services/')) layer = 'services';
  else if (relativePath.includes('src/utils/')) layer = 'utils';
  
  if (!layer || !ARCHITECTURE_RULES[layer]) return violations;
  
  const rules = ARCHITECTURE_RULES[layer];
  const fileName = path.basename(filePath);
  
  // 檢查 require() 語句
  const requireRegex = /require\(['"`]([^'"`]+)['"`]\)/g;
  let match;
  
  while ((match = requireRegex.exec(content)) !== null) {
    const importPath = match[1];
    
    // 檢查禁止的直接服務調用
    for (const forbidden of rules.forbidden) {
      if (importPath.includes(forbidden)) {
        // 檢查是否有例外允許
        const exceptions = rules.exceptions?.[fileName];
        if (exceptions && exceptions.some(ex => importPath.includes(ex))) {
          continue; // 跳過例外情況
        }
        
        violations.push({
          file: relativePath,
          line: content.substring(0, match.index).split('\n').length,
          message: `禁止直接調用底層服務: ${layer} 不能直接調用 ${importPath}`,
          type: 'forbidden-service'
        });
      }
    }
    
    // 檢查跨層調用
    if (importPath.startsWith('../') || importPath.startsWith('./')) {
      for (const forbiddenLayer of Object.keys(ARCHITECTURE_RULES)) {
        if (forbiddenLayer !== layer && importPath.includes(forbiddenLayer)) {
          if (!rules.allowedLayers.includes(forbiddenLayer)) {
            violations.push({
              file: relativePath,
              line: content.substring(0, match.index).split('\n').length,
              message: `禁止跨層 import: ${layer} 不能直接調用 ${forbiddenLayer}`,
              type: 'cross-layer'
            });
          }
        }
      }
    }
  }
  
  return violations;
}

function checkArchitecture() {
  console.log('🔍 執行架構約束檢查...\n');
  
  // 掃描所有 JavaScript 文件
  const jsFiles = glob.sync('src/**/*.js');
  let totalViolations = 0;
  
  for (const file of jsFiles) {
    const violations = checkFile(file);
    if (violations.length > 0) {
      console.log(`❌ ${file}:`);
      violations.forEach(v => {
        console.log(`   Line ${v.line}: ${v.message}`);
        totalViolations++;
      });
      console.log('');
    }
  }
  
  if (totalViolations === 0) {
    console.log('✅ 架構約束檢查通過！所有文件都符合三層語義架構規範。');
    process.exit(0);
  } else {
    console.log(`❌ 發現 ${totalViolations} 個架構違反問題。`);
    console.log('\n請修復上述問題以確保架構一致性。');
    process.exit(1);
  }
}

// 執行檢查
if (require.main === module) {
  checkArchitecture();
}

module.exports = { checkFile, checkArchitecture };