#!/bin/bash

# Lumina (简思) 自动化部署脚本
# 适用环境：已安装 Docker & Docker Compose 的 Linux 服务器

set -e

echo "🚀 开始部署 Lumina (简思) 项目..."

# 1. 检查环境变量文件
if [ ! -f .env ]; then
    echo "⚠️ 未发现 .env 文件，正在从 .env.example 复制..."
    cp .env.example .env
    echo "📢 请先编辑 .env 文件，填入必要的密钥（如 JWT_SECRET 等），然后重新运行此脚本。"
    exit 1
fi

# 2. 拉取/构建镜像并启动
echo "📦 正在构建并启动容器..."
sudo docker compose up -d --build

# 3. 执行数据库迁移
echo "🗄️ 正在同步数据库 Schema..."
# 等待数据库就绪
sleep 5
sudo docker compose exec backend npx prisma db push

echo "✅ 部署完成！"
echo "🌐 前端访问地址: http://服务器IP"
echo "📊 后端 API 地址: http://服务器IP/api"
echo "📜 查看运行状态: docker compose ps"
echo "📝 查看实时日志: docker compose logs -f"
