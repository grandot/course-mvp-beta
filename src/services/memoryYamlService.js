/**
 * Memory.yaml 管理服務
 * 三層語意記憶系統 - Layer 2 實現
 * 
 * 職責：
 * - 用於 GPT 優化理解語意背景
 * - 保存最多 20 筆，包含最新、重複、近期課程
 * - 處理語意接續、省略表達
 * - 每日重置 + 事件觸發重生
 */

const fs = require('fs').promises;
const path = require('path');
const yaml = require('js-yaml');
const { 
  CourseRecordValidator, 
  MemoryExampleGenerator, 
  BusinessRequirementChecker 
} = require('../types/memoryValidation');

class MemoryYamlService {
  constructor(config = {}) {
    // 配置參數
    this.maxRecords = config.maxRecords || 20;
    this.storagePath = config.storagePath || path.join(process.cwd(), 'memory');
    this.cacheTTL = config.cacheTTL || 24 * 60 * 60 * 1000; // 24小時
    
    // 用戶記憶快取 - Map<userId, UserMemory>
    this.cache = new Map();
    
    // 初始化存儲目錄
    this.initializeStorage();
    
    console.log(`🗃️ MemoryYamlService 初始化完成`);
    console.log(`   最大記錄數: ${this.maxRecords}`);
    console.log(`   存儲路徑: ${this.storagePath}`);
    console.log(`   快取TTL: ${this.cacheTTL}ms`);
  }

  /**
   * 初始化存儲目錄
   */
  async initializeStorage() {
    try {
      await fs.access(this.storagePath);
    } catch (error) {
      // 目錄不存在，創建它
      await fs.mkdir(this.storagePath, { recursive: true });
      console.log(`📁 創建記憶存儲目錄: ${this.storagePath}`);
    }
  }

  /**
   * 獲取用戶記憶 - 快取優先策略
   * @param {string} userId 用戶ID
   * @returns {Promise<Object>} UserMemory 對象
   */
  async getUserMemory(userId) {
    try {
      // 1. 快取優先策略
      if (this.cache.has(userId)) {
        const cached = this.cache.get(userId);
        const now = Date.now();
        
        // 檢查快取是否過期
        if (now - cached.cacheTimestamp < this.cacheTTL) {
          console.log(`💾 從快取讀取用戶記憶: ${userId}`);
          return cached.memory;
        } else {
          console.log(`⏰ 快取過期，移除: ${userId}`);
          this.cache.delete(userId);
        }
      }

      // 2. 從檔案載入
      const memory = await this.loadYamlFile(userId);
      
      // 3. 更新快取
      this.cache.set(userId, {
        memory,
        cacheTimestamp: Date.now()
      });
      
      console.log(`📄 從檔案讀取用戶記憶: ${userId} (${this.getTotalRecords(memory)} 筆記錄)`);
      return memory;
      
    } catch (error) {
      console.error(`❌ 獲取用戶記憶失敗 [${userId}]:`, error.message);
      
      // 返回空的用戶記憶結構
      return this.createEmptyUserMemory(userId);
    }
  }

  /**
   * 更新用戶記憶
   * @param {string} userId 用戶ID
   * @param {Object} newRecord 新記錄
   * @returns {Promise<Object>} MemoryOperationResult
   */
  async updateUserMemory(userId, newRecord) {
    try {
      console.log(`🔄 更新用戶記憶: ${userId}`, newRecord);
      
      // 1. 獲取當前記憶
      const memory = await this.getUserMemory(userId);
      
      // 2. 驗證新記錄
      const validation = CourseRecordValidator.validate(newRecord);
      if (!validation.valid) {
        return {
          success: false,
          error: `記錄驗證失敗: ${validation.errors.join(', ')}`,
          recordCount: this.getTotalRecords(memory)
        };
      }

      // 3. 智能更新邏輯
      this.insertOrUpdateRecord(memory, newRecord);
      this.maintainRecordLimit(memory);
      this.updateRecurringPatterns(memory);
      
      // 4. 更新時間戳
      memory.lastUpdated = new Date().toISOString();
      
      // 5. 同步更新快取和檔案
      this.cache.set(userId, {
        memory,
        cacheTimestamp: Date.now()
      });
      
      await this.saveYamlFile(userId, memory);
      
      const totalRecords = this.getTotalRecords(memory);
      console.log(`✅ 用戶記憶更新成功: ${userId} (總記錄: ${totalRecords})`);
      
      return {
        success: true,
        data: memory,
        recordCount: totalRecords
      };
      
    } catch (error) {
      console.error(`❌ 更新用戶記憶失敗 [${userId}]:`, error.message);
      return {
        success: false,
        error: error.message,
        recordCount: 0
      };
    }
  }

  /**
   * 🎯 關鍵方法：生成GPT可用的記憶摘要
   * @param {string} userId 用戶ID
   * @returns {Promise<string>} 格式化的記憶摘要
   */
  async generateMemorySummary(userId) {
    try {
      const memory = await this.getUserMemory(userId);
      if (!memory || Object.keys(memory.students).length === 0) {
        return '';
      }
      
      return MemoryExampleGenerator.generateMemorySummary(memory);
      
    } catch (error) {
      console.error(`❌ 生成記憶摘要失敗 [${userId}]:`, error.message);
      return '';
    }
  }

  /**
   * 載入 YAML 檔案
   * @param {string} userId 用戶ID
   * @returns {Promise<Object>} UserMemory 對象
   */
  async loadYamlFile(userId) {
    const filePath = this.getMemoryFilePath(userId);
    
    try {
      const fileContent = await fs.readFile(filePath, 'utf8');
      const memory = yaml.load(fileContent);
      
      // 基本結構驗證
      if (!memory || typeof memory !== 'object') {
        throw new Error('無效的 YAML 結構');
      }
      
      return memory;
      
    } catch (error) {
      if (error.code === 'ENOENT') {
        // 檔案不存在，創建新的用戶記憶
        console.log(`📝 創建新的用戶記憶檔案: ${userId}`);
        return this.createEmptyUserMemory(userId);
      }
      
      throw new Error(`載入 YAML 檔案失敗: ${error.message}`);
    }
  }

  /**
   * 保存 YAML 檔案
   * @param {string} userId 用戶ID
   * @param {Object} memory UserMemory 對象
   */
  async saveYamlFile(userId, memory) {
    const filePath = this.getMemoryFilePath(userId);
    
    try {
      // 業務需求一致性檢查
      const consistencyCheck = BusinessRequirementChecker.checkConsistency(memory);
      if (!consistencyCheck.valid) {
        console.warn(`⚠️ 記憶一致性警告 [${userId}]:`, consistencyCheck.issues);
      }
      
      // 轉換為 YAML 格式
      const yamlContent = yaml.dump(memory, {
        indent: 2,
        lineWidth: 120,
        noRefs: true
      });
      
      // 寫入檔案
      await fs.writeFile(filePath, yamlContent, 'utf8');
      console.log(`💾 記憶檔案保存成功: ${filePath}`);
      
    } catch (error) {
      throw new Error(`保存 YAML 檔案失敗: ${error.message}`);
    }
  }

  /**
   * 智能插入或更新記錄
   * @param {Object} memory UserMemory 對象
   * @param {Object} newRecord 新記錄
   */
  insertOrUpdateRecord(memory, newRecord) {
    const studentName = newRecord.student || newRecord.studentName;
    const courseName = newRecord.courseName;
    
    if (!studentName || !courseName) {
      throw new Error('缺少必要欄位: student 和 courseName');
    }

    // 確保學生存在
    if (!memory.students[studentName]) {
      memory.students[studentName] = {
        courses: [],
        preferences: {
          frequentCourses: [],
          defaultSettings: {}
        }
      };
    }

    const student = memory.students[studentName];
    
    // 查找已存在的課程記錄
    const existingCourseIndex = student.courses.findIndex(
      course => course.courseName === courseName
    );

    if (existingCourseIndex !== -1) {
      // 更新現有記錄
      const existingCourse = student.courses[existingCourseIndex];
      
      // 增加頻率
      existingCourse.frequency = (existingCourse.frequency || 1) + 1;
      existingCourse.lastMentioned = new Date().toISOString();
      
      // 更新其他欄位
      if (newRecord.schedule) {
        existingCourse.schedule = { ...existingCourse.schedule, ...newRecord.schedule };
      }
      if (newRecord.teacher) existingCourse.teacher = newRecord.teacher;
      if (newRecord.location) existingCourse.location = newRecord.location;
      if (newRecord.notes) existingCourse.notes = newRecord.notes;
      
      console.log(`🔄 更新現有課程記錄: ${studentName} - ${courseName} (頻率: ${existingCourse.frequency})`);
      
    } else {
      // 創建新記錄
      const courseRecord = CourseRecordValidator.create(
        courseName,
        newRecord.schedule || {},
        {
          teacher: newRecord.teacher,
          location: newRecord.location,
          notes: newRecord.notes,
          frequency: 1
        }
      );
      
      student.courses.push(courseRecord);
      console.log(`➕ 新增課程記錄: ${studentName} - ${courseName}`);
    }

    // 添加到最近活動
    this.addRecentActivity(memory, {
      activityType: existingCourseIndex !== -1 ? 'modify' : 'create',
      studentName,
      courseName,
      metadata: { source: 'user_input' }
    });
  }

  /**
   * 維護記錄數量限制 (最多20筆)
   * @param {Object} memory UserMemory 對象
   */
  maintainRecordLimit(memory) {
    let totalRecords = this.getTotalRecords(memory);
    
    if (totalRecords <= this.maxRecords) {
      return; // 未超過限制
    }

    console.log(`⚠️ 記錄數量超限 (${totalRecords}/${this.maxRecords})，開始清理...`);
    
    // 收集所有課程記錄，按頻率和最後提及時間排序
    const allCourses = [];
    
    Object.entries(memory.students).forEach(([studentName, studentInfo]) => {
      studentInfo.courses.forEach((course, index) => {
        allCourses.push({
          studentName,
          courseIndex: index,
          course,
          priority: this.calculateRecordPriority(course)
        });
      });
    });

    // 按優先級排序 (高優先級在前)
    allCourses.sort((a, b) => b.priority - a.priority);
    
    // 保留前 maxRecords 筆記錄
    const toKeep = allCourses.slice(0, this.maxRecords);
    const toRemove = allCourses.slice(this.maxRecords);
    
    // 重建學生課程列表
    Object.keys(memory.students).forEach(studentName => {
      memory.students[studentName].courses = [];
    });
    
    toKeep.forEach(item => {
      memory.students[item.studentName].courses.push(item.course);
    });
    
    console.log(`🧹 記錄清理完成，移除 ${toRemove.length} 筆低優先級記錄`);
    console.log(`📊 當前記錄數: ${this.getTotalRecords(memory)}/${this.maxRecords}`);
  }

  /**
   * 更新重複模式識別
   * @param {Object} memory UserMemory 對象
   */
  updateRecurringPatterns(memory) {
    // 清空現有模式
    memory.recurringPatterns = [];
    
    Object.entries(memory.students).forEach(([studentName, studentInfo]) => {
      studentInfo.courses.forEach(course => {
        // 檢查是否為重複課程
        if (course.schedule?.recurring && course.schedule.recurring !== 'once') {
          const pattern = {
            patternId: `${studentName}_${course.courseName}_${Date.now()}`,
            studentName,
            courseName: course.courseName,
            patternType: course.schedule.recurring,
            schedule: {
              dayOfWeek: course.schedule.dayOfWeek,
              time: course.schedule.time
            },
            confidence: this.calculatePatternConfidence(course),
            createdAt: new Date().toISOString()
          };
          
          memory.recurringPatterns.push(pattern);
        }
      });
    });
    
    if (memory.recurringPatterns.length > 0) {
      console.log(`🔄 更新重複模式: ${memory.recurringPatterns.length} 個模式`);
    }
  }

  /**
   * 添加最近活動記錄
   * @param {Object} memory UserMemory 對象
   * @param {Object} activityData 活動數據
   */
  addRecentActivity(memory, activityData) {
    const activity = {
      activityId: `activity_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      activityType: activityData.activityType,
      studentName: activityData.studentName,
      courseName: activityData.courseName,
      timestamp: new Date().toISOString(),
      metadata: activityData.metadata || {}
    };
    
    memory.recentActivities.unshift(activity);
    
    // 限制最近活動數量 (最多保留10筆)
    if (memory.recentActivities.length > 10) {
      memory.recentActivities = memory.recentActivities.slice(0, 10);
    }
  }

  /**
   * 計算記錄優先級 (用於記錄清理)
   * @param {Object} course CourseRecord
   * @returns {number} 優先級分數 (越高越重要)
   */
  calculateRecordPriority(course) {
    let priority = 0;
    
    // 頻率權重 (40%)
    priority += (course.frequency || 1) * 4;
    
    // 最近提及權重 (30%)
    if (course.lastMentioned) {
      const daysSinceLastMention = (Date.now() - new Date(course.lastMentioned).getTime()) / (1000 * 60 * 60 * 24);
      priority += Math.max(0, 10 - daysSinceLastMention) * 3;
    }
    
    // 重複課程權重 (20%)
    if (course.schedule?.recurring && course.schedule.recurring !== 'once') {
      priority += 8;
    }
    
    // 完整度權重 (10%)
    let completeness = 0;
    if (course.teacher) completeness += 1;
    if (course.location) completeness += 1;
    if (course.schedule?.time) completeness += 1;
    if (course.schedule?.date || course.schedule?.dayOfWeek) completeness += 1;
    priority += completeness;
    
    return priority;
  }

  /**
   * 計算模式置信度
   * @param {Object} course CourseRecord
   * @returns {number} 置信度 (0-1)
   */
  calculatePatternConfidence(course) {
    let confidence = 0.5; // 基礎置信度
    
    // 頻率加成
    if (course.frequency >= 5) confidence += 0.3;
    else if (course.frequency >= 3) confidence += 0.2;
    else if (course.frequency >= 2) confidence += 0.1;
    
    // 時間信息完整度加成
    if (course.schedule?.time && course.schedule?.dayOfWeek !== undefined) {
      confidence += 0.2;
    }
    
    return Math.min(1.0, confidence);
  }

  /**
   * 創建空的用戶記憶
   * @param {string} userId 用戶ID
   * @returns {Object} 空的 UserMemory 對象
   */
  createEmptyUserMemory(userId) {
    return {
      userId,
      students: {},
      recentActivities: [],
      recurringPatterns: [],
      lastUpdated: new Date().toISOString()
    };
  }

  /**
   * 獲取記憶檔案路徑
   * @param {string} userId 用戶ID
   * @returns {string} 檔案路徑
   */
  getMemoryFilePath(userId) {
    return path.join(this.storagePath, `${userId}.yaml`);
  }

  /**
   * 獲取總記錄數
   * @param {Object} memory UserMemory 對象
   * @returns {number} 總記錄數
   */
  getTotalRecords(memory) {
    return Object.values(memory.students)
      .reduce((total, student) => total + student.courses.length, 0);
  }

  /**
   * 清理過期快取
   */
  cleanupExpiredCache() {
    const now = Date.now();
    let cleanupCount = 0;
    
    for (const [userId, cached] of this.cache.entries()) {
      if (now - cached.cacheTimestamp >= this.cacheTTL) {
        this.cache.delete(userId);
        cleanupCount++;
      }
    }
    
    if (cleanupCount > 0) {
      console.log(`🧹 清理過期快取: ${cleanupCount} 個用戶`);
    }
    
    return cleanupCount;
  }

  /**
   * 獲取服務統計信息
   * @returns {Object} 統計信息
   */
  getServiceStats() {
    return {
      cacheSize: this.cache.size,
      maxRecords: this.maxRecords,
      storagePath: this.storagePath,
      cacheTTL: this.cacheTTL
    };
  }
}

module.exports = MemoryYamlService;