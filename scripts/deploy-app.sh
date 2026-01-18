#!/bin/bash

# ==============================================================================
# Script: deploy-app.sh
# Description: Automatically deploys the built Wails app to /Applications on macOS.
# ==============================================================================

# 严格模式：遇到错误即退出，未定义变量报错
set -euo pipefail

# 颜色定义
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# 确保在 macOS 上运行
if [[ "$OSTYPE" != "darwin"* ]]; then
  echo -e "${YELLOW}⚠️  此脚本仅支持 macOS 系统。${NC}"
  exit 0
fi

# 获取脚本所在目录的绝对路径，并推导出项目根目录
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_ROOT="$( dirname "$SCRIPT_DIR" )"

# 配置信息
APP_NAME="Todo"
BUILD_PATH="${PROJECT_ROOT}/apps/wails/build/bin/${APP_NAME}.app"
DEST_PATH="/Applications/${APP_NAME}.app"

echo -e "${GREEN}🚀 开始部署 ${APP_NAME}.app 到 /Applications...${NC}"

# 检查构建产物是否存在
if [ ! -d "$BUILD_PATH" ]; then
  echo -e "${RED}❌ 错误: 未能在 ${BUILD_PATH} 找到构建产物。${NC}"
  echo "请确保已成功运行 'pnpm wails:build'。"
  exit 1
fi

echo -e "📦 找到构建产物: ${BUILD_PATH}"

# 检查并关闭正在运行的应用
"${SCRIPT_DIR}/close-app.sh"

# 如果目标位置已存在同名应用，先删除
if [ -d "$DEST_PATH" ]; then
  echo -e "🗑️  正在移除旧版本: ${DEST_PATH}"
  rm -rf "$DEST_PATH"
fi

# 复制应用到 /Applications
# 使用 -a 以保留元数据、软链接和权限
echo -e "🚚 正在复制到 /Applications..."
cp -a "$BUILD_PATH" "$DEST_PATH"

# 验证并启动
if [ -d "$DEST_PATH" ]; then
  echo -e "${GREEN}✅ 部署成功！${NC}"
  echo -e "🔄 正在启动新版本 ${APP_NAME}..."
  open "$DEST_PATH"
else
  echo -e "${RED}❌ 复制失败，请检查 /Applications 写入权限。${NC}"
  exit 1
fi
