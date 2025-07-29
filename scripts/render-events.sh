#!/bin/bash

# Render 事件查询脚本 - 获取服务部署和构建状态
# 使用方法: ./scripts/render-events.sh [limit] [filter]

# 从 .env 读取配置
if [ -f .env ]; then
    export $(cat .env | grep -v '^#' | xargs)
fi

API_KEY="${RENDER_API_TOKEN}"
SERVICE_ID="${RENDER_SERVICE_ID}"

# 参数处理
LIMIT=${1:-50}
FILTER=${2:-""}

# 检查必要变量
if [ -z "$API_KEY" ] || [ -z "$SERVICE_ID" ]; then
    echo "❌ 错误: 请在 .env 文件中设置 RENDER_API_TOKEN 和 RENDER_SERVICE_ID"
    exit 1
fi

echo "🔍 获取 Render 服务事件..."
echo "📊 Service: $SERVICE_ID"
echo "📋 限制条数: $LIMIT"

# 创建临时文件
TEMP_FILE=$(mktemp)

# 获取事件数据
curl -s -H "Authorization: Bearer $API_KEY" \
    "https://api.render.com/v1/services/$SERVICE_ID/events?limit=$LIMIT" \
    > "$TEMP_FILE"

# 检查是否获取成功
if [ ! -s "$TEMP_FILE" ]; then
    echo "⚠️  没有获取到事件数据，请检查 API Key 或 Service ID"
    rm "$TEMP_FILE"
    exit 1
fi

# 检查是否是错误响应
if grep -q "error\|unauthorized\|forbidden" "$TEMP_FILE"; then
    echo "❌ API 调用失败:"
    cat "$TEMP_FILE"
    rm "$TEMP_FILE"
    exit 1
fi

echo "✅ 成功获取事件数据"
echo "📋 最新服务事件:"
echo "=" $(printf '%.0s=' {1..50})

# 如果有过滤条件
if [ -n "$FILTER" ]; then
    echo "🔎 过滤关键词: $FILTER"
    # 使用 node 处理 JSON 并过滤
    node -e "
        const fs = require('fs');
        const data = JSON.parse(fs.readFileSync('$TEMP_FILE', 'utf8'));
        const filtered = data.filter(item => 
            JSON.stringify(item).toLowerCase().includes('$FILTER'.toLowerCase())
        );
        
        filtered.forEach(item => {
            const event = item.event;
            const timestamp = new Date(event.timestamp).toLocaleString('zh-CN');
            const type = event.type.replace(/_/g, ' ').toUpperCase();
            let details = '';
            
            if (event.details) {
                if (event.details.deployStatus) {
                    details = \`Deploy: \${event.details.deployStatus}\`;
                } else if (event.details.buildStatus) {
                    details = \`Build: \${event.details.buildStatus}\`;
                } else {
                    details = JSON.stringify(event.details);
                }
            }
            
            console.log(\`[\${timestamp}] 🔧 \${type}: \${details}\`);
        });
    "
else
    # 直接处理所有数据
    node -e "
        const fs = require('fs');
        const data = JSON.parse(fs.readFileSync('$TEMP_FILE', 'utf8'));
        
        data.forEach(item => {
            const event = item.event;
            const timestamp = new Date(event.timestamp).toLocaleString('zh-CN');
            const type = event.type.replace(/_/g, ' ').toUpperCase();
            let details = '';
            
            if (event.details) {
                if (event.details.deployStatus) {
                    details = \`Deploy: \${event.details.deployStatus}\`;
                } else if (event.details.buildStatus) {
                    details = \`Build: \${event.details.buildStatus}\`;
                } else {
                    details = JSON.stringify(event.details);
                }
            }
            
            console.log(\`[\${timestamp}] 🔧 \${type}: \${details}\`);
        });
    "
fi

# 清理临时文件
rm "$TEMP_FILE"

echo ""
echo "💡 提示: 这些是服务事件(部署/构建状态)，不是应用程序日志"
echo "📱 要查看应用程序日志，请访问: https://dashboard.render.com/web/$SERVICE_ID/logs"