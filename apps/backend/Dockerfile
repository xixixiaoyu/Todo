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

# 设置 pnpm 存储目录和全局配置 (解决 Docker 中的权限和缓存问题)
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN pnpm config set store-dir /pnpm/store

# 安装构建依赖 (better-sqlite3 等原生模块需要)
RUN apk add --no-cache python3 make g++

WORKDIR /app

# 先复制依赖配置文件，利用 Docker 层缓存
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json .npmrc ./
COPY apps/backend/package.json ./apps/backend/
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
COPY apps/backend ./apps/backend
COPY tsconfig.base.json ./

# 生成 Prisma Client
RUN pnpm --filter @my-app/backend prisma:generate

# 构建共享包和后端应用
RUN pnpm --filter @my-app/shared build
RUN pnpm --filter @my-app/backend build

# ============================================
# Stage 3: Production image
# ============================================
FROM base AS production

# 创建非 root 用户以增强安全性
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nestjs

# 确保 pnpm 存储目录对新用户可用
RUN mkdir -p /pnpm && chown -R nestjs:nodejs /pnpm

WORKDIR /app

# 复制依赖配置文件
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY apps/backend/package.json ./apps/backend/
COPY packages/shared/package.json ./packages/shared/

# 复制 Prisma schema 和配置文件
COPY apps/backend/prisma ./apps/backend/prisma
COPY apps/backend/prisma.config.ts ./apps/backend/

# 确保工作目录归属正确 (递归 chown 解决 pnpm 权限问题)
RUN chown -R nestjs:nodejs /app

# 切换到非 root 用户
USER nestjs

# 安装生产依赖并生成 Prisma Client
# 注意：better-sqlite3 等原生模块已经在 base 阶段编译过，这里 --prod 主要是清理 devDeps
RUN pnpm install --frozen-lockfile --prod --ignore-scripts && \
    npx prisma generate --schema ./apps/backend/prisma/schema && \
    rm -rf ~/.cache /tmp/*

# 从构建阶段复制编译产物
COPY --from=builder --chown=nestjs:nodejs /app/apps/backend/dist ./apps/backend/dist
COPY --from=builder --chown=nestjs:nodejs /app/apps/backend/src/i18n ./apps/backend/dist/src/i18n
COPY --from=builder --chown=nestjs:nodejs /app/packages/shared ./packages/shared

WORKDIR /app/apps/backend

# 暴露端口
EXPOSE 3000

# 设置生产环境变量
ENV NODE_ENV=production

# 健康检查
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3000/api/health || exit 1

# 启动应用
CMD ["node", "dist/src/main.js"]
