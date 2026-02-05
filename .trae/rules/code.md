# 项目上下文

基于 **NestJS 11 + Vue 3.5** 的全栈 Todo 应用，采用 **pnpm Monorepo** 架构。当前开发环境统一使用 `pnpm docker:dev` 启动的全栈 Docker 容器环境。

## 核心原则

1. **直击本质**: 优先解释“为什么”而非仅仅是“是什么”。
2. **代码哲学**:
   - **JS/TS 规范**: 2 空格缩进、单引号、无分号。
   - **模块化**: 遵循 SOLID 原则。保持组件与服务单一职责，优先依赖抽象 (Interface/Type) 而非具象。
   - **现代性**: 优先使用 ES6+ 语法及类型安全 (TS) 的最佳实践，严禁 `any`。
3. **测试驱动 (TDD Mindset)**: **任何**逻辑的新增或修改都必须伴随相应的测试用例。没有测试支撑的代码被视为不可靠的代码。

## 开发工作流

1. **Contextual Synthesis (上下文综合)**: 深入理解需求背景、限制及项目上下文，识别隐藏的边界条件。
2. **Logic Architecture (逻辑建模)**: 在脑中构建最简路径。结合最佳实践选择最优方案，预判测试点。
3. **Implementation & Testing (精准实现与测试)**:
   - 编写或修改业务逻辑的同时，**必须同步新增或更新对应的单元测试**。
   - 确保测试覆盖了核心逻辑、边界情况 (Edge Cases) 以及潜在的异常路径。
4. **Verification & Refinement (验证与精炼)**:
   - **运行测试**: 确保所有新增及既有测试全部通过。
   - **自我修正**: 对照“代码哲学”自检，清理无用变量、冗余注释，确保代码与测试同样优雅。

## 项目结构

```
apps/backend/     # NestJS 后端 (Business Brain)
apps/frontend/    # Vue 3 前端 (Web Core)
apps/wails/       # Wails (Go) 桌面端 (Native Shell)
packages/shared/  # 共享包 (Zod Schemas, DTOs, Utils)
```

## 架构哲学

**Thin Native Shell + Thick Cloud Brain** (轻原生壳 + 重云端大脑)

- **职责分工**:
  - **UI 层 (Vue 3)**: 界面展示、交互逻辑、Pinia 状态管理。采用 **Feature-based Modularization** (基于功能的模块化)。
  - **原生壳 (Wails/Capacitor)**: 系统托盘、全局快捷键、本地文件、窗口控制。
  - **业务大脑 (NestJS)**: 数据库 (Prisma)、用户认证、多端同步、AI 逻辑。
- **通信策略**:
  - **业务流 (Vue ↔ NestJS)**: 标准 HTTPS/WS 直接通信，不经原生层转发，确保多端高度复用。
  - **原生流 (Vue ↔ Wails/Capacitor)**: 仅在调用系统底层功能时使用 JS Bridge (`window.go...` 或插件)。

## 技术栈

**前端**: Vue 3.5+ / Vite 7 / Pinia / Tailwind 4 / GSAP / TanStack Query + Axios / VeeValidate + Zod / Vue I18n / Reka UI (Headless)
**跨端**: Capacitor 8 / Wails 2.11 / PWA
**后端**: NestJS 11+ / PostgreSQL 16 & SQLite + Prisma 7 / Redis (ioredis 5.8+) + BullMQ / JWT + Passport / nestjs-zod / Socket.IO
**工具**: pnpm 9.15+ / Turbo 2.7+ / ESLint 9 / Vitest

## 前端架构

- **目录结构**:
  - `src/features/`: 按业务功能划分（如 `auth`, `todo`）。每个 feature 包含自己的 `api`, `stores`, `components`, `composables`, `views`。
  - `src/services/`: 抽象公共服务层，如 AI 核心逻辑 (`services/ai/`)、原生能力对接 (`services/native.ts`)。
  - `src/composables/`: 全局可复用的组合式函数，如 `useGsap` (动画), `useSocket` (即时通讯), `useMarkdown` (渲染)。
- **状态管理**: 优先使用 Pinia。持久化存储使用 `pinia-plugin-persistedstate`。
- **UI 组件**: 基于 Tailwind 4 + Reka UI。

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
pnpm --filter @my-app/backend db:switch <sqlite|postgres> # 切换数据库类型
pnpm db:push                          # 推送 Schema 到数据库
pnpm lint && pnpm format              # 代码检查与格式化
pnpm --filter @my-app/shared build    # 构建共享包
pnpm test                             # 运行测试
pnpm wails:dev                        # 启动 Wails 开发模式
pnpm wails:build                      # 打包 Wails 应用
pnpm docker:dev                              # 启动开发环境 (后台运行)
pnpm docker:dev:logs                         # 查看实时日志 (F-follow)
pnpm docker:dev:ps                           # 查看容器运行状态
pnpm docker:dev:restart                      # 重启前后端服务 (更新依赖后常用)
pnpm docker:dev:down                         # 停止并移除容器
pnpm docker:dev:clean                        # 清理容器、镜像及卷 (重置环境)
pnpm docker:prune                            # 清理系统中无用的 Docker 镜像与 volume
docker compose up postgres redis -d          # 仅启动数据库与缓存
docker compose up -d                         # 启动生产模式完整栈
pnpm docker:build                            # 手动构建生产镜像
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

**前端** (`apps/frontend/src/i18n/`): Vue I18n + TypeScript (`MessageSchema`)，切换优先级：`localStorage` → 浏览器语言 → `zh-CN` (Fallback)

**后端** (`apps/backend/src/i18n/`): NestJS I18n + JSON 格式，Fallback 为 `en-US`

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

- **数据库策略**: 双驱动支持。本地开发默认使用 **SQLite** 以实现零配置启动；生产环境或高级特性支持 **PostgreSQL**。通过 `PrismaService` 动态识别 `DATABASE_URL` 加载驱动。
- **缓存**: `@Cacheable()` 装饰器，TTL 常量：`CacheableTTL.FIVE_MINUTES` / `ONE_HOUR` 等
- **WebSocket**: `EventsGateway`，`broadcastToRoom()` / `broadcastToAll()`
- **任务队列**: BullMQ + Redis，`InjectQueue('scheduled-tasks')`
- **Swagger**: `http://localhost:3000/api/docs`
- **Health Check**: `http://localhost:3000/api/health/liveness`
- **邮件**: `MailService.sendVerificationCode()` / `sendPasswordReset()`
- **文件上传**: `StorageService.upload()` / `uploadMany()` / `delete()`，S3/OSS/MinIO

## 跨端与部署

- **适配路径**: UI 与业务逻辑 90% 复用。进军移动端时，仅需使用 Capacitor 替换 Wails 原生层实现。
- **Capacitor**: `pnpm cap:sync` / `cap:open:ios` / `cap:run:android`
- **Wails**: `pnpm wails:dev` / `pnpm wails:build`
- **Docker 开发流**:
  - **环境启动**: 先执行 `pnpm install` 及 `pnpm --filter @my-app/shared build`，再运行 `pnpm docker:dev`。
  - **热更新**: 挂载宿主机目录到容器，`apps/` 代码修改将触发 `nest start --watch` 或 `vite` 的热重载。
  - **依赖同步**: 若 `package.json` 变动，需执行 `pnpm docker:dev:restart` 重新触发容器内依赖检查。
  - **数据库推送**: 容器启动后，首次运行需执行 `pnpm db:push` 以同步 Schema 到 PostgreSQL。
- **Docker 生产部署**:
  - **多阶段构建**: 使用 `Dockerfile` 进行生产级构建，最小化镜像体积。
  - **一键部署**: `docker compose up -d`（含健康检查、资源限制、安全配置）。

## 注意事项

- **环境声明**: 当前开发环境通过 `pnpm docker:dev` 运行，所有命令执行需考虑容器环境（如数据库连接、端口映射等）。
- **版本锁定**: 所有依赖必须使用 **精确版本** (移除 `^` 和 `~`)，以确保环境一致性。Workspace 内部引用保留 `workspace:*`。
- 共享包修改后需 `pnpm --filter @my-app/shared build`
- 前端 `zod` 必须显式声明
- **环境重置**: 若遇到容器状态异常或数据库数据冲突，请运行 `pnpm docker:dev:clean`。
- **数据库同步**: 开发前若不使用全栈 Docker 环境，需手动启动 `docker compose up postgres redis -d`，并执行 `pnpm db:push`。
- **Docker 代理**: 前端容器通过 `VITE_PROXY_TARGET` 环境变量动态配置 Vite 代理目标（通常指向 `http://backend:3000`）。
- **API 前缀**: 后端所有接口均带有 `/api` 前缀（包括 Swagger 和健康检查）。
- **认证**：accessToken + refreshToken，非 GET 请求携带 Authorization 头
- 限流：1s/10次 (Short)、10s/50次 (Medium)、1min/100次 (Long)
- 代码修改后必须运行 `pnpm lint` 和 `pnpm test`
- 部署时请确保前端域名与后端跨域配置 ( CORS ) 一致。