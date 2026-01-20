# 项目上下文

基于 **NestJS 11 + Vue 3.5** 的全栈 Todo 应用，采用 **pnpm Monorepo** 架构。

## 项目结构

```
apps/backend/     # NestJS 后端
apps/frontend/    # Vue 3 前端
apps/wails/       # Wails (Go) 桌面端
packages/shared/  # 共享包（Zod Schema、DTO、工具函数）
```

## 架构哲学

**Thin Native Shell + Thick Cloud Brain** (轻原生壳 + 重云端大脑)

- **职责分工**:
  - **UI 层 (Vue 3)**: 界面展示、交互逻辑、Pinia 状态管理。
  - **原生壳 (Wails/Capacitor)**: 系统托盘、全局快捷键、本地文件、窗口控制。
  - **业务大脑 (NestJS)**: 数据库 (Prisma)、用户认证、多端同步、AI 逻辑。
- **通信策略**:
  - **业务流 (Vue ↔ NestJS)**: 标准 HTTPS/WS 直接通信，不经原生层转发，确保多端高度复用。
  - **原生流 (Vue ↔ Wails/Capacitor)**: 仅在调用系统底层功能时使用 JS Bridge (`window.go...` 或插件)。

## 技术栈

**前端**: Vue 3.5+ / Vite 7 / Pinia / Tailwind 3.4+ / GSAP / TanStack Query + Axios / VeeValidate + Zod / Vue I18n
**跨端**: Capacitor 8 / Wails 2.11 / PWA
**后端**: NestJS 11+ / PostgreSQL 16 + Prisma 7 / Redis (ioredis 5.8+) + BullMQ / JWT + Passport / nestjs-zod / Socket.IO
**工具**: pnpm 9.15+ / Turbo 2.7+ / ESLint 9 / Vitest

## 视觉设计

- **风格**: 现代简约，强调留白与呼吸感，追求精致的微交互。
- **色彩**: 温暖大地色系（Light）与低对比度深灰（Dark），支持自动切换。
- **字体**: 优先 `LXGW WenKai` (中文) 与 `JetBrains Mono` (等宽)，提升阅读体验。
- **形状**: 大圆角设计 (`--radius: 0.75rem`)，柔化视觉边界。
- **动效**: GSAP 驱动，响应迅速（<300ms），避免无意义的装饰性动画。

## 布局规范

- **响应式优先**: 坚持 Mobile First 原则，确保在不同设备（Mobile/Desktop/PWA）上均有极致的自适应体验。
- **灵活容器**: 核心内容推荐使用 `mx-auto` 居中并配合 `max-w-*` 限制，确保大屏下的视觉聚焦与阅读舒适度。
- **流式结构**: 优先采用 `Flexbox` 与 `Grid` 构建灵活布局，避免硬编码尺寸，保持界面的呼吸感与弹性。

## 常用命令

```bash
pnpm dev                              # 同时启动前后端
pnpm --filter @my-app/backend dev     # 仅后端 (localhost:3000)
pnpm --filter @my-app/frontend dev    # 仅前端 (localhost:5173)
pnpm db:push                          # 推送 Schema 到数据库
pnpm lint && pnpm format              # 代码检查与格式化
pnpm --filter @my-app/shared build    # 构建共享包
pnpm test                             # 运行测试
pnpm wails:dev                        # 启动 Wails 开发模式
pnpm wails:build                      # 打包 Wails 应用
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

**GSAP 动画**: 必须使用 `useGsap` composable，动画包裹在 `ctx.add(() => { ... })` 中自动清理。追求丝滑、快速的视觉体验，避免冗长拖沓。

**Prettier**: 无分号、单引号、2 空格缩进、trailing comma。

## 国际化 (i18n)

**架构**: 前后端分离，各自管理语言资源。

**前端** (`apps/frontend/src/i18n/`): Vue I18n + TypeScript (`MessageSchema`)，切换优先级：`localStorage` → 浏览器语言 → `en-US`

**后端** (`apps/backend/src/i18n/`): NestJS I18n + JSON 格式

**约定**:
- 枚举值大写蛇形，UI 文本小写驼峰
- 新增文案需中英文同步
- 禁止硬编码，统一使用 `t()`

## Zod 类型共享

共享包定义 Schema → 前端 `toTypedSchema(Schema)` + 后端 `createZodDto(Schema)` → 类型自动推断。

## API 响应格式

```typescript
interface ApiResponse<T> { success: boolean; data: T; message?: string; timestamp: string }
```

## 测试规范

- **前端**: Vitest + Happy DOM，`@vue/test-utils`，文件在 `apps/frontend/tests/`
- **后端**: Vitest + Node，`@nestjs/testing`，文件在 `apps/backend/tests/`，配置使用 `vitest.config.mts`
- **共享包**: Vitest + Node，文件在 `packages/shared/src/**/*.spec.ts`
- **覆盖率**: 统一使用 `@vitest/coverage-v8`，报告输出为 `text`、`json`、`html`
- **命令**: `pnpm test` / `pnpm test:watch` / `pnpm test:coverage`

## 后端关键功能

- **缓存**: `@Cacheable()` 装饰器，TTL 常量：`CacheableTTL.FIVE_MINUTES` / `ONE_HOUR` 等
- **WebSocket**: `EventsGateway`，`broadcastToRoom()` / `broadcastToAll()`
- **任务队列**: BullMQ + Redis，`InjectQueue('scheduled-tasks')`
- **Swagger**: `http://localhost:3000/api/docs`
- **邮件**: `MailService.sendVerificationCode()` / `sendPasswordReset()`
- **文件上传**: `StorageService.upload()` / `uploadMany()` / `delete()`，S3/OSS/MinIO

## 跨端与部署

- **适配路径**: UI 与业务逻辑 90% 复用。进军移动端时，仅需使用 Capacitor 替换 Wails 原生层实现。
- **Capacitor**: `pnpm cap:sync` / `cap:open:ios` / `cap:run:android`
- **Wails**: `pnpm wails:dev` / `pnpm wails:build`
- **Docker**: `docker compose up -d`（含健康检查、资源限制、安全配置）

## 开发策略

- **前后端交互限制**: 当前阶段，仅 **登录 (Login)** 与 **注册 (Register)** 相关功能与后端进行 API 交互。
- **前端优先原则**: 除认证功能外，所有新功能（如 Todo 管理、AI 助手、设置等）优先在前端完成逻辑开发与 UI 实现，暂不接入后端接口。

## 注意事项

- **版本锁定**: 所有依赖必须使用 **精确版本** (移除 `^` 和 `~`)，以确保环境一致性。Workspace 内部引用保留 `workspace:*`。
- 共享包修改后需 `pnpm --filter @my-app/shared build`
- 前端 `zod` 必须显式声明
- 开发前启动 `docker compose up postgres redis -d`，首次运行 `pnpm db:push`
- 认证：accessToken + refreshToken，非 GET 请求携带 CSRF Token
- 限流：1s/3次、10s/20次、1min/100次
- 代码修改后必须运行 `pnpm lint` 和 `pnpm test`