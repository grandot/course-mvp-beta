#!/bin/bash

# Render 应用程序日志获取脚本
# 使用方法: ./scripts/get-app-logs.sh [limit] [filter]

SERVICE_ID="srv-d21f9u15pdvs73frvns0"
LIMIT=${1:-50}
FILTER=${2:-""}

echo "🔍 获取 Render 应用程序日志..."
echo "📊 Service: $SERVICE_ID"
echo "📋 限制条数: $LIMIT"

# 检查 Render CLI 是否可用
if ! command -v render &> /dev/null; then
    echo "❌ Render CLI 未安装，请运行: brew install render"
    exit 1
fi

# 检查是否已登录
if ! render whoami -o text &> /dev/null; then
    echo "❌ Render CLI 未登录，请运行: render login"
    exit 1
fi

echo "🚀 正在获取日志..."

# 如果有过滤条件
if [ -n "$FILTER" ]; then
    echo "🔎 过滤关键词: $FILTER"
    render logs -r "$SERVICE_ID" --limit "$LIMIT" --text "$FILTER" -o text
else
    render logs -r "$SERVICE_ID" --limit "$LIMIT" -o text
fi

echo ""
echo "💡 实用命令:"
echo "   ./scripts/get-app-logs.sh 100              # 获取最近100条日志"
echo "   ./scripts/get-app-logs.sh 50 \"ERROR\"       # 搜索错误日志"
echo "   ./scripts/get-app-logs.sh 30 \"課表\"        # 搜索课表相关日志"
echo "   ./scripts/get-app-logs.sh 20 \"POST\"        # 搜索POST请求"