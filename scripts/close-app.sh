#!/bin/bash
set -euo pipefail

APP_NAME="Lumina"
YELLOW='\033[1;33m'
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m'

is_running() {
  pgrep -x "$APP_NAME" > /dev/null || \
  pgrep -f "${APP_NAME}.app/Contents/MacOS/${APP_NAME}" > /dev/null
}

if is_running; then
  echo -e "${YELLOW}⚠️  检测到 ${APP_NAME} 正在运行，正在尝试关闭...${NC}"
  # 即使 osascript 失败（如应用不支持 quit 事件），也继续执行后续逻辑
  osascript -e "quit app \"$APP_NAME\"" > /dev/null 2>&1 || true
  
  COUNT=0
  # 在 set -e 模式下，while 循环中的 condition 失败不会导致脚本退出
  while is_running && [ $COUNT -lt 5 ]; do
    sleep 1
    ((COUNT++))
  done
  
  if is_running; then
    echo -e "${RED}🛑 应用未能响应关闭请求，正在强制终止...${NC}"
    pkill -15 -x "$APP_NAME" || true
    pkill -15 -f "${APP_NAME}.app/Contents/MacOS/${APP_NAME}" || true
    sleep 1
    
    # 如果仍然运行，使用 SIGKILL
    if is_running; then
      pkill -9 -x "$APP_NAME" || true
      pkill -9 -f "${APP_NAME}.app/Contents/MacOS/${APP_NAME}" || true
      sleep 1
    fi
  fi
  
  if is_running; then
     echo -e "${RED}❌ 无法关闭应用。${NC}"
     exit 1
  fi
  echo -e "${GREEN}✅ 应用已关闭。${NC}"
fi
