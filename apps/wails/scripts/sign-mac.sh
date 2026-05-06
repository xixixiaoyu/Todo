#!/usr/bin/env bash
# ==============================================================================
# sign-mac.sh — macOS .app 代码签名脚本
#
# 支持两种模式：
#   1. 本地开发：ad-hoc 签名（codesign --sign -），让 Gatekeeper 放行
#   2. CI 分发：Apple Developer ID 签名 + 公证（需设置环境变量）
#
# 用法：
#   ./scripts/sign-mac.sh                    # ad-hoc 签名
#   APPLE_ID=... APPLE_TEAM_ID=... ./scripts/sign-mac.sh  # Developer ID 签名 + 公证
# ==============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
BUILD_DIR="${PROJECT_DIR}/build/bin"
ENTITLEMENTS="${PROJECT_DIR}/build/darwin/entitlements.plist"

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# ---- 查找 .app ----
APP_PATH="${APP_PATH:-}"
if [ -z "$APP_PATH" ]; then
  APP_PATH="$(find "$BUILD_DIR" -maxdepth 2 -name '*.app' -type d | head -1)"
fi

if [ -z "$APP_PATH" ] || [ ! -d "$APP_PATH" ]; then
  echo -e "${RED}Error: .app bundle not found in ${BUILD_DIR}${NC}"
  echo "Run 'wails build' first, or set APP_PATH environment variable."
  exit 1
fi

APP_NAME="$(basename "$APP_PATH" .app)"
echo -e "${GREEN}Signing: ${APP_PATH}${NC}"

# ---- 确定签名身份 ----
if [ -n "${APPLE_ID:-}" ] && [ -n "${APPLE_TEAM_ID:-}" ]; then
  SIGN_IDENTITY="Developer ID Application: ${APPLE_TEAM_ID}"
  DO_NOTARIZE=true
  echo -e "${YELLOW}Using Developer ID: ${SIGN_IDENTITY}${NC}"
else
  SIGN_IDENTITY="-"
  DO_NOTARIZE=false
  echo -e "${YELLOW}Using ad-hoc signing (development only)${NC}"
fi

sign() {
  local target="$1"
  local opts="${2:-}"
  echo "  Signing: ${target}"
  if [ "$SIGN_IDENTITY" = "-" ]; then
    codesign --sign - --force $opts "$target"
  else
    codesign --sign "$SIGN_IDENTITY" --force --options runtime --timestamp $opts "$target"
  fi
}

# ---- 1. 签 Sidecar Node 运行时 ----
SIDECAR_DIR="${APP_PATH}/Contents/Resources/sidecar"
if [ -d "$SIDECAR_DIR" ]; then
  echo "Signing Sidecar binaries..."

  # Node binary
  NODE_BIN="${SIDECAR_DIR}/node/bin/node"
  if [ -f "$NODE_BIN" ]; then
    sign "$NODE_BIN"
  fi

  # .node native addons（递归）
  find "$SIDECAR_DIR" -name '*.node' -type f 2>/dev/null | while read -r addon; do
    sign "$addon"
  done

  # .dylib 文件
  find "$SIDECAR_DIR" -name '*.dylib' -type f 2>/dev/null | while read -r dylib; do
    sign "$dylib"
  done
fi

# ---- 2. 签 .app 内部 Framework ----
FRAMEWORKS_DIR="${APP_PATH}/Contents/Frameworks"
if [ -d "$FRAMEWORKS_DIR" ]; then
  echo "Signing embedded frameworks..."
  for fw in "$FRAMEWORKS_DIR"/*.framework; do
    if [ -d "$fw" ]; then
      sign "$fw" "--deep"
    fi
  done
  for helper in "$FRAMEWORKS_DIR"/*.app; do
    if [ -d "$helper" ]; then
      sign "$helper" "--entitlements ${ENTITLEMENTS}"
    fi
  done
fi

# ---- 3. 签主 .app ----
echo "Signing main bundle..."
sign "$APP_PATH" "--entitlements ${ENTITLEMENTS} --deep"

# ---- 4. 验证签名 ----
echo -e "${GREEN}Verifying signature...${NC}"
codesign --verify --deep --strict --verbose=2 "$APP_PATH" 2>&1 || {
  echo -e "${YELLOW}Warning: Signature verification failed.${NC}"
  echo "For ad-hoc signing this is expected for some components."
}

# ---- 5. 公证（仅 Developer ID 签名时） ----
if [ "$DO_NOTARIZE" = true ] && [ -n "${APPLE_ID_PASSWORD:-}" ]; then
  echo -e "${YELLOW}Submitting for notarization...${NC}"

  # 创建 zip 用于公证提交
  ZIP_PATH="${BUILD_DIR}/${APP_NAME}.zip"
  ditto -c -k --keepParent "$APP_PATH" "$ZIP_PATH"

  NOTARIZE_OUTPUT=$(xcrun notarytool submit "$ZIP_PATH" \
    --apple-id "$APPLE_ID" \
    --password "$APPLE_ID_PASSWORD" \
    --team-id "$APPLE_TEAM_ID" \
    --wait 2>&1)

  echo "$NOTARIZE_OUTPUT"

  if echo "$NOTARIZE_OUTPUT" | grep -q "status: Accepted"; then
    echo -e "${GREEN}Notarization accepted. Stapling ticket...${NC}"
    xcrun stapler staple "$APP_PATH"
    echo -e "${GREEN}Notarization complete.${NC}"
  else
    echo -e "${RED}Notarization failed. Check output above.${NC}"
    echo "Submission ID can be used to check logs:"
    echo "  xcrun notarytool log <submission-id> --apple-id $APPLE_ID --password ... --team-id $APPLE_TEAM_ID"
  fi

  rm -f "$ZIP_PATH"
elif [ "$DO_NOTARIZE" = true ]; then
  echo -e "${YELLOW}APPLE_ID_PASSWORD not set. Skipping notarization.${NC}"
fi

echo -e "${GREEN}Done: ${APP_PATH}${NC}"
