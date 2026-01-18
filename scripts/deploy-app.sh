#!/bin/bash

# ==============================================================================
# Script: deploy-app.sh
# Description: Automatically deploys the built Wails app to /Applications on macOS.
# ==============================================================================

# 确保在 macOS 上运行
if [[ "$OSTYPE" != "darwin"* ]]; then
  echo "⚠️  此脚本仅支持 macOS 系统。"
  exit 0
fi

# 获取脚本所在目录的绝对路径，并推导出项目根目录
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_ROOT="$( dirname "$SCRIPT_DIR" )"

# 配置信息
APP_NAME="Todo"
BUILD_PATH="${PROJECT_ROOT}/apps/wails/build/bin/${APP_NAME}.app"
DEST_PATH="/Applications/${APP_NAME}.app"

echo "🚀 开始部署 ${APP_NAME}.app 到 /Applications..."

# 检查构建产物是否存在
if [ -d "$BUILD_PATH" ]; then
  echo "📦 找到构建产物: ${BUILD_PATH}"
  
  # 如果目标位置已存在同名应用，先删除
  if [ -d "$DEST_PATH" ]; then
    echo "🗑️  正在移除旧版本: ${DEST_PATH}"
    rm -rf "$DEST_PATH"
  fi
  
  # 复制应用到 /Applications
  echo "🚚 正在复制到 /Applications..."
  cp -R "$BUILD_PATH" "$DEST_PATH"
  
  # 验证是否成功
  if [ -d "$DEST_PATH" ]; then
    echo "✅ 部署成功！你现在可以在「应用程序」中找到 ${APP_NAME} 了。"
  else
    echo "❌ 复制失败，请检查权限。"
    exit 1
  fi
else
  echo "❌ 错误: 未能在 ${BUILD_PATH} 找到构建产物。"
  echo "请确保已成功运行 'pnpm wails:build'。"
  exit 1
fi
