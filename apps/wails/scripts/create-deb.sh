#!/usr/bin/env bash
# ==============================================================================
# create-deb.sh — 为 Debian/Ubuntu 构建 .deb 安装包
#
# 用法：
#   ./scripts/create-deb.sh
#   VERSION=1.0.0 ARCH=amd64 ./scripts/create-deb.sh
# ==============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
BUILD_DIR="${PROJECT_DIR}/build/bin"
LINUX_DIR="${PROJECT_DIR}/build/linux"

APP_NAME="Lumina"
PKG_NAME="lumina"
VERSION="${VERSION:-$(grep -o '"productVersion": "[^"]*"' "${PROJECT_DIR}/wails.json" | head -1 | cut -d'"' -f4 | sed 's/-/~/g')}"
VERSION="${VERSION:-1.0.0}"
ARCH="${ARCH:-$(uname -m)}"

# 标准化架构名
case "$ARCH" in
  x86_64)  DEB_ARCH="amd64" ;;
  aarch64) DEB_ARCH="arm64" ;;
  armv7l)  DEB_ARCH="armhf" ;;
  *)       DEB_ARCH="amd64" ;;
esac

DEB_NAME="${PKG_NAME}_${VERSION}_${DEB_ARCH}.deb"
DEB_ROOT="${BUILD_DIR}/deb_root"
DEB_PATH="${BUILD_DIR}/${DEB_NAME}"

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# ---- 检查 ----
BINARY="${BUILD_DIR}/${APP_NAME}"
if [ ! -f "$BINARY" ]; then
  echo -e "${RED}Error: ${APP_NAME} binary not found at ${BINARY}${NC}"
  exit 1
fi

echo -e "${GREEN}Building .deb package for ${PKG_NAME} v${VERSION} (${DEB_ARCH})${NC}"

# ---- 清理 ----
rm -rf "$DEB_ROOT"

# ---- 目录结构 ----
INSTALL_DIR="${DEB_ROOT}/opt/${PKG_NAME}"
mkdir -p "${DEB_ROOT}/DEBIAN"
mkdir -p "${INSTALL_DIR}"
mkdir -p "${DEB_ROOT}/usr/share/applications"
mkdir -p "${DEB_ROOT}/usr/share/icons/hicolor/256x256/apps"
mkdir -p "${DEB_ROOT}/usr/bin"

# ---- 安装文件 ----
cp "$BINARY" "${INSTALL_DIR}/${APP_NAME}"
chmod 755 "${INSTALL_DIR}/${APP_NAME}"

# Sidecar
if [ -d "${BUILD_DIR}/sidecar" ]; then
  cp -r "${BUILD_DIR}/sidecar" "${INSTALL_DIR}/"
fi

# Desktop 文件
cp "${LINUX_DIR}/lumina.desktop" "${DEB_ROOT}/usr/share/applications/"

# 图标
for src in "${PROJECT_DIR}/build/appicon.png" "${PROJECT_DIR}/frontend/dist/pwa-512x512.png"; do
  if [ -f "$src" ]; then
    cp "$src" "${DEB_ROOT}/usr/share/icons/hicolor/256x256/apps/lumina.png"
    break
  fi
done

# /usr/bin 符号链接
ln -sf "/opt/${PKG_NAME}/${APP_NAME}" "${DEB_ROOT}/usr/bin/${APP_NAME}"

# ---- DEBIAN/control ----
INSTALLED_SIZE=$(du -sk "$DEB_ROOT" | cut -f1)

cat > "${DEB_ROOT}/DEBIAN/control" << EOF
Package: ${PKG_NAME}
Version: ${VERSION}
Section: utils
Priority: optional
Architecture: ${DEB_ARCH}
Depends: libgtk-3-0, libwebkit2gtk-4.1-0 | libwebkit2gtk-4.0-37, libayatana-appindicator3-1 | libappindicator3-1
Installed-Size: ${INSTALLED_SIZE}
Maintainer: 牧云 (Mu Yun) <contact@lumina.app>
Homepage: https://github.com/xixixiaoyu/lumina
Description: 简思 (Lumina) — AI-driven personal todo system
 简于形，深于思 — 高效纯粹的 AI 个人待办。
 .
 A modern minimalist AI Todo application with:
  - AI-powered task management
  - MCP protocol support
  - Cross-platform desktop app (Wails)
  - PWA progressive web app
EOF

# ---- postinst 脚本（更新 desktop database 和 icon cache） ----
cat > "${DEB_ROOT}/DEBIAN/postinst" << 'EOF'
#!/bin/sh
set -e
if [ -x /usr/bin/update-desktop-database ]; then
  update-desktop-database /usr/share/applications || true
fi
if [ -x /usr/bin/gtk-update-icon-cache ]; then
  gtk-update-icon-cache /usr/share/icons/hicolor || true
fi
EOF
chmod 755 "${DEB_ROOT}/DEBIAN/postinst"

# ---- postrm 脚本 ----
cat > "${DEB_ROOT}/DEBIAN/postrm" << 'EOF'
#!/bin/sh
set -e
if [ -x /usr/bin/update-desktop-database ]; then
  update-desktop-database /usr/share/applications || true
fi
EOF
chmod 755 "${DEB_ROOT}/DEBIAN/postrm"

# ---- 构建 .deb ----
echo "Building ${DEB_NAME}..."
dpkg-deb --build "$DEB_ROOT" "$DEB_PATH" 2>&1

# ---- 清理 ----
rm -rf "$DEB_ROOT"

# ---- 结果 ----
if [ -f "$DEB_PATH" ]; then
  echo ""
  echo -e "${GREEN}=== .deb package ready: ${DEB_PATH} ===${NC}"
  echo -e "Size: $(du -h "$DEB_PATH" | cut -f1)"
  echo ""
  echo "Install with: sudo dpkg -i ${DEB_NAME}"
else
  echo -e "${RED}.deb build failed.${NC}"
  exit 1
fi
