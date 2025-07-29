# 多角色功能实施文档

## 🎯 功能目标（V1.0）

让家长在自己的账号下，建立多位子女的资料（如昵称、性别），并能针对每位子女分别管理课程。

## 🧩 核心设计思路

- 每个 parent 用户账号，可以建立多个 child profile（不是真正账号，只是资料节点）
- 每个课程会指向一个 child（由 parent 建立、编辑、查询）
- 所有语义任务都是家长视角：「卢米明天下午两点钢琴课」、「提醒我卢米明天的游泳课」
- 未来若要扩展「学生自己登录」功能，再帮 child profile 升级为独立账号并加上 UID 即可

## 📋 测试目标

- "小明明天下午两点钢琴课"
- "小美每周三早上十点法语课"

## 🏗️ 架构设计

### 数据模型扩展

#### 1. 新增 `children` 集合
```javascript
// Firestore: children 集合
{
  id: "child_id",
  parent_id: "parent_user_id",  // 关联到家长账号
  nickname: "小明",              // 子女昵称
  gender: "male",               // 性别: male/female/other
  birth_date: "2015-03-15",    // 出生日期 (可选)
  created_at: "2025-07-29T10:00:00Z",
  updated_at: "2025-07-29T10:00:00Z",
  is_active: true,              // 是否启用
  avatar_url: null,             // 头像URL (可选)
  notes: "喜欢音乐"             // 备注 (可选)
}
```

#### 2. 扩展 `courses` 集合
```javascript
// 现有 courses 集合新增字段
{
  // 现有字段保持不变
  id: "course_id",
  student_id: "parent_user_id",  // 保持现有字段，但语义变为 parent_id
  course_name: "钢琴课",
  schedule_time: "下午2点",
  course_date: "2025-07-30",
  
  // 新增字段
  child_id: "child_id",          // 关联到具体子女
  child_nickname: "小明",         // 冗余字段，便于查询显示
  
  // 其他现有字段保持不变
  location: "音乐教室",
  teacher: "李老师",
  status: "scheduled",
  is_recurring: false,
  // ... 其他现有字段
}
```

#### 3. 新增 `user_profiles` 集合
```javascript
// Firestore: user_profiles 集合
{
  id: "parent_user_id",
  user_id: "parent_user_id",     // 与 id 相同
  user_type: "parent",           // 用户类型: parent/child
  display_name: "张妈妈",         // 显示名称
  created_at: "2025-07-29T10:00:00Z",
  updated_at: "2025-07-29T10:00:00Z",
  settings: {
    default_child_id: "child_id",  // 默认子女ID
    language: "zh-TW",
    timezone: "Asia/Taipei"
  },
  is_active: true
}
```

### 索引设计

```javascript
// firestore.indexes.json 新增索引
{
  "indexes": [
    {
      "collectionGroup": "children",
      "fields": [
        {"fieldPath": "parent_id", "order": "ASCENDING"},
        {"fieldPath": "is_active", "order": "ASCENDING"}
      ]
    },
    {
      "collectionGroup": "courses",
      "fields": [
        {"fieldPath": "student_id", "order": "ASCENDING"},
        {"fieldPath": "child_id", "order": "ASCENDING"},
        {"fieldPath": "course_date", "order": "ASCENDING"}
      ]
    },
    {
      "collectionGroup": "courses",
      "fields": [
        {"fieldPath": "child_id", "order": "ASCENDING"},
        {"fieldPath": "status", "order": "ASCENDING"},
        {"fieldPath": "course_date", "order": "ASCENDING"}
      ]
    }
  ]
}
```

## 🔄 原子化实施步骤

### Phase 1: 数据层扩展 (2天)

#### Day 1: 数据库结构扩展
- [ ] **Task 1.1** 更新 `config/firestore-collections.json`
  - [ ] 添加 `children` 集合定义
  - [ ] 添加 `user_profiles` 集合定义
  - [ ] 扩展 `courses` 集合，添加 `child_id` 和 `child_nickname` 字段
  - [ ] 更新索引配置

- [ ] **Task 1.2** 创建数据迁移脚本
  - [ ] 创建 `scripts/migrations/002_multi_role_setup.js`
  - [ ] 为现有用户创建默认 `user_profiles` 记录
  - [ ] 为现有课程添加默认 `child_id`（使用虚拟默认子女）

- [ ] **Task 1.3** 更新 `DataService`
  - [ ] 添加 `CHILDREN` 和 `USER_PROFILES` 到 `COLLECTIONS`
  - [ ] 新增 `createChild()`, `getUserChildren()`, `updateChild()` 方法
  - [ ] 新增 `createUserProfile()`, `getUserProfile()` 方法
  - [ ] 修改 `createCourse()` 方法，支持 `child_id` 参数

#### Day 2: 服务层扩展
- [ ] **Task 1.4** 创建 `ChildService`
  - [ ] 创建 `src/services/childService.js`
  - [ ] 实现子女 CRUD 操作
  - [ ] 实现子女查询和验证逻辑

- [ ] **Task 1.5** 创建 `UserProfileService`
  - [ ] 创建 `src/services/userProfileService.js`
  - [ ] 实现用户档案管理
  - [ ] 实现默认子女设置

- [ ] **Task 1.6** 更新 `CourseService`
  - [ ] 修改 `createCourse()` 方法，支持子女关联
  - [ ] 修改 `getCoursesByUser()` 方法，支持按子女筛选
  - [ ] 添加 `getCoursesByChild()` 方法

### Phase 2: 语义分析扩展 (2天)

#### Day 3: 语义识别扩展
- [ ] **Task 2.1** 更新 `SemanticService`
  - [ ] 修改 `extractCourseEntities()` 方法，支持子女昵称提取
  - [ ] 添加子女昵称验证逻辑
  - [ ] 更新实体提取规则，支持「小明明天下午两点钢琴课」格式

- [ ] **Task 2.2** 更新意图规则配置
  - [ ] 修改 `config/intent-rules.yaml`
  - [ ] 添加子女管理相关意图：`add_child`, `list_children`, `switch_child`
  - [ ] 更新现有意图规则，支持子女昵称

- [ ] **Task 2.3** 创建子女管理服务
  - [ ] 创建 `src/services/childManagementService.js`
  - [ ] 实现子女添加、列表、切换功能
  - [ ] 实现子女昵称解析和验证

#### Day 4: 对话上下文扩展
- [ ] **Task 2.4** 更新 `ConversationContext`
  - [ ] 修改 `src/utils/conversationContext.js`
  - [ ] 添加 `current_child_id` 字段
  - [ ] 添加子女切换逻辑

- [ ] **Task 2.5** 更新场景模板
  - [ ] 修改 `CourseManagementScenarioTemplate`
  - [ ] 在课程操作中集成子女信息
  - [ ] 更新消息模板，支持子女昵称显示

### Phase 3: 业务逻辑集成 (2天)

#### Day 5: 任务服务扩展
- [ ] **Task 3.1** 更新 `TaskService`
  - [ ] 添加子女管理意图处理
  - [ ] 修改课程相关意图，支持子女关联
  - [ ] 添加子女切换和查询功能

- [ ] **Task 3.2** 更新场景配置
  - [ ] 修改 `config/scenarios/course_management.yaml`
  - [ ] 添加子女相关消息模板
  - [ ] 更新业务规则，支持子女筛选

- [ ] **Task 3.3** 创建子女管理控制器
  - [ ] 创建 `src/controllers/childController.js`
  - [ ] 实现子女管理相关业务逻辑
  - [ ] 集成到主控制器

#### Day 6: 查询和显示优化
- [ ] **Task 3.4** 更新课程查询逻辑
  - [ ] 修改 `queryEntities()` 方法，支持按子女筛选
  - [ ] 更新课程显示格式，包含子女信息
  - [ ] 添加子女切换功能

- [ ] **Task 3.5** 更新消息模板
  - [ ] 修改所有课程相关消息，包含子女昵称
  - [ ] 添加子女管理相关消息
  - [ ] 更新错误消息，支持子女上下文

### Phase 4: 测试和优化 (1天)

#### Day 7: 完整测试
- [ ] **Task 4.1** 创建测试用例
  - [ ] 创建 `tests/multi-role-system/` 目录
  - [ ] 编写子女管理功能测试
  - [ ] 编写课程关联子女测试
  - [ ] 编写语义识别测试

- [ ] **Task 4.2** 集成测试
  - [ ] 测试「小明明天下午两点钢琴课」
  - [ ] 测试「小美每周三早上十点法语课」
  - [ ] 测试子女切换功能
  - [ ] 测试多子女课程管理

- [ ] **Task 4.3** 性能优化
  - [ ] 优化查询性能
  - [ ] 添加缓存机制
  - [ ] 优化消息生成

## 🔒 向后兼容性保证

### 现有功能保护
1. **现有课程数据**：通过迁移脚本为现有课程添加默认子女关联
2. **现有用户**：自动创建用户档案和默认子女
3. **现有API**：保持现有接口不变，新增可选参数
4. **现有语义**：支持不带子女昵称的原有表达方式

### 渐进式迁移
1. **Phase 1**：数据层扩展，不影响现有功能
2. **Phase 2**：语义分析扩展，支持新旧两种表达
3. **Phase 3**：业务逻辑集成，保持向后兼容
4. **Phase 4**：测试验证，确保无回归

## 🚨 风险评估和缓解

### 高风险项
1. **数据迁移风险**
   - 缓解：创建完整的回滚脚本
   - 缓解：分阶段迁移，每阶段验证

2. **语义识别准确性**
   - 缓解：保留原有语义识别作为后备
   - 缓解：逐步训练和优化

3. **性能影响**
   - 缓解：添加适当的数据库索引
   - 缓解：实现查询缓存机制

### 中风险项
1. **用户体验变化**
   - 缓解：保持原有交互方式
   - 缓解：提供清晰的使用指导

2. **数据一致性**
   - 缓解：实施严格的数据验证
   - 缓解：添加数据完整性检查

## 📊 成功指标

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

## 🎯 验收标准

### 必须完成
- [ ] 「小明明天下午两点钢琴课」能正确识别并创建课程
- [ ] 「小美每周三早上十点法语课」能正确创建重复课程
- [ ] 课程查询显示包含子女昵称
- [ ] 支持子女添加、列表、切换功能
- [ ] 现有功能完全不受影响

### 可选完成
- [ ] 子女头像上传功能
- [ ] 子女生日提醒功能
- [ ] 子女课程统计功能
- [ ] 子女偏好设置功能

## 📝 文档更新

### 需要更新的文档
- [ ] `README.md` - 添加多角色功能说明
- [ ] `CHANGELOG.md` - 记录版本变更
- [ ] `config/firestore-collections.json` - 更新集合定义
- [ ] API文档 - 添加新接口说明
- [ ] 用户使用指南 - 添加多角色使用说明

### 新增文档
- [ ] `docs/multi-role-system/` - 多角色系统文档
- [ ] `docs/migration-guide.md` - 数据迁移指南
- [ ] `docs/user-guide-multi-role.md` - 用户使用指南 