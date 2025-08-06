# 🧠 AI 提取邏輯優化計劃

## 📊 問題診斷

### **當前測試失敗案例**
```
❌ "設定小華鋼琴課提前1小時提醒" → 課程名稱="設定小華鋼琴課"
❌ "不要Lumi的游泳課了" → 學生名稱="不要Lumi"  
❌ "小明數學課今天教了圓周率" → 錯誤意圖識別為 add_course
❌ "今天天氣如何" → 錯誤匹配 query_course_content
```

### **第一性原則分析**

**根本問題**：語言理解 = 語法結構 + 語義邊界 + 語境意圖

**當前系統缺陷**：
1. **意圖識別規則過寬** - 導致錯誤匹配，AI fallback 無法觸發
2. **AI Prompt 缺乏語法指導** - 不理解句子結構和實體邊界
3. **缺少驗證機制** - 無法過濾明顯錯誤的提取結果

---

## 🎯 系統性優化方案

### **三層架構優化**

#### **第一層：意圖識別規則收緊**

**目標檔案**：`config/mvp/intent-rules.yaml`

**修改策略**：
```yaml
# 當前問題（過寬）
query_course_content:
  keywords: ["今天", "內容", "什麼"]  # 太寬泛，會匹配天氣查詢

# 優化後（精確）
query_course_content:
  keywords: ["學了什麼", "教了什麼", "內容是什麼", "課程內容"]
  required_keywords: ["課", "學", "教"]  # 必須包含課程相關詞
  exclusions: ["天氣", "心情", "狀況", "時間", "地點"]  # 排除無關查詢
  
# 其他需要收緊的規則
add_course:
  required_keywords: ["課", "上課", "安排", "新增"]
  exclusions: ["教了", "學了", "練習了"]  # 排除過去式內容記錄
```

#### **第二層：AI Prompt 精密化重設計**

**目標檔案**：`src/intent/extractSlots.js`

**新 AI Prompt 設計**：
```javascript
const optimizedPrompt = `
你是專業的中文語法分析師。請嚴格按照語法結構分析句子，提取純淨實體。

句子："${message}"
意圖：${intent}

分析步驟：
1. 語法分解：識別主語、謂語、賓語、修飾語
2. 實體邊界：確定實體的精確邊界，排除動作詞和修飾詞
3. 語義驗證：確保提取的實體符合邏輯

實體提取規則：
- 學生姓名：純人名（小明、Lumi、小華），不包含動作詞、修飾詞
- 課程名稱：純課程名（數學課、英文課），不包含動作詞、時間詞
- 時間信息：具體時間或時間修飾詞
- 內容信息：學習或教學的具體內容

❌ 錯誤示例（勿模仿）：
"設定小華鋼琴課提醒" → 課程="設定小華鋼琴課" (包含動作詞)
"不要Lumi的游泳課" → 學生="不要Lumi" (包含否定詞)

✅ 正確示例：
"設定小華鋼琴課提醒" → 學生="小華", 課程="鋼琴課"
"不要Lumi的游泳課了" → 學生="Lumi", 課程="游泳課"
"小明數學課今天教了圓周率" → 學生="小明", 課程="數學課", 內容="圓周率"

如果無法確定某個實體，請設為 null。

回傳格式（僅JSON，無其他文字）：
{
  "studentName": "純人名或null",
  "courseName": "純課程名或null", 
  "scheduleTime": "時間或null",
  "timeReference": "時間參考或null",
  "content": "內容或null",
  "reminderTime": "提醒時間（分鐘數）或null"
}
`;
```

#### **第三層：結果驗證與修正機制**

**新增驗證器**：
```javascript
function validateExtractionResult(result, originalMessage, intent) {
  const issues = [];
  const cleaned = { ...result };
  
  // 驗證學生姓名
  if (cleaned.studentName) {
    if (hasActionWords(cleaned.studentName)) {
      issues.push(`學生姓名包含動作詞: ${cleaned.studentName}`);
      cleaned.studentName = cleanStudentName(cleaned.studentName);
    }
  }
  
  // 驗證課程名稱
  if (cleaned.courseName) {
    if (hasActionWords(cleaned.courseName)) {
      issues.push(`課程名稱包含動作詞: ${cleaned.courseName}`);
      cleaned.courseName = cleanCourseName(cleaned.courseName);
    }
  }
  
  // 驗證邏輯一致性
  if (intent === 'record_content' && !cleaned.content) {
    issues.push('記錄內容意圖但未提取到內容');
  }
  
  return { result: cleaned, issues };
}

function hasActionWords(text) {
  const actionWords = ['設定', '不要', '取消', '刪掉', '幫我', '請', '要', '安排'];
  return actionWords.some(word => text.includes(word));
}

function cleanStudentName(rawName) {
  // 移除常見的動作詞前綴
  const cleaned = rawName
    .replace(/^(設定|不要|取消|刪掉|幫我|請)/, '')
    .replace(/(的|之)$/, '');
  return cleaned.trim();
}

function cleanCourseName(rawCourse) {
  // 移除動作詞，保留純課程名
  const cleaned = rawCourse
    .replace(/^(設定|不要|取消|刪掉)/, '')
    .replace(/^.*?([^的]*課)$/, '$1');
  return cleaned.trim();
}
```

---

## 🛠️ 實施步驟

### **Phase 1: 立即實施**（最高 ROI）

#### **1.1 優化 AI Prompt**
- 檔案：`src/intent/extractSlots.js`
- 重新設計 AI 提取的 prompt
- 增加語法結構指導和負面約束

#### **1.2 新增結果驗證器**
- 檔案：`src/intent/extractSlots.js`
- 實現 `validateExtractionResult` 函數
- 自動清理明顯錯誤的提取結果

### **Phase 2: 中期實施**（中等 ROI）

#### **2.1 收緊意圖識別規則**
- 檔案：`config/mvp/intent-rules.yaml`
- 為過寬的規則添加必要關鍵詞約束
- 增加排除詞列表防止錯誤匹配

#### **2.2 實現增強提取流程**
- 檔案：`src/intent/extractSlots.js`
- 實現多重驗證機制
- 規則提取 + AI 輔助 + 結果驗證

### **Phase 3: 長期優化**（持續改進）

#### **3.1 學習機制**
- 收集錯誤案例
- 持續優化 prompt 和規則

#### **3.2 上下文記憶**
- 多輪對話的上下文理解
- 提高複雜語句的處理能力

---

## 📊 預期效果

### **修復效果預測**

**目標測試案例修復**：
```
✅ "設定小華鋼琴課提前1小時提醒" 
   → 學生="小華", 課程="鋼琴課", 提醒時間=60

✅ "不要Lumi的游泳課了"
   → 學生="Lumi", 課程="游泳課", 意圖="取消"

✅ "小明數學課今天教了圓周率"
   → 意圖=record_content, 學生="小明", 課程="數學課", 內容="圓周率"

✅ "今天天氣如何"
   → 意圖=unknown (不會錯誤匹配課程查詢)
```

### **關鍵指標改善**：
- **實體提取準確率**：60% → 90%+
- **意圖識別準確率**：82% → 95%+  
- **AI Fallback 觸發率**：5% → 25%（適當觸發）
- **總體測試通過率**：60.6% → 85%+

---

## 💡 核心設計原則

### **第一性原則應用**

1. **語言理解本質**
   - 語言 = 結構 + 語義 + 語境
   - AI 必須理解語法角色，不是位置匹配

2. **實體邊界意識**
   - 實體有明確邊界，不包含修飾詞
   - 負面約束比正面指導更重要

3. **分層處理策略**
   - 規則處理常見案例（快速、成本低）
   - AI 處理複雜案例（準確、覆蓋廣）
   - 驗證器保證品質（可靠、一致）

### **實施準則**

1. **不要修補，要重設計**
   - 基於語言學原理重新設計 prompt
   - 不是簡單的關鍵詞調整

2. **驗證優於信任**
   - 所有 AI 提取結果都必須驗證
   - 自動修正常見錯誤模式

3. **漸進式優化**
   - 優先解決影響最大的問題
   - 基於測試結果持續改進

---

## 📋 實施檢查清單

### **Phase 1 檢查清單**
- [ ] 重新設計 AI extraction prompt
- [ ] 實現 `validateExtractionResult` 驗證器
- [ ] 實現 `cleanStudentName` 和 `cleanCourseName` 清理函數
- [ ] 測試所有失敗案例
- [ ] 確保提取準確率達到 90%+

### **Phase 2 檢查清單**
- [ ] 收緊 `query_course_content` 規則
- [ ] 收緊 `add_course` 規則，排除記錄內容語句
- [ ] 為主要意圖添加 `exclusions` 列表
- [ ] 實現增強提取流程
- [ ] 驗證 AI fallback 適當觸發

### **Phase 3 檢查清單**
- [ ] 建立錯誤案例收集機制
- [ ] 實現持續學習和優化流程
- [ ] 考慮多輪對話上下文
- [ ] 性能監控和調優

---

## 🎯 成功標準

### **技術指標**
- 實體提取準確率 ≥ 90%
- 意圖識別準確率 ≥ 95%
- AI fallback 觸發率 20-30%
- 響應時間 ≤ 2 秒

### **業務指標**
- 測試用例通過率 ≥ 85%
- 用戶滿意度提升
- 減少客服介入次數

### **質量指標**
- 零明顯錯誤（如包含動作詞的實體）
- 一致性 ≥ 95%（同樣輸入產生同樣結果）
- 魯棒性強（能處理各種語句變化）

---

**更新日期**: 2025-08-05  
**版本**: v1.0  
**負責人**: AI Enhancement Team