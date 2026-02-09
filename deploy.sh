#!/bin/bash

# Lumina (简思) 自动化部署脚本
# 适用环境：已安装 Docker & Docker Compose 的 Linux 服务器

set -euo pipefail

echo "🚀 开始部署 Lumina (简思) 项目..."

# 1. 检查磁盘空间 (前置保护)
DISK_USAGE=$(df / | tail -1 | awk '{print $5}' | sed 's/%//')
if [ "$DISK_USAGE" -gt 90 ]; then
    echo "⚠️ 警告：系统磁盘占用已达 ${DISK_USAGE}%，正在执行紧急清理..."
    sudo docker system prune -f
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

# 2. 拉取/构建镜像并启动
echo "📦 正在构建并启动容器..."
sudo docker compose up -d --build

# 3. 清理过期镜像
# 仅清理构建过程中产生的临时镜像和未使用的旧镜像，防止磁盘空间泄露
echo "🧹 正在清理过期镜像..."
sudo docker image prune -f

# 4. 执行数据库迁移
echo "🗄️ 正在同步数据库 Schema..."
echo "⏳ 等待 PostgreSQL 就绪..."
for i in {1..60}; do
    if sudo docker compose exec -T postgres pg_isready -U "${POSTGRES_USER:-postgres}" >/dev/null 2>&1; then
        break
    fi
    sleep 2
done

if ! sudo docker compose exec -T postgres pg_isready -U "${POSTGRES_USER:-postgres}" >/dev/null 2>&1; then
    echo "❌ PostgreSQL 未就绪，终止部署"
    exit 1
fi

echo "⏳ 等待后端健康检查通过..."
for i in {1..60}; do
    if sudo docker compose exec -T backend wget --no-verbose --tries=1 --spider http://localhost:3000/api/health/liveness >/dev/null 2>&1; then
        break
    fi
    sleep 2
done

if ! sudo docker compose exec -T backend wget --no-verbose --tries=1 --spider http://localhost:3000/api/health/liveness >/dev/null 2>&1; then
    echo "❌ 后端未就绪，终止部署"
    exit 1
fi

sudo docker compose exec -T backend ./node_modules/.bin/prisma db push

echo "✅ 部署完成！"
echo "🌐 前端访问地址: http://服务器IP"
echo "📊 后端 API 地址: http://服务器IP/api"
echo "📜 查看运行状态: docker compose ps"
echo "📝 查看实时日志: docker compose logs -f"
