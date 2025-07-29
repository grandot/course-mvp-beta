# 多角色功能代码变更指南

## 📁 文件变更清单

### 新增文件

#### 1. 服务层文件
```
src/services/childService.js          # 子女管理服务
src/services/userProfileService.js    # 用户档案服务
src/services/childManagementService.js # 子女管理业务逻辑
```

#### 2. 控制器文件
```
src/controllers/childController.js    # 子女管理控制器
```

#### 3. 迁移脚本
```
scripts/migrations/002_multi_role_setup.js  # 多角色数据迁移
```

#### 4. 测试文件
```
tests/multi-role-system/
├── basic.test.js                    # 基础功能测试
├── semantic.test.js                 # 语义识别测试
├── integration.test.js              # 集成测试
└── performance.test.js              # 性能测试
```

### 修改文件

#### 1. 配置文件
```
config/firestore-collections.json    # 新增集合定义
config/intent-rules.yaml            # 新增意图规则
config/scenarios/course_management.yaml # 更新场景配置
firestore.indexes.json              # 新增索引
```

#### 2. 服务层文件
```
src/services/dataService.js         # 新增子女相关方法
src/services/semanticService.js     # 新增子女昵称提取
src/services/taskService.js         # 新增子女管理意图
src/services/courseService.js       # 支持子女关联
```

#### 3. 场景模板文件
```
src/scenario/templates/CourseManagementScenarioTemplate.js # 支持子女显示
```

#### 4. 工具文件
```
src/utils/conversationContext.js    # 添加子女上下文
```

## 🔧 详细代码变更

### 1. 新增子女服务

```javascript
// src/services/childService.js
const DataService = require('./dataService');
const TimeService = require('./timeService');

class ChildService {
  /**
   * 创建子女档案
   * @param {string} parentId - 家长用户ID
   * @param {Object} childData - 子女数据
   * @returns {Promise<Object>} 创建结果
   */
  static async createChild(parentId, childData) {
    if (!parentId) {
      throw new Error('ChildService: parentId is required');
    }

    if (!childData.nickname) {
      throw new Error('ChildService: nickname is required');
    }

    // 检查昵称是否已存在
    const existingChildren = await DataService.getUserChildren(parentId);
    const nicknameExists = existingChildren.some(child => 
      child.nickname === childData.nickname
    );

    if (nicknameExists) {
      throw new Error(`子女昵称「${childData.nickname}」已存在`);
    }

    const result = await DataService.createChild({
      parent_id: parentId,
      nickname: childData.nickname,
      gender: childData.gender || 'other',
      birth_date: childData.birth_date || null
    });

    return {
      success: true,
      message: `✅ 已成功添加子女「${childData.nickname}」`,
      childId: result.childId,
      child: result.child
    };
  }

  /**
   * 获取用户的所有子女
   * @param {string} parentId - 家长用户ID
   * @returns {Promise<Array>} 子女列表
   */
  static async getUserChildren(parentId) {
    if (!parentId) {
      throw new Error('ChildService: parentId is required');
    }

    return await DataService.getUserChildren(parentId);
  }

  /**
   * 根据昵称获取子女
   * @param {string} parentId - 家长用户ID
   * @param {string} nickname - 子女昵称
   * @returns {Promise<Object|null>} 子女信息
   */
  static async getChildByNickname(parentId, nickname) {
    if (!parentId || !nickname) {
      throw new Error('ChildService: parentId and nickname are required');
    }

    const children = await DataService.getUserChildren(parentId);
    return children.find(child => child.nickname === nickname) || null;
  }

  /**
   * 更新子女信息
   * @param {string} childId - 子女ID
   * @param {Object} updateData - 更新数据
   * @returns {Promise<Object>} 更新结果
   */
  static async updateChild(childId, updateData) {
    if (!childId) {
      throw new Error('ChildService: childId is required');
    }

    const result = await DataService.updateChild(childId, {
      ...updateData,
      updated_at: TimeService.getCurrentUserTime().toISOString()
    });

    return {
      success: true,
      message: '✅ 子女信息已更新',
      child: result.child
    };
  }

  /**
   * 删除子女
   * @param {string} childId - 子女ID
   * @returns {Promise<Object>} 删除结果
   */
  static async deleteChild(childId) {
    if (!childId) {
      throw new Error('ChildService: childId is required');
    }

    // 检查是否有关联的课程
    const courses = await DataService.queryCourses({ child_id: childId });
    if (courses.length > 0) {
      throw new Error('该子女还有关联的课程，无法删除');
    }

    await DataService.deleteChild(childId);

    return {
      success: true,
      message: '✅ 子女已删除'
    };
  }
}

module.exports = ChildService;
```

### 2. 新增用户档案服务

```javascript
// src/services/userProfileService.js
const DataService = require('./dataService');
const TimeService = require('./timeService');

class UserProfileService {
  /**
   * 创建用户档案
   * @param {string} userId - 用户ID
   * @param {Object} profileData - 档案数据
   * @returns {Promise<Object>} 创建结果
   */
  static async createUserProfile(userId, profileData = {}) {
    if (!userId) {
      throw new Error('UserProfileService: userId is required');
    }

    const profile = {
      id: userId,
      user_id: userId,
      user_type: profileData.user_type || 'parent',
      display_name: profileData.display_name || `用户${userId.slice(-4)}`,
      settings: {
        language: profileData.language || 'zh-TW',
        timezone: profileData.timezone || 'Asia/Taipei',
        default_child_id: profileData.default_child_id || null
      },
      is_active: true,
      created_at: TimeService.getCurrentUserTime().toISOString(),
      updated_at: TimeService.getCurrentUserTime().toISOString()
    };

    const result = await DataService.createUserProfile(profile);

    return {
      success: true,
      message: '✅ 用户档案已创建',
      profile: result.profile
    };
  }

  /**
   * 获取用户档案
   * @param {string} userId - 用户ID
   * @returns {Promise<Object|null>} 用户档案
   */
  static async getUserProfile(userId) {
    if (!userId) {
      throw new Error('UserProfileService: userId is required');
    }

    return await DataService.getUserProfile(userId);
  }

  /**
   * 更新用户档案
   * @param {string} userId - 用户ID
   * @param {Object} updateData - 更新数据
   * @returns {Promise<Object>} 更新结果
   */
  static async updateUserProfile(userId, updateData) {
    if (!userId) {
      throw new Error('UserProfileService: userId is required');
    }

    const result = await DataService.updateUserProfile(userId, {
      ...updateData,
      updated_at: TimeService.getCurrentUserTime().toISOString()
    });

    return {
      success: true,
      message: '✅ 用户档案已更新',
      profile: result.profile
    };
  }

  /**
   * 设置默认子女
   * @param {string} userId - 用户ID
   * @param {string} childId - 子女ID
   * @returns {Promise<Object>} 设置结果
   */
  static async setDefaultChild(userId, childId) {
    if (!userId || !childId) {
      throw new Error('UserProfileService: userId and childId are required');
    }

    // 验证子女是否存在且属于该用户
    const child = await DataService.getChildById(childId);
    if (!child || child.parent_id !== userId) {
      throw new Error('子女不存在或不属于当前用户');
    }

    const result = await this.updateUserProfile(userId, {
      'settings.default_child_id': childId
    });

    return {
      success: true,
      message: `✅ 已设置「${child.nickname}」为默认子女`,
      profile: result.profile
    };
  }
}

module.exports = UserProfileService;
```

### 3. 修改 DataService

```javascript
// src/services/dataService.js 新增方法
class DataService {
  static COLLECTIONS = {
    COURSES: 'courses',
    TOKEN_USAGE: 'token_usage',
    CHILDREN: 'children',           // 新增
    USER_PROFILES: 'user_profiles'  // 新增
  };

  // 新增子女相关方法
  static async createChild(childData) {
    if (!childData.parent_id || !childData.nickname) {
      throw new Error('DataService: parent_id and nickname are required');
    }

    const child = {
      id: this.generateUUID(),
      parent_id: childData.parent_id,
      nickname: childData.nickname,
      gender: childData.gender || 'other',
      birth_date: childData.birth_date || null,
      is_active: true,
      created_at: TimeService.getCurrentUserTime().toISOString(),
      updated_at: TimeService.getCurrentUserTime().toISOString()
    };

    const result = await FirebaseService.createDocument(this.COLLECTIONS.CHILDREN, child);
    return { success: true, childId: result.id, child: result.data };
  }

  static async getUserChildren(userId) {
    if (!userId) {
      throw new Error('DataService: userId is required');
    }

    const children = await FirebaseService.queryDocuments(this.COLLECTIONS.CHILDREN, {
      parent_id: userId,
      is_active: true
    });

    return children;
  }

  static async getChildById(childId) {
    if (!childId) {
      throw new Error('DataService: childId is required');
    }

    const result = await FirebaseService.getDocument(this.COLLECTIONS.CHILDREN, childId);
    return result?.exists ? { id: result.id, ...result.data } : null;
  }

  static async updateChild(childId, updateData) {
    if (!childId) {
      throw new Error('DataService: childId is required');
    }

    const result = await FirebaseService.updateDocument(this.COLLECTIONS.CHILDREN, childId, updateData);
    return { success: true, child: result.data };
  }

  static async deleteChild(childId) {
    if (!childId) {
      throw new Error('DataService: childId is required');
    }

    await FirebaseService.deleteDocument(this.COLLECTIONS.CHILDREN, childId);
    return { success: true };
  }

  // 新增用户档案相关方法
  static async createUserProfile(profileData) {
    if (!profileData.id) {
      throw new Error('DataService: profile id is required');
    }

    const result = await FirebaseService.createDocument(this.COLLECTIONS.USER_PROFILES, profileData);
    return { success: true, profile: result.data };
  }

  static async getUserProfile(userId) {
    if (!userId) {
      throw new Error('DataService: userId is required');
    }

    const result = await FirebaseService.getDocument(this.COLLECTIONS.USER_PROFILES, userId);
    return result?.exists ? { id: result.id, ...result.data } : null;
  }

  static async updateUserProfile(userId, updateData) {
    if (!userId) {
      throw new Error('DataService: userId is required');
    }

    const result = await FirebaseService.updateDocument(this.COLLECTIONS.USER_PROFILES, userId, updateData);
    return { success: true, profile: result.data };
  }

  // 修改现有方法以支持子女
  static async createCourse(courseData) {
    if (!courseData) {
      throw new Error('DataService: courseData is required');
    }

    // 验证重复课程类型一致性
    this.validateRecurrenceType(courseData);

    let timestamp;
    try {
      timestamp = TimeService.getCurrentUserTime().toISOString();
    } catch (error) {
      console.warn('TimeService failed, using system time:', error.message);
      timestamp = TimeService.getCurrentUserTime().toISOString();
    }

    const course = {
      student_id: courseData.student_id,
      course_name: courseData.course_name,
      schedule_time: courseData.schedule_time,
      course_date: courseData.course_date,
      
      // 新增子女相关字段
      child_id: courseData.child_id || null,
      child_nickname: courseData.child_nickname || null,
      
      // 保留旧的重複課程欄位以維持向後相容性
      is_recurring: courseData.is_recurring || false,
      recurrence_pattern: courseData.recurrence_pattern || null,
      
      // 新增：三個布林欄位標註重複類型
      daily_recurring: courseData.daily_recurring || false,
      weekly_recurring: courseData.weekly_recurring || false,
      monthly_recurring: courseData.monthly_recurring || false,
      
      // 新增：重複詳細資訊
      recurrence_details: courseData.recurrence_details || null,
      
      location: courseData.location || null,
      teacher: courseData.teacher || null,
      status: courseData.status || 'scheduled',
      created_at: timestamp,
      updated_at: timestamp,
    };

    // 直接使用 Firebase
    const result = await FirebaseService.createDocument(this.COLLECTIONS.COURSES, course);
    
    console.log(`📝 Course created: ${courseData.course_name} (Child: ${course.child_nickname || 'default'})`);
    
    return {
      success: true,
      courseId: result.id,
      course: result.data,
    };
  }

  // 新增按子女查询课程的方法
  static async getCoursesByChild(childId, filters = {}) {
    if (!childId) {
      throw new Error('DataService: childId is required');
    }

    const queryFilters = { child_id: childId, ...filters };
    const courses = await FirebaseService.queryDocuments(this.COLLECTIONS.COURSES, queryFilters);
    
    return this.applyFilters(courses, filters);
  }
}
```

### 4. 修改 SemanticService

```javascript
// src/services/semanticService.js 新增方法
class SemanticService {
  // 新增子女昵称提取方法
  static async extractChildNickname(text) {
    // 常见的中文名字模式
    const namePatterns = [
      /^([小大][明美华强伟丽芳])\s/,  // 小明、小美等
      /^([张李王刘陈杨赵黄周吴])\s*/,   // 单字姓氏
      /^([一-龯]{2,4})\s/            // 2-4个中文字符
    ];

    for (const pattern of namePatterns) {
      const match = text.match(pattern);
      if (match) {
        return match[1];
      }
    }

    return null;
  }

  // 修改实体提取方法
  static async extractCourseEntities(text, userId, intent) {
    const entities = {};
    
    // 提取子女昵称
    const childNickname = await this.extractChildNickname(text);
    if (childNickname) {
      entities.child_nickname = childNickname;
      // 移除子女昵称，继续提取其他实体
      text = text.replace(new RegExp(`^${childNickname}\\s*`), '');
    }

    // ... 现有的实体提取逻辑 ...
    
    return entities;
  }

  // 新增子女昵称验证方法
  static async validateChildNickname(userId, nickname) {
    if (!nickname) {
      return { valid: false, message: '子女昵称不能为空' };
    }

    const ChildService = require('./childService');
    const child = await ChildService.getChildByNickname(userId, nickname);
    
    if (!child) {
      return { 
        valid: false, 
        message: `找不到子女「${nickname}」，请先添加子女或使用现有子女昵称` 
      };
    }

    return { valid: true, child };
  }
}
```

### 5. 修改 TaskService

```javascript
// src/services/taskService.js 新增方法
class TaskService {
  async executeIntent(intent, entities, userId) {
    // ... 现有逻辑 ...
    
    switch (intent) {
      // ... 现有 case ...
      
      case 'add_child':
        return await this.handleAddChild(entities, userId);
        
      case 'list_children':
        return await this.handleListChildren(entities, userId);
        
      case 'switch_child':
        return await this.handleSwitchChild(entities, userId);
        
      // 修改现有意图以支持子女
      case 'record_course':
        return await this.handleRecordCourseWithChild(entities, userId);
        
      case 'create_recurring_course':
        return await this.handleCreateRecurringCourseWithChild(entities, userId);
        
      // ... 其他 case ...
    }
  }

  async handleAddChild(entities, userId) {
    const { child_nickname, gender } = entities;
    
    if (!child_nickname) {
      return {
        success: false,
        message: '请提供子女昵称，例如：「添加子女小明」'
      };
    }

    try {
      const ChildService = require('./childService');
      const result = await ChildService.createChild(userId, {
        nickname: child_nickname,
        gender: gender || 'other'
      });

      return result;
    } catch (error) {
      return {
        success: false,
        message: error.message || '添加子女失败，请稍后重试'
      };
    }
  }

  async handleListChildren(entities, userId) {
    try {
      const ChildService = require('./childService');
      const children = await ChildService.getUserChildren(userId);
      
      if (children.length === 0) {
        return {
          success: true,
          message: '您还没有添加任何子女，请使用「添加子女小明」来添加子女'
        };
      }

      const childrenList = children.map(child => 
        `• ${child.nickname}${child.gender !== 'other' ? ` (${child.gender === 'male' ? '男' : '女'})` : ''}`
      ).join('\n');

      return {
        success: true,
        message: `您的子女列表：\n${childrenList}\n\n使用「切换到小明」来切换当前子女`
      };
    } catch (error) {
      return {
        success: false,
        message: '获取子女列表失败，请稍后重试'
      };
    }
  }

  async handleSwitchChild(entities, userId) {
    const { child_nickname } = entities;
    
    if (!child_nickname) {
      return {
        success: false,
        message: '请指定要切换的子女昵称，例如：「切换到小明」'
      };
    }

    try {
      const ChildService = require('./childService');
      const child = await ChildService.getChildByNickname(userId, child_nickname);
      
      if (!child) {
        return {
          success: false,
          message: `找不到子女「${child_nickname}」，请先添加子女或使用现有子女昵称`
        };
      }

      // 更新用户档案的默认子女
      const UserProfileService = require('./userProfileService');
      await UserProfileService.setDefaultChild(userId, child.id);

      return {
        success: true,
        message: `✅ 已切换到「${child.nickname}」，现在可以为其管理课程了`
      };
    } catch (error) {
      return {
        success: false,
        message: error.message || '切换子女失败，请稍后重试'
      };
    }
  }

  async handleRecordCourseWithChild(entities, userId) {
    const { child_nickname } = entities;
    
    // 如果有子女昵称，验证并获取子女ID
    let childId = null;
    let childNickname = null;
    
    if (child_nickname) {
      const ChildService = require('./childService');
      const child = await ChildService.getChildByNickname(userId, child_nickname);
      
      if (!child) {
        return {
          success: false,
          message: `找不到子女「${child_nickname}」，请先添加子女或使用现有子女昵称`
        };
      }
      
      childId = child.id;
      childNickname = child.nickname;
    } else {
      // 使用默认子女
      const UserProfileService = require('./userProfileService');
      const userProfile = await UserProfileService.getUserProfile(userId);
      childId = userProfile?.settings?.default_child_id;
      childNickname = '默认子女';
    }

    // 添加子女信息到实体
    entities.child_id = childId;
    entities.child_nickname = childNickname;

    // 调用原有的课程创建逻辑
    return await this.scenarioTemplate.createEntity(entities, userId);
  }
}
```

### 6. 修改场景模板

```javascript
// src/scenario/templates/CourseManagementScenarioTemplate.js 修改
class CourseManagementScenarioTemplate extends ScenarioTemplate {
  // 修改课程显示格式，包含子女信息
  formatQueryResultMessage(stats) {
    const { regularCourses, recurringTemplates, recurringInstances } = stats;
    
    let message = `📚 您的课程安排：\n`;
    
    if (regularCourses > 0 || recurringInstances > 0) {
      message += `共找到 ${regularCourses + recurringInstances} 堂课程`;
      
      if (recurringInstances > 0) {
        message += `（包含 ${regularCourses} 堂一般课程，${recurringInstances} 堂重复课程实例）`;
      }
      
      if (recurringTemplates > 0) {
        message += `\n🔄 重复课程模板: ${recurringTemplates} 个`;
      }
    } else {
      message += `目前没有任何课程安排`;
    }
    
    return message;
  }

  // 修改课程数据构建，支持子女信息
  buildCourseData(userId, courseName, timeInfo, location, teacher, childInfo = null) {
    const defaults = this.config.course_specific?.defaults || {};
    
    return {
      student_id: userId,
      course_name: courseName,
      schedule_time: timeInfo?.display || 'TBD',
      course_date: timeInfo?.date || null,
      location: location || defaults.location || null,
      teacher: teacher || defaults.teacher || null,
      status: defaults.status || 'scheduled',
      is_recurring: defaults.is_recurring || false,
      recurrence_pattern: null,
      // 新增子女相关字段
      child_id: childInfo?.child_id || null,
      child_nickname: childInfo?.child_nickname || null
    };
  }

  // 修改成功消息，包含子女信息
  createSuccessResponse(message, data = {}) {
    const childInfo = data.child_nickname ? ` (${data.child_nickname})` : '';
    const enhancedMessage = message.replace('{entity_name}', `课程${childInfo}`);
    
    return {
      success: true,
      message: enhancedMessage,
      data
    };
  }
}
```

## 🔒 向后兼容性保证

### 1. 现有API保持不变
- 所有现有方法签名不变
- 新增参数为可选参数
- 现有调用方式完全兼容

### 2. 现有数据不受影响
- 通过迁移脚本为现有数据添加默认值
- 现有课程自动关联到默认子女
- 现有用户自动创建档案

### 3. 现有语义表达仍然支持
- 「明天下午两点钢琴课」仍然有效
- 自动使用默认子女
- 无需用户学习新的表达方式

## 🚨 关键注意事项

### 1. 数据库索引
确保在部署前创建所有必要的索引，避免查询性能问题。

### 2. 数据迁移
在生产环境部署前，务必在测试环境完整运行迁移脚本。

### 3. 错误处理
所有新增功能都要有完善的错误处理和用户友好的错误消息。

### 4. 性能监控
部署后密切监控系统性能，确保没有性能退化。 