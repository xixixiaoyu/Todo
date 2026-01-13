# 项目上下文

基于 **NestJS + Vue 3** 的全栈模板，采用 **pnpm Monorepo** 架构。

## 项目结构

```
apps/backend/     # NestJS 后端
apps/frontend/    # Vue 3 前端
packages/shared/  # 共享包（Zod Schema、DTO、工具函数）
```

## 技术栈

**前端**: Vue 3.5+ / Vite 6 / Pinia / Tailwind + shadcn-vue / GSAP / TanStack Query + Axios / VeeValidate + Zod / Vue I18n
**跨端**: Capacitor 8 / Electron 36 / PWA
**后端**: NestJS 10.4+ / PostgreSQL 16 + Prisma 6 / Redis 7 + BullMQ / JWT + Passport / nestjs-zod / Socket.IO
**工具**: pnpm 9.15+ / Turbo 2.3+ / ESLint 9 / Vitest

## 常用命令

```bash
pnpm dev                              # 同时启动前后端
pnpm --filter @my-app/backend dev     # 仅后端 (localhost:3000)
pnpm --filter @my-app/frontend dev    # 仅前端 (localhost:5173)
pnpm db:push                          # 推送 Schema 到数据库
pnpm lint && pnpm format              # 代码检查与格式化
pnpm --filter @my-app/shared build    # 构建共享包
pnpm test                             # 运行测试
docker compose up postgres redis -d    # 启动数据库服务
docker compose up -d                  # 启动完整服务栈
```

## 代码规范

**模块导入**:
```typescript
import { xxx } from '@my-app/shared'           // 共享包
import { Button } from '@/components/ui/button' // UI 组件
import { cn } from '@/lib/utils'                // 工具函数
```

**Vue 组件**: `<script setup lang="ts">` -> `<template>` -> `<style>`，优先 Composition API。

**Tailwind**: 原子化优先，动态类用 `cn()` 合并，响应式遵循 Mobile First。

**GSAP 动画**: 必须使用 `useGsap` composable，动画包裹在 `ctx.add(() => { ... })` 中自动清理。

**Prettier**: 无分号、单引号、2 空格缩进、trailing comma。

## Zod 类型共享

共享包定义 Schema → 前端 `toTypedSchema(Schema)` + 后端 `createZodDto(Schema)` → 类型自动推断。

## API 响应格式

```typescript
interface ApiResponse<T> { success: boolean; data: T; message?: string; timestamp: string }
```

## 测试规范

- **前端**: Vitest + Happy DOM，`@vue/test-utils`，文件在 `apps/frontend/tests/`
- **后端**: Vitest + Node，`@nestjs/testing`，文件在 `apps/backend/tests/`
- **命令**: `pnpm test` / `pnpm test:watch` / `pnpm test:coverage`

## 后端关键功能

- **缓存**: `@Cacheable()` 装饰器，TTL 常量：`CacheableTTL.FIVE_MINUTES` / `ONE_HOUR` 等
- **WebSocket**: `EventsGateway`，`broadcastToRoom()` / `broadcastToAll()`
- **任务队列**: BullMQ + Redis，`InjectQueue('scheduled-tasks')`
- **Swagger**: `http://localhost:3000/api/docs`
- **邮件**: `MailService.sendVerificationCode()` / `sendPasswordReset()`
- **文件上传**: `StorageService.upload()` / `uploadMany()` / `delete()`，S3/OSS/MinIO

## 跨端与部署

- **Capacitor**: `pnpm cap:sync` / `cap:open:ios` / `cap:run:android`
- **Electron**: `pnpm electron:dev` / `electron:build:mac`
- **Docker**: `docker compose up -d`（含健康检查、资源限制、安全配置）

## 注意事项

- 共享包修改后需 `pnpm --filter @my-app/shared build`
- 前端 `zod` 必须显式声明
- 开发前启动 `docker compose up postgres redis -d`，首次运行 `pnpm db:push`
- 认证：accessToken + refreshToken，非 GET 请求携带 CSRF Token
- 限流：1s/3次、10s/20次、1min/100次
- 代码修改后必须运行 `pnpm lint` 和 `pnpm test`