#!/bin/bash

# ==============================================================================
# Script: refresh-tag.sh
# Description: Deletes and recreates a git tag locally and remotely to re-trigger CI.
# Usage: ./scripts/refresh-tag.sh v1.0.0-beta.1
# ==============================================================================

# 严格模式
set -euo pipefail

# 颜色定义
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# --- 1. 智能感知版本 ---
TAG_NAME=${1:-}

if [ -z "$TAG_NAME" ]; then
  if [ ! -f "./package.json" ]; then
    echo -e "${RED}❌ 错误: 当前目录下未找到 package.json，无法自动感知版本。${NC}"
    exit 1
  fi

  echo -e "${YELLOW}🔍 未指定标签，正在尝试从 package.json 感知版本...${NC}"
  # 使用 node 直接读取 version 字段，避免复杂的正则
  VERSION=$(node -p "require('./package.json').version" 2>/dev/null || echo "")
  
  if [ -z "$VERSION" ] || [ "$VERSION" == "undefined" ]; then
    echo -e "${RED}❌ 无法从 package.json 中解析到版本号，请手动指定标签名。${NC}"
    exit 1
  fi
  
  TAG_NAME="v$VERSION"
  echo -e "${GREEN}✨ 感知到当前项目版本为: ${TAG_NAME}${NC}"
fi

# --- 2. 环境预检 ---
# 2.1 检查未提交代码
if [ -n "$(git status --porcelain)" ]; then
  echo -e "${RED}⚠️  警告: 你当前有未提交的代码！${NC}"
  echo -e "${RED}请先执行 git add 和 git commit，确保所有更改都包含在版本标签中。${NC}"
  exit 1
fi

# 2.2 检查当前分支（建议在 main/master 或 release 分支操作）
CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
if [[ "$CURRENT_BRANCH" != "main" && "$CURRENT_BRANCH" != "master" && "$CURRENT_BRANCH" != "release"* ]]; then
  echo -e "${YELLOW}⚠️  提醒: 你当前正在 [${CURRENT_BRANCH}] 分支上操作。${NC}"
  echo -e "${YELLOW}通常发布版本应在 main 或 release 分支进行，请确认是否继续？ (y/n)${NC}"
  read -r -n 1 -s answer
  if [[ "$answer" != "y" ]]; then
    echo -e "\n${RED}操作已取消。${NC}"
    exit 1
  fi
  echo -e "\n  - 继续在当前分支操作..."
fi

echo -e "${YELLOW}🚀 开始处理标签: ${TAG_NAME}...${NC}"

# --- 3. 智能处理远程标签 ---
# 检查远程是否存在该标签
REMOTE_EXISTS=$(git ls-remote --tags origin "$TAG_NAME")
if [ -n "$REMOTE_EXISTS" ]; then
  echo -e "  - [感知] 远程已存在该标签，正在从 origin 删除..."
  git push origin --delete "$TAG_NAME"
else
  echo -e "  - [感知] 远程没有该标签，跳过删除步骤..."
fi

# --- 4. 智能处理本地标签 ---
if git rev-parse "$TAG_NAME" >/dev/null 2>&1; then
  echo -e "  - [感知] 本地已存在该标签，正在执行刷新操作..."
  git tag -d "$TAG_NAME"
else
  echo -e "  - [感知] 本地是一个新标签，准备创建..."
fi

# --- 5. 创建并发布 ---
echo -e "  - 正在最新提交处创建标签 ${TAG_NAME}..."
git tag -f "$TAG_NAME"

echo -e "  - 正在推送到远程并触发 GitHub Actions..."
git push origin "$TAG_NAME"

echo -e "\n${GREEN}✅ 处理完成！${NC}"
echo -e "${GREEN}🔗 请前往 GitHub 仓库的 Actions 页面查看打包进度。${NC}"
