#!/bin/bash

# Lumina (简思) 自动化部署脚本
# 适用环境：已安装 Docker & Docker Compose 的 Linux 服务器

set -euo pipefail

SCRIPT_DIR=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
cd "$SCRIPT_DIR"

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
    # 先进行清理并强行获取，防止引用锁定冲突 (lock ref error)
    git remote prune "$GIT_REMOTE" >/dev/null 2>&1 || true
    git fetch "$GIT_REMOTE" --prune --tags --force

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
    if command -v sudo >/dev/null 2>&1; then
        DOCKER=(sudo docker)
    else
        echo "❌ 当前用户无权限访问 Docker Daemon（且系统无 sudo），请将用户加入 docker 组或使用有权限的账号"
        exit 1
    fi
fi

if [ ! -f docker-compose.yml ]; then
    echo "❌ 未发现 docker-compose.yml，请在项目根目录运行该脚本"
    exit 1
fi

echo "🚀 开始部署 Lumina (简思) 项目..."

# 1. 检查磁盘空间 (前置保护)
DISK_USAGE=$(df / | tail -1 | awk '{print $5}' | sed 's/%//')
if [ "$DISK_USAGE" -gt 80 ]; then
    echo "⚠️ 警告：系统磁盘占用已达 ${DISK_USAGE}%，正在执行主动清理..."
    "${DOCKER[@]}" system prune -f
    "${DOCKER[@]}" builder prune -f
    # 再次检查清理后的空间
    DISK_USAGE_AFTER=$(df / | tail -1 | awk '{print $5}' | sed 's/%//')
    echo "✨ 清理完成，当前磁盘占用：${DISK_USAGE_AFTER}%"
fi

# 2. 检查环境变量文件
if [ ! -f .env ]; then
    echo "⚠️ 未发现 .env 文件，正在从 .env.example 复制..."
    cp .env.example .env
    echo "📢 请先编辑 .env 文件，填入必要的密钥（如 JWT_SECRET 等），然后重新运行此脚本。"
    exit 1
fi

set -a
. ./.env
set +a

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

# 2. 拉取/构建镜像并启动
echo "📦 正在构建并启动容器..."
IMAGE_TAG=$(git rev-parse --short HEAD 2>/dev/null || echo "latest")
export IMAGE_TAG
echo "🏷️ 使用镜像标签: ${IMAGE_TAG}"
"${DOCKER[@]}" compose up -d --build

# 3. 清理过期镜像与构建缓存
# image prune -af: 清理所有未使用的镜像（不仅仅是 dangling 镜像）
# builder prune -f: 清理 Docker BuildKit 构建缓存，这是磁盘占用的主要来源
echo "🧹 正在清理过期镜像与构建缓存..."
"${DOCKER[@]}" image prune -af
"${DOCKER[@]}" builder prune -f

# 4. 执行数据库迁移
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
    if "${DOCKER[@]}" compose exec -T backend wget --no-verbose --tries=1 --spider http://localhost:3000/api/health/liveness >/dev/null 2>&1; then
        break
    fi
    sleep 2
done

if ! "${DOCKER[@]}" compose exec -T backend wget --no-verbose --tries=1 --spider http://localhost:3000/api/health/liveness >/dev/null 2>&1; then
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
