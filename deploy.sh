#!/bin/bash

set -euo pipefail

SCRIPT_DIR=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
cd "$SCRIPT_DIR"

LOCK_DIR="${DEPLOY_LOCK_DIR:-/tmp/lumina-deploy.lock}"
if ! mkdir "$LOCK_DIR" 2>/dev/null; then
  echo "❌ 检测到另一个部署任务正在运行，请稍后重试"
  exit 1
fi
trap 'rmdir "$LOCK_DIR" >/dev/null 2>&1 || true' EXIT

get_disk_usage() {
  df -P / | awk 'NR==2 {gsub("%", "", $5); print $5}'
}

load_env_file() {
  local env_file=$1
  while IFS= read -r raw_line || [ -n "$raw_line" ]; do
    local line=${raw_line%$'\r'}
    if [[ "$line" =~ ^[[:space:]]*$ ]] || [[ "$line" =~ ^[[:space:]]*# ]]; then
      continue
    fi
    if [[ "$line" =~ ^[[:space:]]*(export[[:space:]]+)?([A-Za-z_][A-Za-z0-9_]*)=(.*)$ ]]; then
      local key=${BASH_REMATCH[2]}
      local value=${BASH_REMATCH[3]}
      value="${value#"${value%%[![:space:]]*}"}"
      if [[ "$value" =~ ^\"(.*)\"$ ]]; then
        value=${BASH_REMATCH[1]}
      elif [[ "$value" =~ ^\'(.*)\'$ ]]; then
        value=${BASH_REMATCH[1]}
      fi
      export "$key=$value"
    fi
  done < "$env_file"
}

backend_liveness_ok() {
  "${DOCKER[@]}" compose exec -T backend node -e "const http=require('http');const req=http.get('http://localhost:3000/api/health/liveness',res=>{process.exit(res.statusCode===200?0:1)});req.on('error',()=>process.exit(1));req.setTimeout(1500,()=>{req.destroy();process.exit(1)});" >/dev/null 2>&1
}

if [ -d .git ]; then
  if ! command -v git >/dev/null 2>&1; then
    echo "❌ 未检测到 git，但当前目录是 Git 仓库，无法执行代码更新"
    exit 1
  fi

  if [ -n "$(git status --porcelain)" ]; then
    echo "❌ 当前工作区存在未提交修改，已终止（避免覆盖本地改动）"
    exit 1
  fi

  GIT_REMOTE=${GIT_REMOTE:-origin}
  GIT_BRANCH=${GIT_BRANCH:-main}

  echo "📥 正在更新代码（${GIT_REMOTE}/${GIT_BRANCH}）..."
  git remote prune "$GIT_REMOTE" >/dev/null 2>&1 || true

  if ! git fetch "$GIT_REMOTE" --prune --tags --force; then
    echo "⚠️ Git fetch 失败，执行仓库维护后重试..."
    git gc --prune=now >/dev/null 2>&1 || true
    git remote prune "$GIT_REMOTE" >/dev/null 2>&1 || true
    git fetch "$GIT_REMOTE" --prune --tags --force
  fi

  if ! git show-ref --verify --quiet "refs/remotes/${GIT_REMOTE}/${GIT_BRANCH}"; then
    echo "❌ 未找到远端分支：${GIT_REMOTE}/${GIT_BRANCH}"
    exit 1
  fi

  if ! git checkout "$GIT_BRANCH" >/dev/null 2>&1; then
    git checkout -b "$GIT_BRANCH" --track "${GIT_REMOTE}/${GIT_BRANCH}"
  fi

  git pull --ff-only "$GIT_REMOTE" "$GIT_BRANCH"
fi

if ! command -v docker >/dev/null 2>&1; then
  echo "❌ 未检测到 docker，请先安装 Docker"
  exit 1
fi

if ! docker compose version >/dev/null 2>&1; then
  echo "❌ 未检测到 docker compose（Compose V2 插件），请先安装/启用"
  exit 1
fi

DOCKER=(docker)
if ! docker info >/dev/null 2>&1; then
  if command -v sudo >/dev/null 2>&1 && sudo -n true >/dev/null 2>&1; then
    DOCKER=(sudo docker)
  else
    echo "❌ 当前用户无权限访问 Docker Daemon，请将用户加入 docker 组或配置免密 sudo"
    exit 1
  fi
fi

if [ ! -f docker-compose.yml ]; then
  echo "❌ 未发现 docker-compose.yml，请在项目根目录运行该脚本"
  exit 1
fi

if ! "${DOCKER[@]}" compose config >/dev/null 2>&1; then
  echo "❌ docker-compose.yml 配置无效，请先修复后再部署"
  exit 1
fi

echo "🚀 开始部署 Lumina (简思) 项目..."

DISK_WARN_THRESHOLD=${DISK_WARN_THRESHOLD:-80}
DISK_CRITICAL_THRESHOLD=${DISK_CRITICAL_THRESHOLD:-90}
IMAGE_PRUNE_UNTIL=${IMAGE_PRUNE_UNTIL:-240h}
BUILDER_PRUNE_UNTIL=${BUILDER_PRUNE_UNTIL:-168h}
ENABLE_AGGRESSIVE_PRUNE=${ENABLE_AGGRESSIVE_PRUNE:-false}

DISK_USAGE=$(get_disk_usage)
if [ "$DISK_USAGE" -ge "$DISK_WARN_THRESHOLD" ]; then
  echo "⚠️ 磁盘占用 ${DISK_USAGE}%（阈值 ${DISK_WARN_THRESHOLD}%），执行温和清理..."
  "${DOCKER[@]}" builder prune -f --filter "until=${BUILDER_PRUNE_UNTIL}"
  "${DOCKER[@]}" image prune -a -f --filter "until=${IMAGE_PRUNE_UNTIL}"
fi

if [ ! -f .env ]; then
  if [ -f .env.example ]; then
    echo "⚠️ 未发现 .env 文件，正在从 .env.example 复制..."
    cp .env.example .env
    echo "📢 请先编辑 .env 文件，填入必要的密钥（如 JWT_SECRET 等），然后重新运行此脚本。"
  else
    echo "❌ 未发现 .env，且不存在 .env.example，无法继续部署"
  fi
  exit 1
fi

load_env_file .env

REQUIRED_VARS=(POSTGRES_PASSWORD REDIS_PASSWORD JWT_SECRET JWT_REFRESH_SECRET CORS_ORIGIN)
MISSING_VARS=()
for var_name in "${REQUIRED_VARS[@]}"; do
  if [ -z "${!var_name:-}" ]; then
    MISSING_VARS+=("$var_name")
  fi
done

if [ "${#MISSING_VARS[@]}" -gt 0 ]; then
  echo "❌ .env 缺少生产环境必填变量：${MISSING_VARS[*]}"
  exit 1
fi

echo "📦 正在构建并启动容器..."
IMAGE_TAG=$(git rev-parse --short HEAD 2>/dev/null || echo "latest")
export IMAGE_TAG
echo "🏷️ 使用镜像标签: ${IMAGE_TAG}"
"${DOCKER[@]}" compose up -d --build --remove-orphans

echo "🧹 正在清理过期镜像与构建缓存..."
"${DOCKER[@]}" builder prune -f --filter "until=${BUILDER_PRUNE_UNTIL}"
"${DOCKER[@]}" image prune -a -f --filter "until=${IMAGE_PRUNE_UNTIL}"

DISK_USAGE_AFTER=$(get_disk_usage)
if [ "$DISK_USAGE_AFTER" -ge "$DISK_CRITICAL_THRESHOLD" ]; then
  if [ "$ENABLE_AGGRESSIVE_PRUNE" = "true" ]; then
    echo "⚠️ 磁盘占用 ${DISK_USAGE_AFTER}%（临界 ${DISK_CRITICAL_THRESHOLD}%），执行激进清理..."
    "${DOCKER[@]}" system prune -f
    DISK_USAGE_AFTER=$(get_disk_usage)
    echo "✨ 激进清理后磁盘占用：${DISK_USAGE_AFTER}%"
  else
    echo "⚠️ 磁盘占用仍为 ${DISK_USAGE_AFTER}%（临界 ${DISK_CRITICAL_THRESHOLD}%）"
    echo "⚠️ 如需执行激进清理，请设置 ENABLE_AGGRESSIVE_PRUNE=true 后重试"
  fi
fi

echo "🗄️ 正在同步数据库 Schema..."
echo "⏳ 等待 PostgreSQL 就绪..."
for i in {1..60}; do
  if "${DOCKER[@]}" compose exec -T postgres pg_isready -U "${POSTGRES_USER:-postgres}" >/dev/null 2>&1; then
    break
  fi
  sleep 2
done

if ! "${DOCKER[@]}" compose exec -T postgres pg_isready -U "${POSTGRES_USER:-postgres}" >/dev/null 2>&1; then
  echo "❌ PostgreSQL 未就绪，终止部署"
  exit 1
fi

echo "⏳ 等待后端健康检查通过..."
for i in {1..60}; do
  if backend_liveness_ok; then
    break
  fi
  sleep 2
done

if ! backend_liveness_ok; then
  echo "❌ 后端未就绪，终止部署"
  exit 1
fi

if [ -d apps/backend/prisma/migrations ] && [ "$(ls -A apps/backend/prisma/migrations 2>/dev/null || true)" ]; then
  "${DOCKER[@]}" compose exec -T backend ./node_modules/.bin/prisma migrate deploy
else
  "${DOCKER[@]}" compose exec -T backend ./node_modules/.bin/prisma db push
fi

echo "✅ 部署完成！"
echo "🌐 前端访问地址: http://服务器IP"
echo "📊 后端 API 地址: http://服务器IP/api"
echo "📜 查看运行状态: docker compose ps"
echo "📝 查看实时日志: docker compose logs -f"
