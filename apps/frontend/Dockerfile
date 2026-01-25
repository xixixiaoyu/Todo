# ============================================
# Stage 1: Build dependencies (monorepo base)
# ============================================
FROM node:20-alpine AS base

# npm 镜像源配置 (淘宝镜像)
ENV COREPACK_NPM_REGISTRY=https://registry.npmmirror.com
ENV NODEJS_ORG_MIRROR=https://npmmirror.com/mirrors/node
RUN npm config set registry https://registry.npmmirror.com

# 启用 corepack 并安装 pnpm
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate

WORKDIR /app

# 先复制依赖配置文件，利用 Docker 层缓存
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json .npmrc ./
COPY apps/frontend/package.json ./apps/frontend/
COPY packages/shared/package.json ./packages/shared/

# 安装依赖
RUN pnpm install --frozen-lockfile

# ============================================
# Stage 2: Build application
# ============================================
FROM base AS builder

WORKDIR /app

# 复制源代码
COPY packages/shared ./packages/shared
COPY apps/frontend ./apps/frontend
COPY tsconfig.base.json ./

# 构建共享包和前端应用
RUN pnpm --filter @my-app/shared build
RUN pnpm --filter @my-app/frontend build

# ============================================
# Stage 3: Production image with Nginx
# ============================================
FROM nginx:alpine AS production

# 创建非 root 用户
RUN addgroup -g 1001 -S frontend && \
    adduser -S -D -H -u 1001 -s /sbin/nologin -G frontend frontend

# 移除默认 nginx 配置和 IPv6 自动配置脚本（解决只读文件系统报错）
RUN rm /etc/nginx/conf.d/default.conf && \
    rm -f /docker-entrypoint.d/10-listen-on-ipv6-by-default.sh

# 复制自定义 nginx 主配置（适配非 root 用户）
COPY --chown=frontend:frontend apps/frontend/nginx.main.conf /etc/nginx/nginx.conf

# 复制 server block 配置
COPY --chown=frontend:frontend apps/frontend/nginx.conf /etc/nginx/conf.d/default.conf

# 复制构建产物
COPY --from=builder --chown=frontend:frontend /app/apps/frontend/dist /usr/share/nginx/html

# 配置权限
RUN chown -R frontend:frontend /var/cache/nginx && \
    # 创建并设置日志目录权限
    mkdir -p /var/log/nginx && \
    chown -R frontend:frontend /var/log/nginx && \
    # 确保 /tmp 目录下的临时文件夹可写
    mkdir -p /tmp/client_temp /tmp/proxy_temp /tmp/fastcgi_temp /tmp/uwsgi_temp /tmp/scgi_temp && \
    chown -R frontend:frontend /tmp && \
    # 清理缓存减小镜像大小
    rm -rf /var/cache/apk/*

# 切换到非 root 用户
USER frontend

# 暴露端口
EXPOSE 80

# 健康检查
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:80/health || exit 1

# 启动 nginx
CMD ["nginx", "-g", "daemon off;"]
