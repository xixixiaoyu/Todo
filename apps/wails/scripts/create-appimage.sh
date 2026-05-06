#!/usr/bin/env bash
# ==============================================================================
# create-appimage.sh — 为 Linux 构建 AppImage 通用安装包
#
# 要求：
#   - wails build 已完成（build/bin/Lumina）
#   - sidecar 已组装
#   - appimagetool 在 PATH 中，或通过环境变量 APPIMAGETOOL 指定
#
# 用法：
#   ./scripts/create-appimage.sh
#   APPIMAGETOOL=/path/to/appimagetool ./scripts/create-appimage.sh
# ==============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
BUILD_DIR="${PROJECT_DIR}/build/bin"
LINUX_DIR="${PROJECT_DIR}/build/linux"
VERSION="${VERSION:-$(grep -o '"productVersion": "[^"]*"' "${PROJECT_DIR}/wails.json" | head -1 | cut -d'"' -f4)}"
VERSION="${VERSION:-1.0.0}"

APP_NAME="Lumina"
APPDIR="${BUILD_DIR}/AppDir"
APPIMAGE="${BUILD_DIR}/${APP_NAME}-${VERSION}-$(uname -m).AppImage"

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# ---- 检查二进制 ----
BINARY="${BUILD_DIR}/${APP_NAME}"
if [ ! -f "$BINARY" ]; then
  echo -e "${RED}Error: ${APP_NAME} binary not found at ${BINARY}${NC}"
  echo "Run 'wails build' first."
  exit 1
fi

echo -e "${GREEN}Building AppImage for ${APP_NAME} v${VERSION}${NC}"

# ---- 清理旧的 AppDir ----
rm -rf "$APPDIR"

# ---- 构建 AppDir 目录结构 ----
echo "Creating AppDir structure..."

# usr/bin
mkdir -p "${APPDIR}/usr/bin"
cp "$BINARY" "${APPDIR}/usr/bin/${APP_NAME}"
chmod +x "${APPDIR}/usr/bin/${APP_NAME}"

# Sidecar（放在 AppDir 根，和二进制同目录层级）
SIDECAR_SRC="${BUILD_DIR}/sidecar"
if [ -d "$SIDECAR_SRC" ]; then
  echo "  Bundling sidecar..."
  cp -r "$SIDECAR_SRC" "${APPDIR}/sidecar"
fi

# AppRun 入口脚本
cat > "${APPDIR}/AppRun" << 'APPRUNEOF'
#!/usr/bin/env bash
SELF="$(dirname "$(readlink -f "$0")")"
export SIDECAR_DIR="${SELF}/sidecar"
exec "${SELF}/usr/bin/Lumina" "$@"
APPRUNEOF
chmod +x "${APPDIR}/AppRun"

# Desktop 文件
cp "${LINUX_DIR}/lumina.desktop" "${APPDIR}/"
cp "${LINUX_DIR}/lumina.desktop" "${APPDIR}/${APP_NAME}.desktop"

# 图标
ICON_SRC=""
for candidate in \
  "${PROJECT_DIR}/build/appicon.png" \
  "${PROJECT_DIR}/frontend/dist/logo.png" \
  "${PROJECT_DIR}/frontend/dist/pwa-512x512.png"; do
  if [ -f "$candidate" ]; then
    ICON_SRC="$candidate"
    break
  fi
done

if [ -n "$ICON_SRC" ]; then
  cp "$ICON_SRC" "${APPDIR}/lumina.png"
  cp "$ICON_SRC" "${APPDIR}/.DirIcon"
else
  echo -e "${YELLOW}Warning: No icon found. AppImage will have default icon.${NC}"
fi

# ---- 查找 appimagetool ----
APPIMAGETOOL="${APPIMAGETOOL:-}"
if [ -z "$APPIMAGETOOL" ]; then
  APPIMAGETOOL="$(command -v appimagetool 2>/dev/null || echo '')"
fi

if [ -z "$APPIMAGETOOL" ]; then
  # 尝试下载 appimagetool
  ARCH="$(uname -m)"
  APPIMAGETOOL_URL="https://github.com/AppImage/AppImageKit/releases/download/continuous/appimagetool-${ARCH}.AppImage"

  echo -e "${YELLOW}appimagetool not found, downloading...${NC}"
  TMP_APPIMAGETOOL="${BUILD_DIR}/appimagetool"
  curl -fSL -o "$TMP_APPIMAGETOOL" "$APPIMAGETOOL_URL" 2>/dev/null || {
    echo -e "${RED}Error: Cannot download appimagetool.${NC}"
    echo "Install it manually: https://github.com/AppImage/AppImageKit/releases"
    echo "Or set APPIMAGETOOL=/path/to/appimagetool"
    exit 1
  }
  chmod +x "$TMP_APPIMAGETOOL"
  APPIMAGETOOL="$TMP_APPIMAGETOOL"
fi

# ---- 构建 AppImage ----
echo "Building AppImage..."
rm -f "$APPIMAGE"

ARCH="$(uname -m)"
export VERSION

"$APPIMAGETOOL" "$APPDIR" "$APPIMAGE" 2>&1 || {
  echo -e "${RED}AppImage build failed.${NC}"
  exit 1
}

# ---- 清理 ----
rm -rf "$APPDIR"
rm -f "${BUILD_DIR}/appimagetool"

# ---- 结果 ----
echo ""
echo -e "${GREEN}=== AppImage ready: ${APPIMAGE} ===${NC}"

if [ -f "$APPIMAGE" ]; then
  chmod +x "$APPIMAGE"
  echo -e "Size: $(du -h "$APPIMAGE" | cut -f1)"
else
  echo -e "${RED}AppImage was not created.${NC}"
  exit 1
fi
