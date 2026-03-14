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

is_valid_percent() {
  local value=$1
  [[ "$value" =~ ^[0-9]+$ ]] && [ "$value" -ge 1 ] && [ "$value" -le 99 ]
}

validate_thresholds() {
  local threshold_name
  for threshold_name in DISK_WARN_THRESHOLD DISK_CRITICAL_THRESHOLD DISK_ABORT_THRESHOLD ALERT_WARN_THRESHOLD ALERT_CRITICAL_THRESHOLD; do
    local threshold_value=${!threshold_name}
    if ! is_valid_percent "$threshold_value"; then
      echo "❌ ${threshold_name} 必须是 1-99 的整数，当前值：${threshold_value}"
      exit 1
    fi
  done

  if [ "$DISK_WARN_THRESHOLD" -ge "$DISK_CRITICAL_THRESHOLD" ] || [ "$DISK_CRITICAL_THRESHOLD" -ge "$DISK_ABORT_THRESHOLD" ]; then
    echo "❌ 阈值关系错误：需满足 DISK_WARN_THRESHOLD < DISK_CRITICAL_THRESHOLD < DISK_ABORT_THRESHOLD"
    exit 1
  fi

  if [ "$ALERT_WARN_THRESHOLD" -ge "$ALERT_CRITICAL_THRESHOLD" ]; then
    echo "❌ 阈值关系错误：需满足 ALERT_WARN_THRESHOLD < ALERT_CRITICAL_THRESHOLD"
    exit 1
  fi
}

report_disk_health() {
  local usage=$1
  if [ "$usage" -ge "$ALERT_CRITICAL_THRESHOLD" ]; then
    echo "🚨 磁盘健康状态：CRITICAL（${usage}%）"
  elif [ "$usage" -ge "$ALERT_WARN_THRESHOLD" ]; then
    echo "⚠️ 磁盘健康状态：WARNING（${usage}%）"
  else
    echo "✅ 磁盘健康状态：OK（${usage}%）"
  fi
}

report_docker_storage() {
  local stage=$1
  echo "📦 Docker 磁盘占用摘要（${stage}）..."
  "${DOCKER[@]}" system df || true

  if [ "$DOCKER_DF_VERBOSE" = "true" ]; then
    echo "🔎 Docker 磁盘占用明细（${stage}）..."
    "${DOCKER[@]}" system df -v || true
  fi
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
      local val_raw=${BASH_REMATCH[3]}
      local value=''

      val_raw="${val_raw#"${val_raw%%[![:space:]]*}"}"

      if [[ "$val_raw" =~ ^\"(.*)\"([[:space:]]*#.*)?$ ]]; then
        value="${BASH_REMATCH[1]}"
      elif [[ "$val_raw" =~ ^\'(.*)\'([[:space:]]*#.*)?$ ]]; then
        value="${BASH_REMATCH[1]}"
      else
        value="${val_raw%%#*}"
        value="${value%"${value##*[![:space:]]}"}"
      fi

      export "$key=$value"
    fi
  done < "$env_file"
}

docker_image_exists() {
  local image_name=$1
  "${DOCKER[@]}" image inspect "$image_name" >/dev/null 2>&1
}

docker_image_revision() {
  local image_name=$1
  "${DOCKER[@]}" image inspect --format '{{index .Config.Labels "org.opencontainers.image.revision"}}' "$image_name" 2>/dev/null || true
}

docker_image_matches_revision() {
  local image_name=$1
  local expected_revision=$2

  if [ -z "$expected_revision" ]; then
    return 1
  fi

  local actual_revision
  actual_revision=$(docker_image_revision "$image_name")
  [ -n "$actual_revision" ] && [ "$actual_revision" = "$expected_revision" ]
}

service_container_id() {
  "${DOCKER[@]}" compose ps -q "$1" 2>/dev/null || true
}

get_service_health() {
  local container_id
  container_id=$(service_container_id "$1")

  if [ -z "$container_id" ]; then
    return 1
  fi

  "${DOCKER[@]}" inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "$container_id" 2>/dev/null
}

wait_for_service_health() {
  local service_name=$1
  local timeout_seconds=${2:-120}
  local interval_seconds=${3:-2}
  local waited=0
  local health_status=''

  while [ "$waited" -lt "$timeout_seconds" ]; do
    health_status=$(get_service_health "$service_name" || true)

    case "$health_status" in
      healthy | running)
        return 0
        ;;
      exited | dead)
        break
        ;;
    esac

    sleep "$interval_seconds"
    waited=$((waited + interval_seconds))
  done

  return 1
}

backend_source_changed() {
  local changed_file
  for changed_file in "${CHANGED_FILES[@]}"; do
    case "$changed_file" in
      package.json | pnpm-lock.yaml | pnpm-workspace.yaml | tsconfig.base.json | turbo.json | .npmrc | .dockerignore | apps/backend/* | packages/shared/*)
        return 0
        ;;
    esac
  done

  return 1
}

frontend_source_changed() {
  local changed_file
  for changed_file in "${CHANGED_FILES[@]}"; do
    case "$changed_file" in
      package.json | pnpm-lock.yaml | pnpm-workspace.yaml | tsconfig.base.json | turbo.json | .npmrc | .dockerignore | apps/frontend/* | packages/shared/*)
        return 0
        ;;
    esac
  done

  return 1
}

PREVIOUS_HEAD=''
CURRENT_HEAD=''
CURRENT_HEAD_SHORT=''
HEAD_CHANGED=false
CHANGED_FILES=()

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
  PREVIOUS_HEAD=$(git rev-parse HEAD 2>/dev/null || true)

  echo "📥 正在更新代码（${GIT_REMOTE}/${GIT_BRANCH}）..."
  git remote prune "$GIT_REMOTE" >/dev/null 2>&1 || true

  if ! git fetch "$GIT_REMOTE" "$GIT_BRANCH" --prune; then
    echo "⚠️ Git fetch 失败，执行仓库维护后重试..."
    git gc --prune=now >/dev/null 2>&1 || true
    git remote prune "$GIT_REMOTE" >/dev/null 2>&1 || true
    git fetch "$GIT_REMOTE" "$GIT_BRANCH" --prune
  fi

  if ! git show-ref --verify --quiet "refs/remotes/${GIT_REMOTE}/${GIT_BRANCH}"; then
    echo "❌ 未找到远端分支：${GIT_REMOTE}/${GIT_BRANCH}"
    exit 1
  fi

  if ! git checkout "$GIT_BRANCH" >/dev/null 2>&1; then
    git checkout -b "$GIT_BRANCH" --track "${GIT_REMOTE}/${GIT_BRANCH}"
  fi

  git pull --ff-only "$GIT_REMOTE" "$GIT_BRANCH"
  CURRENT_HEAD=$(git rev-parse HEAD 2>/dev/null || true)
  if [ -n "$CURRENT_HEAD" ]; then
    CURRENT_HEAD_SHORT=$(git rev-parse --short=12 "$CURRENT_HEAD" 2>/dev/null || true)
  fi

  if [ -n "$PREVIOUS_HEAD" ] && [ -n "$CURRENT_HEAD" ] && [ "$PREVIOUS_HEAD" != "$CURRENT_HEAD" ]; then
    HEAD_CHANGED=true
    while IFS= read -r changed_file; do
      if [ -n "$changed_file" ]; then
        CHANGED_FILES+=("$changed_file")
      fi
    done < <(git diff --name-only "$PREVIOUS_HEAD" "$CURRENT_HEAD")
  fi
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

if ! "${DOCKER[@]}" compose config >/dev/null 2>&1; then
  echo "❌ docker-compose.yml 配置无效，请先修复后再部署"
  exit 1
fi

echo "🚀 开始部署 Lumina (简思) 项目..."

DISK_WARN_THRESHOLD=${DISK_WARN_THRESHOLD:-80}
DISK_CRITICAL_THRESHOLD=${DISK_CRITICAL_THRESHOLD:-90}
DISK_ABORT_THRESHOLD=${DISK_ABORT_THRESHOLD:-95}
ALERT_WARN_THRESHOLD=${ALERT_WARN_THRESHOLD:-85}
ALERT_CRITICAL_THRESHOLD=${ALERT_CRITICAL_THRESHOLD:-90}
IMAGE_PRUNE_UNTIL=${IMAGE_PRUNE_UNTIL:-240h}
BUILDER_PRUNE_UNTIL=${BUILDER_PRUNE_UNTIL:-168h}
ENABLE_AGGRESSIVE_PRUNE=${ENABLE_AGGRESSIVE_PRUNE:-false}
DOCKER_DF_VERBOSE=${DOCKER_DF_VERBOSE:-false}
DEFAULT_IMAGE_TAG=${IMAGE_TAG:-prod}
BACKEND_IMAGE_TAG=${BACKEND_IMAGE_TAG:-$DEFAULT_IMAGE_TAG}
FRONTEND_IMAGE_TAG=${FRONTEND_IMAGE_TAG:-$DEFAULT_IMAGE_TAG}
VCS_REF=${CURRENT_HEAD:-${VCS_REF:-unknown}}
DOCKER_BUILDKIT=${DOCKER_BUILDKIT:-1}
COMPOSE_DOCKER_CLI_BUILD=${COMPOSE_DOCKER_CLI_BUILD:-1}
export BACKEND_IMAGE_TAG FRONTEND_IMAGE_TAG VCS_REF DOCKER_BUILDKIT COMPOSE_DOCKER_CLI_BUILD
validate_thresholds

if [ -n "$CURRENT_HEAD_SHORT" ]; then
  echo "📌 当前部署版本: ${CURRENT_HEAD_SHORT}"
fi

DISK_USAGE_BEFORE=$(get_disk_usage)
if [ "$DISK_USAGE_BEFORE" -ge "$DISK_WARN_THRESHOLD" ]; then
  echo "⚠️ 部署前磁盘占用 ${DISK_USAGE_BEFORE}%（阈值 ${DISK_WARN_THRESHOLD}%），执行预清理..."
  "${DOCKER[@]}" image prune -f
  "${DOCKER[@]}" builder prune -f --filter "until=${BUILDER_PRUNE_UNTIL}"
  "${DOCKER[@]}" image prune -a -f --filter "until=${IMAGE_PRUNE_UNTIL}"
  report_docker_storage '部署前预清理后'
  DISK_USAGE=$(get_disk_usage)
  echo "📊 部署前清理后磁盘占用：${DISK_USAGE}%"
else
  DISK_USAGE=$DISK_USAGE_BEFORE
  echo "✅ 当前磁盘占用 ${DISK_USAGE}% 低于阈值 ${DISK_WARN_THRESHOLD}% ，跳过部署前清理以保留构建缓存"
fi

if [ "$DISK_USAGE" -ge "$DISK_CRITICAL_THRESHOLD" ]; then
  if [ "$ENABLE_AGGRESSIVE_PRUNE" = "true" ]; then
    echo "⚠️ 磁盘占用 ${DISK_USAGE}%（临界 ${DISK_CRITICAL_THRESHOLD}%），部署前执行激进清理..."
    "${DOCKER[@]}" system prune -f
    DISK_USAGE=$(get_disk_usage)
    echo "✨ 部署前激进清理后磁盘占用：${DISK_USAGE}%"
  else
    echo "⚠️ 部署前磁盘占用仍为 ${DISK_USAGE}%（临界 ${DISK_CRITICAL_THRESHOLD}%）"
    echo "⚠️ 如需部署前执行激进清理，请设置 ENABLE_AGGRESSIVE_PRUNE=true 后重试"
  fi
fi

if [ "$DISK_USAGE" -ge "$DISK_ABORT_THRESHOLD" ]; then
  echo "❌ 部署前磁盘占用 ${DISK_USAGE}% 超过中止阈值 ${DISK_ABORT_THRESHOLD}% ，为避免部署失败风险已终止"
  exit 1
fi

BACKEND_IMAGE="lumina-backend:${BACKEND_IMAGE_TAG}"
FRONTEND_IMAGE="lumina-frontend:${FRONTEND_IMAGE_TAG}"
BUILD_SERVICES=()
BACKEND_BUILD_REASON=''
FRONTEND_BUILD_REASON=''

if [ ! -d .git ]; then
  BUILD_SERVICES=(backend frontend)
  BACKEND_BUILD_REASON='非 Git 环境，执行保守全量构建'
  FRONTEND_BUILD_REASON='非 Git 环境，执行保守全量构建'
else
  if ! docker_image_exists "$BACKEND_IMAGE"; then
    BUILD_SERVICES+=('backend')
    BACKEND_BUILD_REASON="本地缺少镜像 ${BACKEND_IMAGE}"
  elif [ -n "$CURRENT_HEAD" ] && ! docker_image_matches_revision "$BACKEND_IMAGE" "$CURRENT_HEAD"; then
    BUILD_SERVICES+=('backend')
    BACKEND_BUILD_REASON='后端镜像 revision 与当前代码版本不一致'
  elif [ "$HEAD_CHANGED" = "true" ] && backend_source_changed; then
    BUILD_SERVICES+=('backend')
    BACKEND_BUILD_REASON='检测到后端相关代码变更'
  fi

  if ! docker_image_exists "$FRONTEND_IMAGE"; then
    BUILD_SERVICES+=('frontend')
    FRONTEND_BUILD_REASON="本地缺少镜像 ${FRONTEND_IMAGE}"
  elif [ -n "$CURRENT_HEAD" ] && ! docker_image_matches_revision "$FRONTEND_IMAGE" "$CURRENT_HEAD"; then
    BUILD_SERVICES+=('frontend')
    FRONTEND_BUILD_REASON='前端镜像 revision 与当前代码版本不一致'
  elif [ "$HEAD_CHANGED" = "true" ] && frontend_source_changed; then
    BUILD_SERVICES+=('frontend')
    FRONTEND_BUILD_REASON='检测到前端相关代码变更'
  fi
fi

echo "🏷️ 使用镜像标签: backend=${BACKEND_IMAGE_TAG}, frontend=${FRONTEND_IMAGE_TAG}"

if [ "${#BUILD_SERVICES[@]}" -gt 0 ]; then
  echo "📦 需要重建的服务: ${BUILD_SERVICES[*]}"
  if [ -n "$BACKEND_BUILD_REASON" ]; then
    echo "   backend: ${BACKEND_BUILD_REASON}"
  fi
  if [ -n "$FRONTEND_BUILD_REASON" ]; then
    echo "   frontend: ${FRONTEND_BUILD_REASON}"
  fi
  "${DOCKER[@]}" compose build "${BUILD_SERVICES[@]}"
else
  echo "⚡ 未检测到需要重建的服务，复用现有镜像"
fi

echo "🚀 正在启动并更新容器..."
"${DOCKER[@]}" compose up -d --no-build --remove-orphans

DISK_USAGE_AFTER_BUILD=$(get_disk_usage)
if [ "$DISK_USAGE_AFTER_BUILD" -ge "$DISK_WARN_THRESHOLD" ]; then
  echo "🧹 部署后磁盘占用 ${DISK_USAGE_AFTER_BUILD}%（阈值 ${DISK_WARN_THRESHOLD}%），执行即时清理..."
  "${DOCKER[@]}" image prune -f
  "${DOCKER[@]}" builder prune -f --filter "until=${BUILDER_PRUNE_UNTIL}"
  "${DOCKER[@]}" image prune -a -f --filter "until=${IMAGE_PRUNE_UNTIL}"
  report_docker_storage '部署后即时清理后'
else
  echo "✅ 部署后磁盘占用 ${DISK_USAGE_AFTER_BUILD}% 低于阈值 ${DISK_WARN_THRESHOLD}% ，跳过即时清理"
fi

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

if [ "$DISK_USAGE_AFTER" -ge "$DISK_ABORT_THRESHOLD" ]; then
  echo "❌ 磁盘占用 ${DISK_USAGE_AFTER}% 超过中止阈值 ${DISK_ABORT_THRESHOLD}% ，为避免部署失败风险已终止"
  exit 1
fi

echo "🗄️ 正在同步数据库 Schema..."
echo "⏳ 等待后端健康检查通过..."
if ! wait_for_service_health backend 180 2; then
  echo "❌ 后端未就绪，终止部署"
  "${DOCKER[@]}" compose ps || true
  "${DOCKER[@]}" compose logs --tail=100 backend || true
  exit 1
fi

if [ -d apps/backend/prisma/migrations ] && [ "$(ls -A apps/backend/prisma/migrations 2>/dev/null || true)" ]; then
  "${DOCKER[@]}" compose exec -T backend ./node_modules/.bin/prisma migrate deploy
else
  "${DOCKER[@]}" compose exec -T backend ./node_modules/.bin/prisma db push
fi

report_disk_health "$DISK_USAGE_AFTER"

GOACCESS_REPORT_PORT=${GOACCESS_REPORT_PORT:-7890}
GOACCESS_REPORT_BIND=${GOACCESS_REPORT_BIND:-127.0.0.1}
NPM_ADMIN_BIND=${NPM_ADMIN_BIND:-127.0.0.1}
NPM_ADMIN_PORT=${NPM_ADMIN_PORT:-81}

echo "✅ 部署完成！"
echo "🌐 前端访问地址: http://服务器IP"
echo "📊 后端 API 地址: http://服务器IP/api"
if [ "$GOACCESS_REPORT_BIND" = "127.0.0.1" ]; then
  echo "📈 访问统计看板默认仅本机可见: http://127.0.0.1:${GOACCESS_REPORT_PORT}"
  echo "🔐 生产推荐: 使用 Nginx Proxy Manager 反向代理 + Basic Auth + HTTPS"
  if [ "$NPM_ADMIN_BIND" = "127.0.0.1" ]; then
    echo "🛡️ NPM 管理后台默认仅本机: http://127.0.0.1:${NPM_ADMIN_PORT}"
    echo "   若需远程打开后台，请设置 NPM_ADMIN_BIND=0.0.0.0 并限制来源 IP"
  else
    echo "🛡️ NPM 管理后台: http://服务器IP:${NPM_ADMIN_PORT}"
  fi
  echo "🧪 临时调试可用 SSH 隧道: ssh -L ${GOACCESS_REPORT_PORT}:127.0.0.1:${GOACCESS_REPORT_PORT} user@服务器IP"
  echo "   本地访问: http://localhost:${GOACCESS_REPORT_PORT}"
else
  echo "⚠️ 访问统计看板已对外监听: http://${GOACCESS_REPORT_BIND}:${GOACCESS_REPORT_PORT}"
  echo "❗ 请务必配合防火墙或反向代理鉴权；生产环境不建议公网直连"
fi
echo "📜 查看运行状态: docker compose ps"
echo "📝 查看实时日志: docker compose logs -f"
