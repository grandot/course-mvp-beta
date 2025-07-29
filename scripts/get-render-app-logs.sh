#!/bin/bash

# Render CLI 应用程序日志获取脚本
# 使用方法: ./scripts/get-render-app-logs.sh [limit] [filter]

SERVICE_ID="${RENDER_SERVICE_ID}"
LIMIT=${1:-50}
FILTER=${2:-""}

echo "🔍 使用 Render CLI 获取应用程序日志..."
echo "📊 Service: $SERVICE_ID"
echo "📋 限制条数: $LIMIT"

# 检查 Render CLI 是否已登录
if ! render whoami > /dev/null 2>&1; then
    echo "❌ Render CLI 未登录，请先运行: render login"
    exit 1
fi

# 尝试直接获取日志（非交互模式）
echo "🚀 正在获取日志..."

# 如果有过滤条件
if [ -n "$FILTER" ]; then
    echo "🔎 过滤关键词: $FILTER"
    render logs -r "$SERVICE_ID" --limit "$LIMIT" --text "$FILTER" -o text 2>/dev/null || {
        echo "⚠️  非交互模式失败，尝试其他方式..."
        # 尝试不同的输出格式
        render logs -r "$SERVICE_ID" --limit "$LIMIT" --text "$FILTER" -o json 2>/dev/null | jq -r '.[] | "\(.timestamp) [\(.level)] \(.message)"' 2>/dev/null || {
            echo "❌ 无法获取过滤后的日志"
            echo "💡 建议直接使用: render logs （交互模式）"
        }
    }
else
    render logs -r "$SERVICE_ID" --limit "$LIMIT" -o text 2>/dev/null || {
        echo "⚠️  非交互模式失败，尝试 JSON 格式..."
        render logs -r "$SERVICE_ID" --limit "$LIMIT" -o json 2>/dev/null | jq -r '.[] | "\(.timestamp) [\(.level)] \(.message)"' 2>/dev/null || {
            echo "❌ 无法获取日志"
            echo "💡 建议手动运行: render logs （会打开交互界面）"
            echo "💡 或直接在浏览器查看: https://dashboard.render.com/web/$SERVICE_ID/logs"
        }
    }
fi

echo ""
echo "💡 提示:"
echo "   - 这些是真正的应用程序日志（console.log、错误等）"
echo "   - 如果脚本失败，请直接运行: render logs"
echo "   - 交互模式下可以实时查看和过滤日志"