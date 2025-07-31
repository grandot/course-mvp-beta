/**
 * Memory.yaml 數據結構驗證器和示例
 * 確保數據結構與業務需求一致性
 */

const { v4: uuidv4 } = require('uuid');

/**
 * CourseRecord 數據驗證器
 */
class CourseRecordValidator {
  /**
   * 驗證課程記錄是否符合規格
   * @param {Object} courseRecord 
   * @returns {Object} 驗證結果 {valid: boolean, errors: string[]}
   */
  static validate(courseRecord) {
    const errors = [];

    // 必填欄位檢查
    if (!courseRecord.courseName || typeof courseRecord.courseName !== 'string') {
      errors.push('courseName is required and must be a string');
    }

    // schedule 結構檢查
    if (courseRecord.schedule) {
      const schedule = courseRecord.schedule;
      
      // 時間格式驗證
      if (schedule.time && !/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/.test(schedule.time)) {
        errors.push('schedule.time must be in HH:MM format');
      }

      // 日期格式驗證
      if (schedule.date && !/^\d{4}-\d{2}-\d{2}$/.test(schedule.date)) {
        errors.push('schedule.date must be in YYYY-MM-DD format');
      }

      // 重複類型驗證
      if (schedule.recurring && !['weekly', 'monthly', 'once'].includes(schedule.recurring)) {
        errors.push('schedule.recurring must be weekly, monthly, or once');
      }

      // 週幾驗證
      if (schedule.dayOfWeek !== undefined && (schedule.dayOfWeek < 0 || schedule.dayOfWeek > 6)) {
        errors.push('schedule.dayOfWeek must be between 0-6');
      }
    }

    // frequency 驗證
    if (courseRecord.frequency !== undefined && (typeof courseRecord.frequency !== 'number' || courseRecord.frequency < 1)) {
      errors.push('frequency must be a positive number');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * 創建標準的 CourseRecord
   * @param {string} courseName 
   * @param {Object} scheduleInfo 
   * @param {Object} options 
   * @returns {Object} CourseRecord
   */
  static create(courseName, scheduleInfo = {}, options = {}) {
    return {
      courseName,
      schedule: {
        date: scheduleInfo.date,
        time: scheduleInfo.time, 
        recurring: scheduleInfo.recurring || 'once',
        dayOfWeek: scheduleInfo.dayOfWeek,
        description: scheduleInfo.description
      },
      teacher: options.teacher,
      location: options.location,
      notes: options.notes,
      frequency: options.frequency || 1,
      lastMentioned: new Date().toISOString()
    };
  }
}

/**
 * UserMemory 示例數據生成器
 */
class MemoryExampleGenerator {
  /**
   * 生成示例用戶記憶數據
   * @param {string} userId 
   * @returns {Object} UserMemory 示例
   */
  static generateExample(userId = 'user_001') {
    return {
      userId,
      students: {
        '小明': {
          courses: [
            CourseRecordValidator.create('數學課', {
              time: '14:00',
              recurring: 'weekly',
              dayOfWeek: 3,
              description: '每週三下午'
            }, {
              teacher: '張老師',
              location: '教室A',
              frequency: 5
            }),
            CourseRecordValidator.create('英文課', {
              time: '16:00', 
              recurring: 'weekly',
              dayOfWeek: 5,
              description: '每週五下午'
            }, {
              teacher: '李老師',
              frequency: 3
            })
          ],
          preferences: {
            frequentCourses: ['數學課', '英文課'],
            preferredTimeFormat: '24h',
            defaultSettings: {}
          }
        },
        '小華': {
          courses: [
            CourseRecordValidator.create('鋼琴課', {
              time: '10:00',
              recurring: 'weekly', 
              dayOfWeek: 6,
              description: '每週六上午'
            }, {
              teacher: '王老師',
              location: '音樂教室',
              frequency: 2
            })
          ],
          preferences: {
            frequentCourses: ['鋼琴課'],
            preferredTimeFormat: '12h',
            defaultSettings: {}
          }
        }
      },
      recentActivities: [
        {
          activityId: uuidv4(),
          activityType: 'create',
          studentName: '小明',
          courseName: '數學課',
          timestamp: new Date().toISOString(),
          metadata: { source: 'user_input' }
        },
        {
          activityId: uuidv4(),
          activityType: 'modify',
          studentName: '小明', 
          courseName: '數學課',
          timestamp: new Date(Date.now() - 3600000).toISOString(), // 1小時前
          metadata: { changeType: 'time_update' }
        }
      ],
      recurringPatterns: [
        {
          patternId: uuidv4(),
          studentName: '小明',
          courseName: '數學課',
          patternType: 'weekly',
          schedule: { dayOfWeek: 3, time: '14:00' },
          confidence: 0.95,
          createdAt: new Date().toISOString()
        }
      ],
      lastUpdated: new Date().toISOString()
    };
  }

  /**
   * 生成 GPT Fallback 用的記憶摘要示例
   * @param {Object} userMemory 
   * @returns {string} 格式化的記憶摘要
   */
  static generateMemorySummary(userMemory) {
    let summary = `記憶 Memory.yaml:\n`;
    
    Object.entries(userMemory.students).forEach(([studentName, studentInfo]) => {
      summary += `${studentName}：\n`;
      studentInfo.courses.forEach(course => {
        const timeDesc = course.schedule.description || 
          `${course.schedule.time || '未指定時間'}`;
        summary += `- ${course.courseName} | ${timeDesc}`;
        if (course.teacher) summary += ` | ${course.teacher}`;
        summary += `\n`;
      });
      summary += `\n`;
    });

    return summary;
  }
}

/**
 * 業務需求一致性檢查器
 */
class BusinessRequirementChecker {
  /**
   * 檢查數據結構是否符合三層記憶系統需求
   * @param {Object} userMemory 
   * @returns {Object} 檢查結果
   */
  static checkConsistency(userMemory) {
    const issues = [];
    const recommendations = [];

    // 1. 記錄數量檢查 (最多20筆)
    const totalCourses = Object.values(userMemory.students)
      .reduce((total, student) => total + student.courses.length, 0);
    
    if (totalCourses > 20) {
      issues.push(`總課程記錄 ${totalCourses} 筆超過限制 (20筆)`);
      recommendations.push('需要實施記錄清理策略');
    }

    // 2. 頻率統計檢查
    Object.entries(userMemory.students).forEach(([studentName, studentInfo]) => {
      studentInfo.courses.forEach(course => {
        if (!course.frequency || course.frequency < 1) {
          issues.push(`${studentName} 的 ${course.courseName} 缺少有效頻率統計`);
        }
      });
    });

    // 3. 重複模式一致性檢查
    userMemory.recurringPatterns.forEach(pattern => {
      const student = userMemory.students[pattern.studentName];
      if (!student) {
        issues.push(`重複模式引用不存在的學生: ${pattern.studentName}`);
        return;
      }

      const course = student.courses.find(c => c.courseName === pattern.courseName);
      if (!course) {
        issues.push(`重複模式引用不存在的課程: ${pattern.courseName}`);
      }
    });

    // 4. GPT 可讀性檢查
    const memorySummary = MemoryExampleGenerator.generateMemorySummary(userMemory);
    if (memorySummary.length > 2000) {
      recommendations.push('記憶摘要過長，可能影響 GPT 處理效率');
    }

    return {
      valid: issues.length === 0,
      issues,
      recommendations,
      totalRecords: totalCourses,
      summaryLength: memorySummary.length
    };
  }
}

module.exports = {
  CourseRecordValidator,
  MemoryExampleGenerator,
  BusinessRequirementChecker
};