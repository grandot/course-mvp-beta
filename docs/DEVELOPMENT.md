# Development Guide

## 🚀 Development Process

### MVP Stage Development Flow
```
Feature Development → Local Verification → Direct Deployment → Production Testing → User Feedback → Rapid Iteration
```

### Rapid Prototyping First Principle
**Goal: Quickly validate core functionality, prioritize user experience**

- ✅ **Focus on Core Features**: Course management, natural language processing, LINE Bot integration
- ✅ **Direct Deployment Verification**: Direct testing in Render production environment
- ❌ **Not Implemented Yet**: CI/CD pipeline, test environment, automated testing
- ❌ **Not Implemented Yet**: Unit tests, integration tests, end-to-end tests

## 🔧 Coding Standards

### Must Follow Rules
```javascript
// ✅ Correct: Process semantics through SemanticService
const result = await SemanticService.analyzeMessage(text, context);

// ❌ Wrong: Direct OpenAI calls
const result = await openaiService.analyze(text);

// ✅ Correct: Process time through TimeService
const currentTime = TimeService.getCurrentUserTime();

// ❌ Wrong: Direct Date usage
const currentTime = new Date();

// ✅ Correct: Process data through DataService
const courses = await DataService.queryCourses(criteria);

// ❌ Wrong: Direct Firebase calls
const courses = await firebaseService.collection('courses').get();
```

### Service Layer API Usage

#### SemanticService Usage
```javascript
// Analyze user message with context
const semanticResult = await SemanticService.analyzeMessage(
  userInput, 
  conversationContext
);

// Extract course entities
const entities = await SemanticService.extractCourseEntities(text);

// Extract child name (Multi-child feature)
const childInfo = SemanticService.extractChildName(text);
```

#### TimeService Usage
```javascript
// Get current user time
const now = TimeService.getCurrentUserTime();

// Parse time string
const timeInfo = TimeService.parseTimeString("明天下午2點", referenceTime);

// Format for display
const displayTime = TimeService.formatForDisplay(time, "MM/DD HH:MM A");

// Format for storage
const storageTime = TimeService.formatForStorage(date);
```

#### DataService Usage
```javascript
// Save course
const result = await DataService.saveCourse(courseData);

// Query courses
const courses = await DataService.queryCourses(criteria);

// Update course
const updated = await DataService.updateCourse(courseId, updateData);
```

## 🎯 Multi-Child Feature Implementation

### Child Name Extraction
```javascript
// Extract child name from user input
const childInfo = SemanticService.extractChildName("小明明天下午兩點鋼琴課");
// Returns: { name: "小明", remainingText: "明天下午兩點鋼琴課" }

// Use in course creation
const entities = {
  course_name: "鋼琴課",
  child_name: "小明",
  timeInfo: { ... }
};
```

### Display Format Standards
All course displays must consistently show child information:
```javascript
// Correct display format
if (course.child_name) {
  displayText += `👶 學童: ${course.child_name}\n`;
}
displayText += `📚 ${course.course_name}\n`;
displayText += `🕒 時間：${course.schedule_time}`;
```

## 🚨 Bug Investigation Process

When user reports a chatbot bug, immediately execute the following debugging steps:

### 1. Query Application Logs
```bash
# Basic query (latest 50 entries)
./scripts/get-app-logs.sh 50

# Search specific keywords
./scripts/get-app-logs.sh 30 "用戶輸入內容"

# Find error logs
./scripts/get-app-logs.sh 50 "ERROR"

# Find specific functionality
./scripts/get-app-logs.sh 30 "課表"
```

### 2. Render CLI Configuration Info
- **Installed**: `brew install render`
- **Logged in**: Workspace `tea-d1otdn7fte5s73bnf3k0`
- **Service ID**: `srv-d21f9u15pdvs73frvns0`
- **Config file**: `~/.render/cli.yaml`

### 3. Common Debugging Scenarios
```bash
# Semantic parsing issues
./scripts/get-app-logs.sh 50 "SemanticService"

# Time processing issues  
./scripts/get-app-logs.sh 30 "TimeService"

# Course operation issues
./scripts/get-app-logs.sh 40 "CourseManagement"

# API call issues
./scripts/get-app-logs.sh 50 "POST"
```

## 📝 Commit and Deployment Process

### Required Workflow
1. **Code Changes**: Must update `CHANGELOG.md` before committing
2. **Bug Reports**: Must first execute `./scripts/get-app-logs.sh 50`
3. **Architecture Compliance**: Strictly follow service boundaries
4. **No Cross-Layer**: Services cannot directly call internal implementations

### Git Commit Format
```bash
git commit -m "$(cat <<'EOF'
fix: Brief description of the fix

- Root cause: Detailed explanation
- Solution: What was changed
- Impact: What functionality is affected
- First principles: Why this approach was chosen

🤖 Generated with [Claude Code](https://claude.ai/code)

Co-Authored-By: Claude <noreply@anthropic.com>
EOF
)"
```

## 🧪 Testing Strategy (MVP Stage)

### Current Testing Approach
- **Manual Testing**: Primary validation method
- **Production Environment Testing**: Direct deployment for real-world validation
- **User Feedback Loop**: Rapid iteration based on actual usage

### Quality Assurance
- **Code Review**: Manual review of architecture compliance
- **ESLint Rules**: Automated enforcement of cross-layer constraints
- **Architecture Constraints**: Technical barriers to prevent violations

## 🔄 Development Commands

```bash
npm install          # Install dependencies
npm run dev         # Development mode (hot reload)
npm start           # Production deployment
npm test            # Run tests
npm run logs        # Get Render logs

# Debugging
./scripts/get-app-logs.sh 50              # Get latest 50 logs
./scripts/get-app-logs.sh 30 "keyword"    # Search logs with keyword
```

## 🎯 Code Writing Guidelines

### Prohibited Exaggerated Adjectives
- "革命性升級" → "架構重構" (Revolutionary upgrade → Architecture refactor)
- "大幅提升" → "性能優化" (Massive improvement → Performance optimization)
- "顯著改善" → "功能改進" (Significant enhancement → Feature improvement)
- "巨大突破" → "重要更新" (Huge breakthrough → Important update)

### Recommended Technical Descriptions
- Use specific technical terms
- Describe actual improvement effects
- Avoid subjective evaluation words
- Maintain objectivity and professionalism

### Writing Principles
1. **Objectivity**: Describe facts rather than subjective evaluations
2. **Specificity**: Use specific technical metrics
3. **Conciseness**: Avoid lengthy and exaggerated expressions
4. **Professionalism**: Use standard technical terminology