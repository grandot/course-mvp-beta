# System Architecture Design

## 🏗️ Three-Layer Semantic Architecture

### Core Philosophy
**Separation-based Architecture Design** - Single Source of Truth + Forced Boundaries

```
User Natural Language → Semantic Layer → Time Layer → Task Execution Layer → Unified Response
```

### System Design Principles

**Single Source of Truth**: Each functionality has only one unique entry point
- ✅ All time-related operations → `TimeService`
- ✅ All semantic operations → `SemanticService`  
- ✅ All data operations → `DataService`

**Forced Boundaries**: Enforce boundary constraints through technical means
- ✅ ESLint rules prohibit cross-layer calls
- ✅ Module encapsulation hides internal implementation
- ✅ Interface contracts define clear responsibility boundaries

**No Cross-Layer Access**: Prohibit direct cross-layer calls
- ❌ Controllers must not directly call OpenAI
- ❌ Services must not directly use `new Date()`
- ❌ Utils must not directly operate database

## 🎯 Scenario Layer Architecture (v9.0)

### Template-Based Multi-Scenario Business Platform
Transform from single course management system to universal multi-scenario platform

```
User Natural Language → Semantic Layer → Scenario Layer → EntityService → Unified Response
```

### Project Structure (Scenario-Based Architecture)
```
src/
├── controllers/lineController.js     # Request handling layer ✅
├── scenario/                         # 🆕 Scenario Layer core
│   ├── ScenarioTemplate.js          # Abstract base class - unified scenario interface
│   ├── ScenarioFactory.js           # Factory class - dynamic scenario loading
│   └── templates/                   # Scenario template implementations
│       ├── CourseManagementScenarioTemplate.js    # Course management
│       ├── HealthcareManagementScenarioTemplate.js # Healthcare system
│       └── InsuranceSalesScenarioTemplate.js      # Insurance business
├── services/
│   ├── semanticService.js           # Semantic processing unified entry ✅
│   ├── dataService.js               # Data processing unified entry ✅
│   ├── entityService.js             # 🆕 Universal entity CRUD service
│   └── taskService.js               # 🔄 Refactored to instance-based delegation pattern
├── utils/
│   ├── timeService.js               # Time processing unified entry ✅
│   ├── intentRuleEngine.js          # Rule engine implementation
│   ├── conversationContext.js       # Conversation context manager
│   └── [other utilities...]
├── config/
│   ├── intent-rules.yaml            # Intent rule configuration
│   └── scenarios/                   # 🆕 Scenario configuration files
│       ├── course_management.yaml   # Course management config
│       ├── healthcare_management.yaml # Healthcare system config
│       └── insurance_sales.yaml     # Insurance business config
└── internal/                        # Low-level implementation
    ├── openaiService.js             # OpenAI call implementation
    ├── firebaseService.js           # Firebase operation implementation
    └── lineService.js               # LINE API implementation
```

## 🚀 Independent WebService Deployment Mode

**Core Principle**: Each chatbot is a completely independent webservice containing only one business scenario

### Independent WebService Instances
```
Course Management Chatbot:
- Deploy URL: render.com/course-bot
- Environment: SCENARIO_TYPE=course_management  
- LINE Bot Setup: Connect to course management webhook
- Load Only: Course management config + templates + related dependencies
- Memory Usage: Minimized, contains only course logic

Healthcare System Chatbot:
- Deploy URL: render.com/healthcare-bot
- Environment: SCENARIO_TYPE=healthcare_management
- LINE Bot Setup: Connect to healthcare system webhook
- Load Only: Healthcare system config + templates + related dependencies
- Completely Independent: No sharing with course system

Insurance Business Chatbot:
- Deploy URL: render.com/insurance-bot
- Environment: SCENARIO_TYPE=insurance_sales
- LINE Bot Setup: Connect to insurance business webhook
- Load Only: Insurance business config + templates + related dependencies
- Independent Scaling: Can adjust resources independently based on business needs
```

## 🔧 Unified Service Layer Architecture

### Separation Architecture Constraints (Single Source of Truth)

| Domain | Unique Entry | Responsibility | Prohibited Actions |
|--------|-------------|----------------|-------------------|
| **Scenario Layer** | `ScenarioTemplate` | Business logic implementation | ❌ Direct DataService calls |
| **Semantic Processing** | `SemanticService` | Intent+Entity+Context | ❌ Direct OpenAI/Rule engine calls |
| **Entity Operations** | `EntityService` | Universal CRUD + Validation | ❌ Direct Firebase calls |
| **Time Processing** | `TimeService` | Parse+Format+Calculate+Validate | ❌ Direct `new Date()` usage |
| **Data Processing** | `DataService` | Store+Query+Format | ❌ Direct Firebase calls |
| **Task Execution** | `TaskService` | Scenario delegation coordination | ❌ Hardcoded business logic |

## 📊 Database Design (Firebase Firestore)

### courses Collection
```javascript
{
  student_id: "LINE User ID",
  course_name: "Course Name", 
  child_name: "Child Name", // 🎯 Multi-child support
  schedule_time: "Time Description",
  course_date: "2025-07-23",         // YYYY-MM-DD
  is_recurring: false,               // Recurring course flag
  recurrence_pattern: "weekly",      // daily/weekly
  location: "Location",
  teacher: "Teacher",
  status: "scheduled"                // scheduled/completed/cancelled
}
```

### token_usage Collection (Cost Control)
```javascript
{
  user_id: "LINE User ID",
  model: "gpt-3.5-turbo",
  total_tokens: 2280,
  total_cost_twd: 0.11,              // Cost in TWD
  user_message: "Original Message",
  timestamp: "ISO Timestamp"
}
```

For more detailed information, please refer to the respective documentation files.