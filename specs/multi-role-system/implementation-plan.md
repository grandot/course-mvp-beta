# 多角色功能实施计划

## 🎯 实施概述

本计划确保多角色功能与现有系统完全兼容，采用渐进式开发，分4个阶段完成，总计7天。

## 📋 冲突避免策略

### 1. 数据层兼容性
- **现有字段保持不变**：`courses` 集合的 `student_id` 字段语义变为 `parent_id`，但字段名不变
- **新增字段可选**：`child_id` 和 `child_nickname` 为可选字段，现有数据不受影响
- **默认值处理**：为现有课程自动创建默认子女关联

### 2. API层兼容性
- **现有接口不变**：所有现有API保持原有签名
- **新增可选参数**：子女相关参数为可选，不影响现有调用
- **向后兼容**：支持不带子女信息的原有表达方式

### 3. 语义识别兼容性
- **双重支持**：同时支持「明天下午两点钢琴课」和「小明明天下午两点钢琴课」
- **渐进识别**：优先识别子女信息，无子女信息时使用默认子女
- **后备机制**：子女识别失败时回退到原有逻辑

## 🔄 详细实施步骤

### Phase 1: 数据层扩展 (Day 1-2)

#### Day 1: 数据库结构扩展

**Task 1.1: 更新 Firestore 集合定义**

```javascript
// config/firestore-collections.json 新增
{
  "collections": {
    "children": {
      "description": "子女档案信息",
      "document_structure": {
        "id": {
          "type": "string",
          "description": "子女唯一标识符",
          "required": true
        },
        "parent_id": {
          "type": "string", 
          "description": "家长用户ID",
          "required": true,
          "index": true
        },
        "nickname": {
          "type": "string",
          "description": "子女昵称",
          "required": true
        },
        "gender": {
          "type": "string",
          "description": "性别",
          "enum": ["male", "female", "other"],
          "required": false
        },
        "birth_date": {
          "type": "string",
          "description": "出生日期 YYYY-MM-DD",
          "required": false
        },
        "is_active": {
          "type": "boolean",
          "description": "是否启用",
          "required": true,
          "default": true
        },
        "created_at": {
          "type": "timestamp",
          "required": true
        },
        "updated_at": {
          "type": "timestamp", 
          "required": true
        }
      }
    },
    "user_profiles": {
      "description": "用户档案信息",
      "document_structure": {
        "id": {
          "type": "string",
          "description": "用户ID",
          "required": true
        },
        "user_type": {
          "type": "string",
          "description": "用户类型",
          "enum": ["parent", "child"],
          "required": true
        },
        "display_name": {
          "type": "string",
          "description": "显示名称",
          "required": false
        },
        "settings": {
          "type": "object",
          "description": "用户设置",
          "schema": {
            "default_child_id": {
              "type": "string",
              "description": "默认子女ID"
            },
            "language": {
              "type": "string",
              "default": "zh-TW"
            }
          }
        },
        "is_active": {
          "type": "boolean",
          "required": true,
          "default": true
        },
        "created_at": {
          "type": "timestamp",
          "required": true
        },
        "updated_at": {
          "type": "timestamp",
          "required": true
        }
      }
    }
  }
}
```

**Task 1.2: 创建数据迁移脚本**

```javascript
// scripts/migrations/002_multi_role_setup.js
const FirebaseService = require('../../src/internal/firebaseService');
const TimeService = require('../../src/services/timeService');

async function migrateToMultiRole() {
  console.log('🚀 开始多角色系统数据迁移...');
  
  try {
    // 1. 为现有用户创建默认档案
    const existingUsers = await FirebaseService.queryDocuments('courses', {});
    const uniqueUserIds = [...new Set(existingUsers.map(course => course.student_id))];
    
    for (const userId of uniqueUserIds) {
      // 创建用户档案
      await createUserProfile(userId);
      // 创建默认子女
      await createDefaultChild(userId);
    }
    
    // 2. 为现有课程添加默认子女关联
    for (const course of existingUsers) {
      await updateCourseWithDefaultChild(course.id, course.student_id);
    }
    
    console.log('✅ 多角色系统数据迁移完成');
  } catch (error) {
    console.error('❌ 迁移失败:', error);
    throw error;
  }
}

async function createUserProfile(userId) {
  const profile = {
    id: userId,
    user_type: 'parent',
    display_name: `用户${userId.slice(-4)}`,
    settings: {
      language: 'zh-TW'
    },
    is_active: true,
    created_at: TimeService.getCurrentUserTime().toISOString(),
    updated_at: TimeService.getCurrentUserTime().toISOString()
  };
  
  await FirebaseService.createDocument('user_profiles', profile);
}

async function createDefaultChild(parentId) {
  const child = {
    id: `default_${parentId}`,
    parent_id: parentId,
    nickname: '默认子女',
    gender: 'other',
    is_active: true,
    created_at: TimeService.getCurrentUserTime().toISOString(),
    updated_at: TimeService.getCurrentUserTime().toISOString()
  };
  
  await FirebaseService.createDocument('children', child);
  
  // 更新用户档案的默认子女
  await FirebaseService.updateDocument('user_profiles', parentId, {
    'settings.default_child_id': child.id
  });
}

async function updateCourseWithDefaultChild(courseId, parentId) {
  const defaultChildId = `default_${parentId}`;
  
  await FirebaseService.updateDocument('courses', courseId, {
    child_id: defaultChildId,
    child_nickname: '默认子女'
  });
}

module.exports = { migrateToMultiRole };
```

**Task 1.3: 更新 DataService**

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

  // 修改现有方法以支持子女
  static async createCourse(courseData) {
    // ... 现有逻辑 ...
    
    const course = {
      // ... 现有字段 ...
      child_id: courseData.child_id || null,
      child_nickname: courseData.child_nickname || null,
      // ... 其他现有字段 ...
    };

    // ... 其余逻辑保持不变 ...
  }
}
```

### Phase 2: 语义分析扩展 (Day 3-4)

#### Day 3: 语义识别扩展

**Task 2.1: 更新 SemanticService**

```javascript
// src/services/semanticService.js 修改
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
}
```

**Task 2.2: 更新意图规则**

```yaml
# config/intent-rules.yaml 新增
# 子女管理意图
add_child:
  keywords: ['添加子女', '新增子女', '添加孩子', '新增孩子']
  priority: 8
  examples:
    - "添加子女小明"
    - "新增孩子小美"

list_children:
  keywords: ['我的子女', '孩子列表', '子女列表', '查看子女']
  priority: 8
  examples:
    - "我的子女有哪些"
    - "查看孩子列表"

switch_child:
  keywords: ['切换到', '切换子女', '切换到子女']
  priority: 8
  examples:
    - "切换到小明"
    - "切换子女到小美"

# 修改现有意图以支持子女
record_course:
  keywords: ['新增', '安排', '预約', '上课', '学习']
  priority: 6
  # 支持子女昵称的课程表达
  patterns: ['.*明天.*课', '.*今天.*课', '.*下周.*课', '.*每.*课']
  examples:
    - "小明明天下午两点钢琴课"
    - "小美每周三早上十点法语课"
```

### Phase 3: 业务逻辑集成 (Day 5-6)

#### Day 5: 任务服务扩展

**Task 3.1: 更新 TaskService**

```javascript
// src/services/taskService.js 修改
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
      const result = await DataService.createChild({
        parent_id: userId,
        nickname: child_nickname,
        gender: gender || 'other'
      });

      return {
        success: true,
        message: `✅ 已成功添加子女「${child_nickname}」`,
        childId: result.childId
      };
    } catch (error) {
      return {
        success: false,
        message: '添加子女失败，请稍后重试'
      };
    }
  }

  async handleRecordCourseWithChild(entities, userId) {
    const { child_nickname } = entities;
    
    // 如果有子女昵称，验证并获取子女ID
    let childId = null;
    if (child_nickname) {
      const children = await DataService.getUserChildren(userId);
      const child = children.find(c => c.nickname === child_nickname);
      
      if (!child) {
        return {
          success: false,
          message: `找不到子女「${child_nickname}」，请先添加子女或使用现有子女昵称`
        };
      }
      
      childId = child.id;
    } else {
      // 使用默认子女
      const userProfile = await DataService.getUserProfile(userId);
      childId = userProfile?.settings?.default_child_id;
    }

    // 添加子女信息到实体
    entities.child_id = childId;
    entities.child_nickname = child_nickname || '默认子女';

    // 调用原有的课程创建逻辑
    return await this.scenarioTemplate.createEntity(entities, userId);
  }
}
```

### Phase 4: 测试和优化 (Day 7)

#### Day 7: 完整测试

**Task 4.1: 创建测试用例**

```javascript
// tests/multi-role-system/basic.test.js
const TaskService = require('../../src/services/taskService');
const DataService = require('../../src/services/dataService');

describe('多角色系统基础功能测试', () => {
  const testUserId = 'test_user_123';

  beforeEach(async () => {
    // 清理测试数据
    await cleanupTestData(testUserId);
  });

  test('应该能正确识别子女昵称', async () => {
    const taskService = new TaskService();
    
    const result = await taskService.executeIntent('record_course', {
      course_name: '钢琴课',
      timeInfo: { date: '2025-07-30', display: '明天下午两点' },
      child_nickname: '小明'
    }, testUserId);

    expect(result.success).toBe(true);
    expect(result.message).toContain('小明');
  });

  test('应该支持不带子女昵称的原有表达', async () => {
    const taskService = new TaskService();
    
    const result = await taskService.executeIntent('record_course', {
      course_name: '钢琴课',
      timeInfo: { date: '2025-07-30', display: '明天下午两点' }
    }, testUserId);

    expect(result.success).toBe(true);
    // 应该使用默认子女
    expect(result.message).toContain('默认子女');
  });
});
```

## 🚨 关键风险缓解措施

### 1. 数据迁移风险
- **备份策略**：迁移前自动备份所有数据
- **回滚机制**：每个迁移步骤都有对应的回滚脚本
- **分阶段验证**：每个阶段完成后立即验证数据完整性

### 2. 语义识别准确性
- **双重验证**：子女昵称提取失败时自动回退到默认子女
- **用户反馈**：提供子女管理命令，让用户主动管理子女信息
- **渐进优化**：基于实际使用数据持续优化识别规则

### 3. 性能影响
- **索引优化**：为所有子女相关查询添加适当的数据库索引
- **缓存机制**：对频繁查询的子女信息进行缓存
- **查询优化**：避免N+1查询问题，使用批量查询

## 📊 验收检查清单

### 功能验收
- [ ] 「小明明天下午两点钢琴课」能正确识别并创建课程
- [ ] 「小美每周三早上十点法语课」能正确创建重复课程
- [ ] 课程查询显示包含子女昵称
- [ ] 支持子女添加、列表、切换功能
- [ ] 现有功能完全不受影响

### 技术验收
- [ ] 数据库查询性能不降低
- [ ] API响应时间保持现有水平
- [ ] 错误率 < 1%
- [ ] 向后兼容性 100%

### 用户体验验收
- [ ] 支持自然语言子女表达
- [ ] 子女信息在课程显示中清晰可见
- [ ] 子女管理操作简单直观
- [ ] 无学习成本，即插即用

## 🎯 成功指标

### 功能指标
- [ ] 支持至少5个子女的管理
- [ ] 语义识别准确率 > 90%
- [ ] 子女切换响应时间 < 2秒
- [ ] 课程查询包含子女信息

### 技术指标
- [ ] 数据库查询性能不降低
- [ ] API响应时间保持现有水平
- [ ] 错误率 < 1%
- [ ] 向后兼容性 100%

### 用户体验指标
- [ ] 支持自然语言子女表达
- [ ] 子女信息在课程显示中清晰可见
- [ ] 子女管理操作简单直观
- [ ] 无学习成本，即插即用 