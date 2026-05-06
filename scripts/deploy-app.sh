#!/bin/bash

# ==============================================================================
# Script: deploy-app.sh
# Description: 自动部署 Wails .app 到 /Applications，包含 ad-hoc 签名。
#
# 在部署前对 .app 进行 ad-hoc 代码签名，确保 Gatekeeper 不会阻止启动。
# 如需正式分发，请使用 Developer ID 证书签名并通过公证流程。
# ==============================================================================

set -euo pipefail

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

if [[ "$OSTYPE" != "darwin"* ]]; then
  echo -e "${YELLOW}此脚本仅支持 macOS 系统。${NC}"
  exit 0
fi

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_ROOT="$( dirname "$SCRIPT_DIR" )"

APP_NAME="Lumina"
BUILD_PATH="${PROJECT_ROOT}/apps/wails/build/bin/${APP_NAME}.app"
DEST_PATH="/Applications/${APP_NAME}.app"
ENTITLEMENTS="${PROJECT_ROOT}/apps/wails/build/darwin/entitlements.plist"

echo -e "${GREEN}Deploying ${APP_NAME}.app to /Applications...${NC}"

if [ ! -d "$BUILD_PATH" ]; then
  echo -e "${RED}Error: Build output not found at ${BUILD_PATH}${NC}"
  echo "Run 'pnpm wails:build' first."
  exit 1
fi

echo -e "Build found: ${BUILD_PATH}"

# ---- Ad-hoc 代码签名（消除 Gatekeeper 警告） ----
echo -e "${YELLOW}Ad-hoc code signing...${NC}"

SIDECAR_DIR="${BUILD_PATH}/Contents/Resources/sidecar"

# 签 Node 运行时和 native addons
# 注意：ad-hoc 签名不用 --options runtime（那是 Developer ID 证书专用的）
if [ -d "$SIDECAR_DIR" ]; then
  NODE_BIN="${SIDECAR_DIR}/node/bin/node"
  if [ -f "$NODE_BIN" ]; then
    codesign --sign - --force "$NODE_BIN" 2>/dev/null || true
  fi
  find "$SIDECAR_DIR" \( -name '*.node' -o -name '*.dylib' \) -type f 2>/dev/null | while read -r f; do
    codesign --sign - --force "$f" 2>/dev/null || true
  done
fi

# 签主 .app
if [ -f "$ENTITLEMENTS" ]; then
  codesign --sign - --force --deep \
    --entitlements "$ENTITLEMENTS" "$BUILD_PATH" 2>/dev/null || true
else
  codesign --sign - --force --deep "$BUILD_PATH" 2>/dev/null || true
fi

echo -e "${GREEN}Code signing complete.${NC}"

# ---- 关闭正在运行的应用 ----
"${SCRIPT_DIR}/close-app.sh"

# ---- 安装 ----
if [ -d "$DEST_PATH" ]; then
  echo -e "Removing old version: ${DEST_PATH}"
  rm -rf "$DEST_PATH"
fi

echo -e "Copying to /Applications..."
cp -a "$BUILD_PATH" "$DEST_PATH"

# ---- 去掉隔离标记（防止 Gatekeeper 弹窗） ----
# ad-hoc 签名的应用在从 Finder 复制后仍可能被标记为隔离，
# 用 xattr 清除 com.apple.quarantine 属性。
xattr -d com.apple.quarantine "$DEST_PATH" 2>/dev/null || true

# ---- 验证并启动 ----
if [ -d "$DEST_PATH" ]; then
  echo -e "${GREEN}Deploy successful!${NC}"
  echo -e "Starting ${APP_NAME}..."
  open "$DEST_PATH"
else
  echo -e "${RED}Copy failed. Check /Applications write permissions.${NC}"
  exit 1
fi
