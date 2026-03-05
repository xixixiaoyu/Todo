# AI 开发规范（Todo Monorepo）

本文件用于约束 AI 在本仓库内的开发行为，确保产出可维护、可测试、可交付。

## 项目概览

Lumina（简思）是基于 **NestJS 11（Fastify） + Vue 3.5（Vite） + Three.js** 的全栈 Todo 应用，采用 **pnpm Monorepo + Turborepo** 组织与编排任务。开发环境默认使用 `pnpm docker:dev` 启动全栈 Docker 容器。

## 工具链与版本

- Node：>= 20.19.0（推荐使用 corepack）
- pnpm：>= 9.15.0（仓库锁定 `pnpm@9.15.0`）
- 任务编排：Turborepo（根目录 `pnpm <task>` 会分发到各 workspace）

## 必须遵守（不可妥协）

- 任何会影响行为的变更必须补齐/更新测试；没有测试支撑的改动不交付
- 纯格式化/不改行为的重构可不新增测试，但必须保证既有测试与质量门禁全绿
- 代码风格遵循项目约定：2 空格、单引号、无分号，TypeScript 严格类型，禁止 `any`
- 只在必要时新增文件；优先复用既有模块与模式，保持改动面最小
- 依赖版本必须使用精确版本（移除 `^`/`~`），workspace 依赖保留 `workspace:*`
- 修改 `packages/shared` 后必须先执行 `pnpm --filter @my-app/shared build` 再验证下游
- 不引入会泄露密钥/隐私的日志与代码；不在仓库内写入任何密钥
- 变更完成后必须通过：`pnpm lint`、`pnpm test`、`pnpm type-check`
- 破坏性清理命令仅在明确要求时执行（如 `pnpm docker:prune`）

## 目录结构

```
apps/backend/     # NestJS 后端（Business Brain）
apps/frontend/    # Vue 3 前端（Web Core）
apps/wails/       # Wails（Go）桌面端（Native Shell）
packages/shared/  # 共享包（Zod Schemas, DTOs, Utils）
```

## 架构原则（Thin Shell, Thick Brain）

- **职责分工**
  - **前端（Vue）**：界面与交互、状态管理、请求编排、可视化与动效
  - **后端（NestJS）**：领域逻辑、鉴权、持久化、任务队列、实时通信
  - **原生壳（Wails/Capacitor）**：系统级能力（托盘、快捷键、文件、窗口）
- **通信策略**
  - **业务流（Vue ↔ NestJS）**：标准 HTTPS/WS 直连，不经原生层转发
  - **原生流（Vue ↔ Wails/Capacitor）**：仅在调用系统能力时走 JS Bridge

## 依赖边界（防止跨层污染）

- `packages/shared` 必须保持可移植与无副作用：不依赖前端/后端实现，不访问运行时环境（如 `window`、`document`），不读取 `process.env` 做业务分支，不在模块顶层产生副作用
- `apps/frontend` 只能依赖 `packages/shared` 与前端自身模块，不引入后端私有实现
- `apps/backend` 只能依赖 `packages/shared` 与后端自身模块，不引入前端私有实现
- `apps/wails` 只承载原生能力与桥接，不承载业务规则

## 交付标准（Definition of Done）

- 功能完整：覆盖主路径与关键边界条件，交互与状态一致
- 兼容性：不破坏既有 API/Schema/存量数据（必要时提供迁移）
- 可观测：错误可定位（语义化错误码/信息），不打印敏感信息
- 可维护：遵循既有架构、命名、文件组织；无重复实现
- 质量门禁：`pnpm lint`、`pnpm test`、`pnpm type-check` 全绿

## 工作流（AI 执行顺序）

- **Synthesis**：快速确定需求边界与隐含约束，优先查阅代码现状而非凭空假设
- **Modeling**：抽象最小数据流与接口；先定 DTO/Schema/返回结构，再写业务实现
- **Execution**：按既有模式落地，避免跨层调用；优先小 PR 风格的可审阅改动
- **Refinement**：自检与重构；收敛重复逻辑，补边界测试，确保质量门禁通过

## TypeScript 与代码风格

- 统一使用 2 空格、单引号、无分号；保持与仓库 ESLint/Prettier 一致
- 类型优先：用类型表达约束与状态，宁可显式定义，也不要 `any`
- 错误处理：对外暴露的失败必须可预期（可辨别、可恢复或可提示）
- 导入约定

```ts
import { xxx } from '@my-app/shared'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
```

## 共享契约（Zod → DTO → 类型推断）

- 共享包定义 Schema，前端用 `toTypedSchema(Schema)`，后端用 `createZodDto(Schema)`
- 共享类型的变更必须同步影响前后端，避免运行时漂移

## API 响应格式

```ts
type ApiSuccessResponse<T> = {
  success: true
  data: T
  timestamp: string
}

type ApiErrorResponse = {
  success: false
  data: null
  message: string
  errors?: Record<string, string>
  statusCode: number
  timestamp: string
}

type ApiResponse<T> = ApiSuccessResponse<T> | ApiErrorResponse
```

- 成功响应由后端 `TransformInterceptor` 统一包装：`{ success: true, data, timestamp }`
- 错误响应由后端 `AllExceptionsFilter` 统一包装：`{ success: false, data: null, message, errors?, statusCode, timestamp }`
- 安全前置拦截（如缺失 `X-Requested-With`）可能返回最小错误体：至少包含 `success/message/timestamp`
- `@my-app/shared` 当前导出的 `ApiResponse<T>` 为兼容类型（`success/data/message?/timestamp`），可视为上述响应的子集/超集使用

## 国际化（i18n）

- 前后端语言资源分离管理
- 新增文案必须中英文同步，禁止硬编码 UI 文本
- 约定：枚举值大写蛇形；UI 文本小写驼峰

## 前端规范（Vue 3.5 + Vite + Pinia）

- **组织方式**：Feature-based Modularization
  - `src/features/<feature>/{api,stores,components,composables,views}`
  - `src/services/` 放跨 feature 的抽象服务（如 AI、原生桥接）
  - `src/composables/` 放全局可复用组合式函数
- **状态管理**：优先 Pinia；需要持久化时使用 `pinia-plugin-persistedstate`
- **数据请求**：优先 TanStack Query 管理缓存与并发；Axios 只做传输层封装
- **组件约定**：`<script setup lang="ts">` → `<template>` → `<style>`，Composition API 优先

## UI 与交互规范（Tailwind 3.4 + Reka UI + GSAP + Three.js）

- **布局**：Mobile First；优先 Flex/Grid，避免硬编码尺寸；关键容器使用 `mx-auto` + `max-w-*`
- **视觉**：留白与呼吸感优先；圆角设计遵循 `--radius: 0.75rem`
- **动效**：必须使用 `useGsap`，并将动画包裹在 `ctx.add(() => { ... })` 内确保自动清理
- **3D 交互**：利用 Three.js 实现高性能 3D 动效（如 Pomodoro Earth），确保渲染性能与电力效率
- **Tailwind**：原子化优先；动态 class 通过 `cn()` 合并
- **A11y**：交互控件需可键盘操作、可聚焦、可读 label；状态变化需有可感知反馈

## 后端规范（NestJS 11 + Prisma + Redis + BullMQ）

- **分层**：Controller 只处理协议层（DTO/鉴权/序列化），领域逻辑在 Service，持久化在 Prisma 层封装
- **数据一致性**：写操作优先事务；避免在请求链路中做不可控的外部副作用
- **鉴权**：accessToken + refreshToken；需要认证的接口使用 `Authorization: Bearer <accessToken>`
- **Cookie 规则**：仅 OAuth 回调路径会从 Cookie 提取 accessToken，其余接口不接受 Cookie 认证
- **安全约束**：除 `GET/HEAD/OPTIONS` 外，必须携带 `X-Requested-With: XMLHttpRequest`
- **限流**：默认策略（1s/10、10s/50、1min/100），可通过 `THROTTLE_*` 环境变量覆盖
- **缓存**：仅缓存确定性且可失效的数据；TTL 统一用常量（如 `CacheableTTL.FIVE_MINUTES`）
- **实时通信**：通过 `EventsGateway` 广播，避免在业务层散落 Socket 逻辑
- **任务队列**：BullMQ + Redis；耗时/可重试工作进入队列，避免阻塞请求
- **日志**：只打印排障必要信息；禁止输出 token、cookie、邮箱验证码等敏感数据

## 测试规范（Vitest）

- **前端**：Vitest + Happy DOM + `@vue/test-utils`，测试文件在 `apps/frontend/tests/`
- **后端**：Vitest + Node + `@nestjs/testing`，测试文件在 `apps/backend/tests/`，配置使用 `vitest.config.mts`
- **共享包**：Vitest + Node，测试文件在 `packages/shared/src/**/*.spec.ts`
- 覆盖率：`@vitest/coverage-v8`，报告输出 `text`、`json`、`html`
- 常用命令：`pnpm test` / `pnpm test:watch` / `pnpm test:coverage`
- 运行单个文件：
  - 使用 `pnpm --filter <package> test -- <relative_path>`
  - 注意：路径需相对于包目录（如 `tests/features/foo.spec.ts`），**不要包含** `apps/frontend/` 等前缀
  - 示例：`pnpm --filter @my-app/frontend test -- tests/features/ai/services/aiServiceParams.spec.ts`

## 服务端入口

- Swagger：`http://localhost:3000/api/docs`
- Health Check：`http://localhost:3000/api/health/liveness`

## 代理与跨域

- Docker 开发时前端容器通过 `VITE_PROXY_TARGET` 配置代理目标（通常为 `http://backend:3000`）
- 部署时确保前端域名与后端 CORS 配置一致

## 跨端规范（Wails/Capacitor）

- 原生层只提供能力，不承载业务决策
- 原生接口必须可降级：前端需对桥接调用失败进行可恢复处理

## 常用命令

```bash
pnpm dev                              # 同时启动前后端
pnpm docker:dev                       # Docker 开发（默认）

pnpm lint                             # 质量门禁：代码检查（必跑）
pnpm test                             # 质量门禁：运行测试（必跑）
pnpm type-check                       # 质量门禁：类型检查（必跑）
pnpm format                           # 可选：自动格式化（按需）

pnpm docker:up                        # Docker 生产编排：启动
pnpm docker:down                      # Docker 生产编排：停止
pnpm docker:logs                      # Docker 生产编排：日志
pnpm docker:clean                     # Docker 生产编排：清理（谨慎）

pnpm db:push                          # 推送 Schema 到数据库

# 单独校验命令（按需执行）
pnpm --filter @my-app/frontend lint
pnpm --filter @my-app/frontend test
pnpm --filter @my-app/frontend type-check

pnpm --filter @my-app/backend lint
pnpm --filter @my-app/backend test
pnpm --filter @my-app/backend type-check

pnpm --filter @my-app/shared build
pnpm --filter @my-app/shared lint
pnpm --filter @my-app/shared test
pnpm --filter @my-app/shared type-check

pnpm wails:dev
pnpm wails:build
pnpm docker:dev:logs
pnpm docker:dev:ps
pnpm docker:dev:restart
pnpm docker:dev:down
pnpm docker:dev:clean
pnpm docker:prune
pnpm docker:build
```

## 环境与依赖（Docker 开发流）

- 开发默认在 `pnpm docker:dev` 下运行，命令执行需考虑容器网络与端口映射
- 依赖版本必须使用精确版本（移除 `^`/`~`），workspace 依赖保留 `workspace:*`
- 共享包修改后需先构建：`pnpm --filter @my-app/shared build`
- 前端 `zod` 需显式声明
- 若容器状态异常：优先 `pnpm docker:dev:restart`，仍异常再 `pnpm docker:dev:clean`
- 后端接口统一 `/api` 前缀；Swagger：`http://localhost:3000/api/docs`
