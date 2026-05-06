#!/usr/bin/env bash
# ==============================================================================
# close-app.sh — 安全关闭 Lumina 应用进程
#
# 优雅退出 → SIGTERM → SIGKILL 三级降级策略
# ==============================================================================
set -euo pipefail

APP_NAME="Lumina"
APP_BUNDLE="${APP_NAME}.app"

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

is_running() {
  pgrep -x "$APP_NAME" > /dev/null 2>&1 || \
  pgrep -f "${APP_BUNDLE}/Contents/MacOS/" > /dev/null 2>&1 || \
  pgrep -f "${APP_BUNDLE}/Contents/Resources/sidecar" > /dev/null 2>&1
}

if ! is_running; then
  echo -e "${GREEN}${APP_NAME} is not running.${NC}"
  exit 0
fi

echo -e "${YELLOW}${APP_NAME} is running, attempting graceful shutdown...${NC}"

# 1. 优雅退出（AppleScript）
osascript -e "quit app \"$APP_NAME\"" > /dev/null 2>&1 || true

COUNT=0
while is_running && [ $COUNT -lt 10 ]; do
  sleep 1
  ((COUNT++))
  echo "  Waiting... (${COUNT}/10)"
done

# 2. SIGTERM（15）
if is_running; then
  echo -e "${YELLOW}Graceful shutdown timed out, sending SIGTERM...${NC}"
  pkill -15 -x "$APP_NAME" 2>/dev/null || true
  pkill -15 -f "${APP_BUNDLE}/Contents/MacOS/" 2>/dev/null || true
  # 也关闭 sidecar
  pkill -15 -f "${APP_BUNDLE}/Contents/Resources/sidecar" 2>/dev/null || true
  sleep 2
fi

# 3. SIGKILL（9）
if is_running; then
  echo -e "${RED}SIGTERM failed, force killing with SIGKILL...${NC}"
  pkill -9 -x "$APP_NAME" 2>/dev/null || true
  pkill -9 -f "${APP_BUNDLE}/Contents/MacOS/" 2>/dev/null || true
  pkill -9 -f "${APP_BUNDLE}/Contents/Resources/sidecar" 2>/dev/null || true
  sleep 1
fi

# 4. 最终检查
if is_running; then
  echo -e "${RED}Unable to close ${APP_NAME}. Please close it manually.${NC}"
  exit 1
fi

echo -e "${GREEN}${APP_NAME} closed.${NC}"
