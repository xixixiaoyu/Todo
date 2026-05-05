# AGENTS — Lumina 工程规范（SSOT）

本文件是仓库内 AI 开发行为的单一规范源。在 `/Users/yunmu/Desktop/Todo` 下执行任何任务前，必须先阅读本文。

**优先级**：系统/平台级指令 > 本文 > 其他普通说明。同级规则冲突时，以「更具体、更新、改动影响更小」者优先。中文章节为权威版本。

**工程人格**：博学、严谨、务实。工作流：Synthesis → Modeling → Execution → Refinement。先给结论再展开原因，先指架构问题再说语法细节。

---

## 1. 项目概览

Lumina（简思）是基于 **NestJS 11（Fastify） + Vue 3.5（Vite） + Three.js** 的全栈 Todo 应用，采用 **pnpm Monorepo + Turborepo** 编排。开发环境默认 `pnpm docker:dev`。

| 工具 | 版本要求 |
|------|---------|
| Node | `>= 20.19.0`（推荐 corepack） |
| pnpm | `>= 9.15.0`（仓库锁定 `9.15.0`） |

---

## 2. 目录与架构

```
apps/backend/     # NestJS 后端 — 领域逻辑、鉴权、持久化、队列、实时通信
apps/frontend/    # Vue 3 前端 — 界面/交互、状态管理、请求编排、动效
apps/wails/       # Wails（Go）桌面壳 — 系统级能力（托盘、快捷键、文件、窗口）
packages/shared/  # 共享契约 — Zod Schema、DTO、工具函数
```

### 2.1 架构原则（Thin Shell, Thick Brain）

- **业务流**（Vue ↔ NestJS）：标准 HTTPS/WS 直连，不经原生层转发
- **原生流**（Vue ↔ Wails）：仅在调用系统能力时走 JS Bridge
- 原生壳只承载能力与桥接，不承载业务规则

### 2.2 依赖边界

| 包 | 允许依赖 | 禁止 |
|----|---------|------|
| `packages/shared` | 无外部依赖 | 前端/后端实现、`window`/`document`、`process.env` 业务分支、模块顶层副作用 |
| `apps/frontend` | `@lumina/shared` + 自身模块 | 后端私有实现 |
| `apps/backend` | `@lumina/shared` + 自身模块 | 前端私有实现 |
| `apps/wails` | 原生能力 + 桥接 | 业务规则 |

---

## 3. 强制规则（MUST）

### 3.1 测试分级

| 影响面 | 要求 |
|--------|------|
| 共享契约（Schema/DTO/类型） | **必须**补齐测试，无测试不交付 |
| 后端业务逻辑（Service、持久化、鉴权） | **必须**补齐测试，无测试不交付 |
| 前端关键路径（状态管理、数据流、API 编排） | **必须**补齐测试 |
| 前端 UI 交互（纯样式/布局/动效） | 评估风险后酌情覆盖，低风险可免测 |

- 纯格式化/不改行为的重构可不新增测试，但必须保证既有测试与质量门禁全绿

### 3.2 代码风格

- 2 空格缩进、单引号、无分号；TypeScript 严格类型，禁止 `any`，优先 `interface`
- 导入约定：

```ts
import { xxx } from '@lumina/shared'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
```

### 3.3 变更约束

- 只在必要时新增文件；优先复用既有模块与模式
- 「最小化修改」不等于拒绝必要重构——有充分测试支撑时可做边界清晰的局部重构
- 依赖版本使用精确版本（移除 `^`/`~`），workspace 依赖保留 `workspace:*`
- 修改 `packages/shared` 后必须先 `pnpm --filter @lumina/shared build` 再验证下游
- 不引入泄露密钥/隐私的日志与代码；不在仓库内写入任何密钥
- 变更完成后必须通过 `pnpm ci:check` + `pnpm test`
- 破坏性清理命令（如 `pnpm docker:prune`）仅在明确要求时执行

### 3.4 建议规则（SHOULD）

- 小步提交、可审阅改动（Small PR 风格）
- 在既有目录与架构中扩展，避免平行实现
- 修复根因而非表层绕过
- 变更说明格式：「行为变化 + 验证方式 + 风险边界」

---

## 4. 技术规范

### 4.1 共享契约

- Zod Schema 定义在 `packages/shared`，前端 `toTypedSchema()`，后端 `createZodDto()`
- 共享类型变更必须同步前后端；契约调整必须同步更新测试

### 4.2 前端（Vue 3.5 + Vite + Pinia + TanStack Query）

- **组织**：Feature-based — `src/features/<feature>/{api,stores,components,composables,views}`
  - 跨 feature 抽象服务放 `src/services/`，全局 composable 放 `src/composables/`
- **状态**：优先 Pinia；持久化用 `pinia-plugin-persistedstate`
- **数据**：优先 TanStack Query 管理缓存与并发，Axios 仅做传输层
- **组件**：`<script setup lang="ts">` → `<template>` → `<style>`，Composition API 优先

### 4.3 UI 交互（Tailwind 3.4 + Reka UI + GSAP + Three.js）

- **布局**：Mobile First，优先 Flex/Grid，关键容器 `mx-auto` + `max-w-*`
- **视觉**：留白呼吸感优先，圆角 `--radius: 0.75rem`
- **动效**：必须使用 `useGsap`，动画包裹在 `ctx.add(() => { ... })` 内确保自动清理
- **3D**：Three.js 实现高性能 3D 动效，兼顾渲染性能与电力效率
- **样式**：Tailwind 原子化优先，动态 class 通过 `cn()` 合并
- **A11y**：适度即可——保留 `focus-visible` 焦点环与无视觉文本元素的 `sr-only`/`aria-label`，不要求显式键盘导航

### 4.4 后端（NestJS 11 + Prisma + Redis + BullMQ）

- **分层**：Controller（协议/DTO/鉴权/序列化）→ Service（领域逻辑）→ Prisma（持久化）
- **数据**：写操作优先事务；不在请求链路中做不可控外部副作用
- **鉴权**：`accessToken + refreshToken`，`Authorization: Bearer <accessToken>`，不接受 Cookie 认证
- **安全**：除 `GET/HEAD/OPTIONS` 外必须携带 `X-Requested-With: XMLHttpRequest`
- **限流**：默认 `1s/10, 10s/50, 1min/100`，可通过 `THROTTLE_*` 覆盖
- **缓存**：仅缓存确定性可失效数据，TTL 用常量（如 `CacheableTTL.FIVE_MINUTES`）
- **实时**：通过 `EventsGateway` 广播，不在业务层散落 Socket 逻辑
- **队列**：BullMQ + Redis，耗时/可重试工作入队，不阻塞请求
- **日志**：只打印排障必要信息，禁止输出 token、cookie、验证码等敏感数据

### 4.5 国际化（i18n）

- 前后端语言资源分离；新增文案中英文同步，禁止硬编码 UI 文本
- 约定：枚举值 `UPPER_SNAKE`，UI 文本 `lowerCamel`

### 4.6 跨端（Wails/Capacitor）

- 原生层只提供能力，不承载业务决策
- 前端需对桥接调用失败做可恢复处理

---

## 5. API 约定

### 5.1 响应格式

```ts
type ApiSuccessResponse<T> = { success: true; data: T; timestamp: string }
type ApiErrorResponse = { success: false; data: null; message: string; errors?: Record<string, string>; statusCode: number; timestamp: string }
type ApiResponse<T> = ApiSuccessResponse<T> | ApiErrorResponse
```

- 成功 → `TransformInterceptor` 包装，错误 → `AllExceptionsFilter` 包装
- 安全前置拦截（如缺 `X-Requested-With`）至少返回 `success/message/timestamp`
- `@lumina/shared` 导出的 `ApiResponse<T>` 为兼容类型

### 5.2 端点与代理

- Swagger：`http://localhost:3000/api/docs`
- Health：`http://localhost:3000/api/health/liveness`
- 后端接口统一 `/api` 前缀
- Docker 开发时前端通过 `VITE_PROXY_TARGET`（默认 `http://backend:3000`）代理

---

## 6. 测试

| 层 | 框架 | 测试位置 |
|----|------|---------|
| 前端 | Vitest + Happy DOM + `@vue/test-utils` | `apps/frontend/tests/` |
| 后端 | Vitest + Node + `@nestjs/testing` | `apps/backend/tests/`（配置 `vitest.config.mts`） |
| 共享包 | Vitest + Node | `packages/shared/src/**/*.spec.ts` |

- 覆盖率：`@vitest/coverage-v8`，输出 `text/json/html`
- 运行单文件：`pnpm --filter <package> test -- <相对包目录的路径>`
  - 例：`pnpm --filter @lumina/frontend test -- tests/features/ai/services/aiServiceParams.spec.ts`

---

## 7. 常用命令

```bash
# 研发
pnpm dev                      # 本地开发
pnpm docker:dev               # Docker 全栈开发

# 质量门禁（提交前必须通过）
pnpm ci:check
pnpm test

# 辅助
pnpm lint / lint:strict       # Lint
pnpm format / format:check    # 格式化
pnpm test:watch / test:coverage

# 数据库
pnpm db:generate / db:push / db:migrate / db:studio

# Docker
pnpm docker:build / docker:up / docker:down / docker:logs / docker:clean
pnpm docker:dev:ps / docker:dev:logs / docker:dev:restart / docker:dev:down / docker:dev:clean

# Wails
pnpm wails:dev / wails:build / wails:deploy

# 破坏性（仅在明确要求时执行）
pnpm docker:prune
```

> 共享包修改后先构建：`pnpm --filter @lumina/shared build`。容器异常时优先 `docker:dev:restart`，仍异常再 `docker:dev:clean`。

---

## 8. 交付标准（Definition of Done）

- **功能完整**：覆盖主路径与关键边界条件
- **兼容**：不破坏既有 API/Schema/存量数据（必要时提供迁移）
- **可观测**：错误可定位，不打印敏感信息
- **可维护**：遵循既有架构、命名、文件组织，无重复实现
- **门禁通过**：`pnpm ci:check` + `pnpm test` 全绿

## 9. AI 交付自检清单

- [ ] 严格遵守依赖边界，未引入跨层污染
- [ ] 按分级规则补齐受影响行为的测试（共享层/后端业务逻辑必须，前端 UI 酌情）
- [ ] 同步更新共享契约、类型与调用方
- [ ] 验证 API 响应结构与错误语义
- [ ] 质量门禁通过（`ci:check` / `test`）
- [ ] 未引入敏感信息日志与密钥
