# Deployment and Operations Guide

## 🚀 Deployment Environment

### Primary Deployment Platforms
- **Render** (Primary): Auto-deployment with environment variable support
- **Vercel** (Alternative): Serverless deployment
- **Heroku** (Support): Traditional PaaS deployment

### Current Deployment Information
- **Platform**: Render.com
- **Deployment Method**: Git auto-deployment
- **Service ID**: `srv-d21f9u15pdvs73frvns0`
- **Workspace**: `tea-d1otdn7fte5s73bnf3k0`

## ⚙️ Environment Variable Configuration

### Required Environment Variables
```env
# OpenAI Configuration
OPENAI_API_KEY=your_openai_api_key

# Firebase Configuration  
FIREBASE_PROJECT_ID=your_firebase_project_id
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
FIREBASE_CLIENT_EMAIL=your_service_account_email

# LINE Bot Configuration
LINE_CHANNEL_ACCESS_TOKEN=your_line_channel_access_token
LINE_CHANNEL_SECRET=your_line_channel_secret

# Scenario Configuration
SCENARIO_TYPE=course_management

# Admin Configuration
ADMIN_KEY=course-admin-2024
BASIC_AUTH_USER=grandot
BASIC_AUTH_PASS=your_admin_password
```

### Environment Variable Setup Notes
- **Firebase Private Key**: Must include proper newline characters (`\n`)
- **LINE Tokens**: Obtain from LINE Developers Console
- **OpenAI API Key**: Ensure sufficient credits for production use
- **Scenario Type**: Determines which business scenario to load

## 🔧 Render Platform Configuration

### Deployment Settings
```yaml
# render.yaml (if using)
services:
  - type: web
    name: course-mvp-beta
    env: node
    buildCommand: npm install
    startCommand: npm start
    envVars:
      - key: NODE_ENV
        value: production
      - key: SCENARIO_TYPE
        value: course_management
```

### Build Configuration
- **Build Command**: `npm install`
- **Start Command**: `npm start`
- **Node Version**: 18.x or later
- **Auto-Deploy**: Enabled from main branch

## 📊 Monitoring and Logging

### Application Log Access

#### Using Render CLI
```bash
# Install Render CLI
brew install render

# Login to workspace
render auth login

# Get application logs
render logs --service srv-d21f9u15pdvs73frvns0 --tail

# Get logs with filters
render logs --service srv-d21f9u15pdvs73frvns0 --since 1h
```

#### Using Project Scripts
```bash
# Get latest 50 log entries
./scripts/get-app-logs.sh 50

# Search logs with keywords
./scripts/get-app-logs.sh 30 "ERROR"
./scripts/get-app-logs.sh 30 "課表"
./scripts/get-app-logs.sh 50 "SemanticService"

# Get service events
./scripts/render-events.sh
```

### Log Types and Patterns
```bash
# Debug logs
🔧 [DEBUG] SemanticService - 規則引擎結果: { intent: 'record_course', confidence: 0.8 }

# Info logs  
✅ [EntityService] query courses: Found 1 records

# Error logs
❌ [ERROR] Failed to process user message: OpenAI API error

# Course management logs
[course_management] Creating course entity {"userId":"...", "entities":{...}}
```

## 🚨 Troubleshooting

### Common Issues

#### 1. OpenAI API Errors
```bash
# Check API Key validity
curl -H "Authorization: Bearer $OPENAI_API_KEY" \
     https://api.openai.com/v1/models

# Check usage and limits
curl -H "Authorization: Bearer $OPENAI_API_KEY" \
     https://api.openai.com/v1/usage
```

#### 2. Firebase Connection Issues
```bash
# Verify Firebase configuration
echo $FIREBASE_PROJECT_ID
echo $FIREBASE_CLIENT_EMAIL

# Check private key format
echo "$FIREBASE_PRIVATE_KEY" | head -1
# Should show: -----BEGIN PRIVATE KEY-----
```

#### 3. LINE API Issues  
```bash
# Verify LINE Bot configuration
curl -H "Authorization: Bearer $LINE_CHANNEL_ACCESS_TOKEN" \
     https://api.line.me/v2/bot/info

# Check webhook settings in LINE Developers Console
# Webhook URL should be: https://your-render-url.onrender.com/webhook
```

#### 4. Scenario Loading Issues
```bash
# Check scenario type environment variable
echo $SCENARIO_TYPE

# Verify scenario configuration exists
ls config/scenarios/${SCENARIO_TYPE}.yaml

# Check scenario initialization logs
./scripts/get-app-logs.sh 20 "ScenarioManager"
```

### Performance Monitoring

#### Response Time Tracking
```bash
# Monitor semantic processing performance
./scripts/get-app-logs.sh 50 "語義分析完成"

# Track OpenAI API call times
./scripts/get-app-logs.sh 30 "OpenAI"

# Monitor database operations
./scripts/get-app-logs.sh 30 "EntityService"
```

#### Cost Monitoring
```bash
# Check token usage
./scripts/get-app-logs.sh 50 "token_usage"

# Monitor API costs
./scripts/get-app-logs.sh 30 "total_cost_twd"
```

## 🔄 Deployment Process

### Manual Deployment
```bash
# 1. Update changelog first
vim CHANGELOG.md

# 2. Commit changes
git add -A
git commit -m "fix: description of changes"

# 3. Push to trigger auto-deployment
git push

# 4. Monitor deployment
render logs --service srv-d21f9u15pdvs73frvns0 --tail
```

### Automated Deployment (Git-based)
1. **Trigger**: Push to main branch
2. **Build**: Automatic npm install
3. **Deploy**: Zero-downtime deployment
4. **Health Check**: Automatic service verification

### Rollback Procedure
```bash
# View recent deployments
render deployments --service srv-d21f9u15pdvs73frvns0

# Rollback to previous version
render rollback --service srv-d21f9u15pdvs73frvns0 --deployment DEPLOYMENT_ID
```

## 📈 Health Checks

### Service Health Endpoints
```bash
# Check service status
curl https://your-render-url.onrender.com/health

# Verify LINE webhook
curl -X POST https://your-render-url.onrender.com/webhook \
     -H "Content-Type: application/json" \
     -d '{"events":[]}'
```

### Database Connectivity
```bash
# Check Firebase connection
./scripts/get-app-logs.sh 10 "Firebase"

# Verify entity service operations
./scripts/get-app-logs.sh 10 "EntityService"
```

## 🔐 Security Considerations

### Environment Variable Security
- Never commit `.env` files to git
- Use Render's environment variable management
- Rotate API keys regularly
- Monitor API usage for unusual patterns

### Access Control
- Admin endpoints protected with basic auth
- LINE webhook signature verification enabled
- Firebase security rules properly configured
- Regular security audits of dependencies

## 📋 Maintenance Tasks

### Regular Maintenance
```bash
# Update dependencies monthly
npm update

# Check for security vulnerabilities
npm audit

# Clean up old logs (if needed)
./scripts/cleanup-logs.sh

# Monitor token usage and costs
./scripts/check-usage-costs.sh
```

### Emergency Procedures
1. **Service Down**: Check Render status dashboard
2. **High Error Rate**: Review logs immediately
3. **Cost Spike**: Check OpenAI usage patterns
4. **Performance Issues**: Monitor resource usage