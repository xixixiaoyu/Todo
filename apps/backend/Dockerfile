# ============================================
# Stage 1: Base (Node + pnpm setup)
# ============================================
FROM node:20-alpine AS base

# npm 镜像源配置 (淘宝镜像)
ENV COREPACK_NPM_REGISTRY=https://registry.npmmirror.com
ENV NODEJS_ORG_MIRROR=https://npmmirror.com/mirrors/node
RUN npm config set registry https://registry.npmmirror.com

# 启用 corepack 并安装 pnpm
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate

WORKDIR /app

# ============================================
# Stage 2: Builder (Compile & Generate)
# ============================================
FROM base AS builder

# 安装构建依赖 (better-sqlite3 等原生模块编译需要)
RUN apk add --no-cache python3 make g++ openssl

# 复制依赖配置文件
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY apps/backend/package.json ./apps/backend/
COPY packages/shared/package.json ./packages/shared/

# 安装所有依赖 (包括 devDependencies)
RUN pnpm install --frozen-lockfile

# 复制源代码及基础配置
COPY tsconfig.base.json ./
COPY packages/shared ./packages/shared
COPY apps/backend ./apps/backend

# 1. 构建共享包
RUN pnpm --filter @my-app/shared build
# 2. 生成 Prisma Client
RUN pnpm --filter @my-app/backend prisma:generate

# 3. 构建后端应用
RUN pnpm --filter @my-app/backend build

# ============================================
# Stage 3: Pruner (Extract production dependencies)
# ============================================
FROM base AS pruner

COPY --from=builder /app /app

# 使用 pnpm deploy 提取生产环境所需的最小依赖集
# 这会自动处理 workspace:* 依赖，将其转换为独立目录结构
# 注意：这会执行 pnpm install --prod
RUN pnpm --filter @my-app/backend --prod deploy /out

# ============================================
# Stage 4: Production (Final lean image)
# ============================================
FROM node:20-alpine AS production

# 仅安装运行时可能需要的最小库及 PM2
RUN apk add --no-cache openssl libgcc libstdc++ wget && \
    npm install -g pm2

# 创建非 root 用户以增强安全性
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nestjs

WORKDIR /app

# 1. 复制 pruner 阶段生成的隔离部署目录 (包含 package.json 和生产 node_modules)
COPY --from=pruner /out ./

# 2. 从 builder 复制编译产物到对应位置
COPY --from=builder /app/apps/backend/dist ./dist
COPY --from=builder /app/apps/backend/src/i18n ./dist/src/i18n
COPY --from=builder /app/apps/backend/prisma ./prisma

# 3. 复制 PM2 配置文件
COPY ecosystem.config.js ./

# 修正权限
RUN chown -R nestjs:nodejs /app

# 切换到非 root 用户
USER nestjs

# 暴露端口
EXPOSE 3000

# 设置环境变量
ENV NODE_ENV=production
ENV IS_DOCKER=true

# 健康检查
HEALTHCHECK --interval=15s --timeout=5s --start-period=30s --retries=5 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3000/api/health/liveness || exit 1

# 启动应用 - 使用 pm2-runtime 以适配 Docker 容器环境
CMD ["pm2-runtime", "start", "ecosystem.config.js", "--env", "production"]
