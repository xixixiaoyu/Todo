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

# 检查参数
if [ -z "${1:-}" ]; then
  echo -e "${RED}❌ 错误: 请提供标签名称 (例如: v1.0.0-beta.1)${NC}"
  echo "用法: pnpm tag:refresh <tag_name>"
  exit 1
fi

TAG_NAME=$1

echo -e "${YELLOW}🔄 正在重新同步标签: ${TAG_NAME}...${NC}"

# 1. 删除本地标签 (如果存在)
if git rev-parse "$TAG_NAME" >/dev/null 2>&1; then
  echo -e "  - 正在删除本地标签..."
  git tag -d "$TAG_NAME"
fi

# 2. 删除远程标签 (如果存在)
echo -e "  - 正在尝试删除远程标签 (origin)..."
# 使用 || true 因为如果远程没这个标签会报错，我们忽略它
git push origin :refs/tags/"$TAG_NAME" || echo -e "${YELLOW}    提示: 远程标签可能不存在，继续下一步...${NC}"

# 3. 在当前 HEAD 重新创建标签
echo -e "  - 在最新提交处重新创建标签..."
git tag "$TAG_NAME"

# 4. 推送到远程
echo -e "  - 正在推送到远程并触发 GitHub Actions..."
git push origin "$TAG_NAME"

echo -e "${GREEN}✅ 成功！标签 ${TAG_NAME} 已刷新，GitHub Actions 应该已经重新开始打包。${NC}"
