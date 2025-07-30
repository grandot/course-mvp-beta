# 課程內容模組數據結構設計

## 第一性原則分析

**根本需求**：家長需要完整記錄孩子的學習過程，包括課堂內容、作業和視覺記錄，並能進行結構化管理。

**核心實體**：Course Content - 與現有 Course 實體關聯的內容擴展

## 數據結構設計

### 1. Course Content 主體結構

```javascript
// Firebase Collection: course_contents
{
  id: "course_content_uuid",
  course_id: "關聯的課程ID",
  student_id: "學生ID", 
  content_date: "2024-01-15", // 內容對應日期
  
  // 內容分類
  lesson_content: {
    title: "今日課程主題",
    description: "課程詳細描述",
    topics_covered: ["加法運算", "九九乘法表"],
    learning_objectives: ["掌握基礎加法", "熟記乘法表"],
    teacher_notes: "學生表現良好，需加強練習",
    difficulty_level: "beginner|intermediate|advanced"
  },
  
  homework_assignments: [{
    id: "homework_uuid",
    title: "數學練習題",
    description: "完成課本第10-15頁",
    due_date: "2024-01-17",
    priority: "high|medium|low",
    status: "pending|in_progress|completed|overdue",
    estimated_duration: 30, // 預估完成時間(分鐘)
    instructions: ["使用鉛筆作答", "檢查計算過程"]
  }],
  
  class_media: [{
    id: "media_uuid", 
    type: "photo|video|document",
    url: "firebase_storage_url",
    caption: "課堂板書照片",
    upload_time: "2024-01-15T14:30:00Z",
    tags: ["板書", "重點筆記"],
    file_size: 1024000 // bytes
  }],
  
  // 元數據
  created_at: "2024-01-15T14:00:00Z",
  updated_at: "2024-01-15T14:30:00Z", 
  created_by: "parent|teacher|system",
  source: "manual|ai_extracted|line_bot",
  
  // 原始輸入數據（用於NLP訓練和改進）
  raw_input: {
    text: "今天數學課教了加法...", 
    media_files: ["line_image_url_1", "line_image_url_2"],
    extraction_confidence: 0.85,
    extraction_metadata: {
      nlp_model: "gpt-4",
      extraction_timestamp: "2024-01-15T14:00:00Z",
      manual_corrections: [] // 記錄人工修正
    }
  },
  
  // 狀態管理
  status: "draft|published|archived",
  visibility: "private|shared_with_teacher|public"
}
```

### 2. 與現有 Course 的關聯

```javascript
// 擴展現有 courses collection
{
  // ... 現有欄位
  
  // 新增欄位
  has_content: true, // 是否有課程內容記錄
  content_count: 5, // 內容記錄數量
  last_content_update: "2024-01-15T14:30:00Z",
  content_summary: {
    total_lessons: 10,
    pending_homework: 2,
    completed_homework: 8,
    total_media: 15
  }
}
```

### 3. 數據操作接口設計

```javascript
// DataService 新增方法
class DataService {
  static COLLECTIONS = {
    COURSES: 'courses',
    COURSE_CONTENTS: 'course_contents', // 新增
    TOKEN_USAGE: 'token_usage'
  };
  
  // 課程內容 CRUD
  static async createCourseContent(contentData)
  static async getCourseContent(contentId) 
  static async getCourseContentsByCourse(courseId)
  static async updateCourseContent(contentId, updateData)
  static async deleteCourseContent(contentId)
  
  // 批量操作
  static async getCourseContentsbyStudent(studentId, filters = {})
  static async searchCourseContents(criteria)
  
  // 媒體文件管理
  static async uploadClassMedia(file, metadata)
  static async deleteClassMedia(mediaId)
}
```

## 架構整合策略

### 1. 服務層擴展

- **DataService**: 新增 `course_contents` collection 操作
- **SemanticService**: 擴展語義識別支援課程內容提取
- **TaskService**: 新增課程內容相關業務邏輯

### 2. LINE Bot 消息處理流程

```
LINE 消息 → SemanticService 識別 → 提取內容類型 → TaskService 處理 → DataService 存儲
```

### 3. 未來 NLP 擴展支援

- 保留 `raw_input` 完整記錄用戶輸入
- `extraction_metadata` 記錄 AI 處理過程
- 支援人工修正和模型訓練反饋

### 4. 手動輸入/修改界面

- 結構化表單輸入
- 富文本編輯器支援課程描述
- 拖拽上傳照片功能
- 作業清單管理

## 數據一致性和完整性

### 1. 關聯約束
- `course_id` 必須對應存在的課程
- `student_id` 與關聯課程的學生一致

### 2. 數據驗證
- 日期格式標準化
- 文件大小和類型限制
- 必填欄位檢查

### 3. 清理策略
- 課程刪除時級聯刪除相關內容
- 媒體文件孤兒清理機制
- 定期歸檔舊數據

## 擴展性考慮

### 1. 多角色支援
- 家長、老師、學生不同權限
- 內容可見性控制

### 2. 評估功能預留
- 學習進度追蹤
- 成績記錄整合
- 學習分析報告

### 3. 協作功能
- 評論和回饋系統
- 家長-老師溝通記錄