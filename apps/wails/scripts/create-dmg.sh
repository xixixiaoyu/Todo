#!/usr/bin/env bash
# ==============================================================================
# create-dmg.sh — 为 macOS .app 创建 DMG 安装镜像
#
# 要求：
#   - create-dmg (brew install create-dmg)
#   - 已构建的 .app（wails build）
#   - 已签名（可选，sign-mac.sh 在之前运行）
#
# 用法：
#   ./scripts/create-dmg.sh                     # 创建 DMG
#   ./scripts/create-dmg.sh --skip-sign          # 跳过签名步骤
#   VERSION=1.0.0 ./scripts/create-dmg.sh        # 指定版本号
# ==============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
BUILD_DIR="${PROJECT_DIR}/build/bin"

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# ---- 参数解析 ----
SKIP_SIGN=false
while [[ $# -gt 0 ]]; do
  case "$1" in
    --skip-sign) SKIP_SIGN=true; shift ;;
    *) shift ;;
  esac
done

# ---- 查找 .app ----
APP_PATH="$(find "$BUILD_DIR" -maxdepth 2 -name '*.app' -type d | head -1)"
if [ -z "$APP_PATH" ] || [ ! -d "$APP_PATH" ]; then
  echo -e "${RED}Error: .app bundle not found in ${BUILD_DIR}${NC}"
  echo "Run 'wails build' first."
  exit 1
fi

APP_NAME="$(basename "$APP_PATH" .app)"
VERSION="${VERSION:-$(plutil -extract CFBundleShortVersionString raw "$APP_PATH/Contents/Info.plist" 2>/dev/null || echo '1.0.0')}"
DMG_NAME="${APP_NAME}-${VERSION}-macOS-$(uname -m)"
DMG_PATH="${BUILD_DIR}/${DMG_NAME}.dmg"

echo -e "${GREEN}Creating DMG for ${APP_NAME} v${VERSION}${NC}"

# ---- 签名（如果跳过） ----
if [ "$SKIP_SIGN" = false ] && [ -x "${SCRIPT_DIR}/sign-mac.sh" ]; then
  echo -e "${YELLOW}Step 1/3: Code signing...${NC}"
  APP_PATH="$APP_PATH" bash "${SCRIPT_DIR}/sign-mac.sh"
else
  echo -e "${YELLOW}Step 1/3: Skipping code signing${NC}"
fi

# ---- 清理旧 DMG ----
rm -f "$DMG_PATH"

# ---- 检查 create-dmg ----
if command -v create-dmg &>/dev/null; then
  echo -e "${YELLOW}Step 2/3: Creating DMG with create-dmg...${NC}"

  create-dmg \
    --volname "$APP_NAME" \
    --volicon "${PROJECT_DIR}/build/appicon.png" \
    --window-pos 200 120 \
    --window-size 600 400 \
    --icon-size 100 \
    --icon "$APP_NAME.app" 160 190 \
    --hide-extension "$APP_NAME.app" \
    --app-drop-link 420 190 \
    "$DMG_PATH" \
    "$BUILD_DIR"

  echo -e "${GREEN}DMG created: ${DMG_PATH}${NC}"

elif command -v hdiutil &>/dev/null; then
  echo -e "${YELLOW}Step 2/3: Creating DMG with hdiutil (basic)...${NC}"

  TMP_DMG="${BUILD_DIR}/tmp_${APP_NAME}.dmg"
  DMG_ROOT="${BUILD_DIR}/dmg_root"

  # 准备 DMG 内容目录
  rm -rf "$DMG_ROOT"
  mkdir -p "$DMG_ROOT"
  cp -R "$APP_PATH" "$DMG_ROOT/"
  # 创建 /Applications 快捷方式
  ln -s /Applications "$DMG_ROOT/Applications"

  # 创建 DMG
  hdiutil create -volname "$APP_NAME" -srcfolder "$DMG_ROOT" -ov -format UDZO "$TMP_DMG"
  hdiutil convert "$TMP_DMG" -format UDZO -o "$DMG_PATH"

  rm -f "$TMP_DMG"
  rm -rf "$DMG_ROOT"

  echo -e "${GREEN}DMG created: ${DMG_PATH}${NC}"
else
  echo -e "${RED}Error: Neither create-dmg nor hdiutil found.${NC}"
  exit 1
fi

# ---- 签名 DMG（如适用） ----
if [ -n "${APPLE_ID:-}" ] && [ -n "${APPLE_TEAM_ID:-}" ]; then
  echo -e "${YELLOW}Step 3/3: Signing DMG...${NC}"
  codesign --sign "Developer ID Application: ${APPLE_TEAM_ID}" --timestamp "$DMG_PATH"
  echo -e "${GREEN}DMG signed.${NC}"
else
  echo -e "${YELLOW}Step 3/3: Skipping DMG signing (no Developer ID)${NC}"
fi

echo ""
echo -e "${GREEN}=== DMG ready: ${DMG_PATH} ===${NC}"
echo -e "Size: $(du -h "$DMG_PATH" | cut -f1)"
