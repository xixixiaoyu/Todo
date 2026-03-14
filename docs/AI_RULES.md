# AI 开发规范（Todo Monorepo）

本文件用于约束 AI 在本仓库内的开发行为，确保产出可维护、可测试、可交付。

## 适用范围与优先级

- 适用范围：本仓库（`apps/backend`、`apps/frontend`、`apps/wails`、`packages/shared`）全部代码与文档变更
- 指令优先级：系统/平台级指令 > 仓库级代理指令（如 `AGENTS.md`）> 本文件 > 其他普通说明
- 文档冲突处理：同级规则冲突时，以“更具体、更新日期更晚、改动影响更小”的规则优先

## 项目概览

Lumina（简思）是基于 **NestJS 11（Fastify） + Vue 3.5（Vite） + Three.js** 的全栈 Todo 应用，采用 **pnpm Monorepo + Turborepo** 组织与编排任务。开发环境默认使用 `pnpm docker:dev` 启动全栈 Docker 容器。

## 工具链与版本

- Node：`>= 20.19.0`（推荐使用 corepack）
- pnpm：`>= 9.15.0`（仓库锁定 `pnpm@9.15.0`）
- 任务编排：Turborepo（根目录 `pnpm <task>` 会分发到各 workspace）

## 强制规则（MUST）

- 任何会影响行为的变更必须补齐/更新测试；无测试支撑的行为改动不交付
- 纯格式化/不改行为的重构可不新增测试，但必须保证既有测试与质量门禁全绿
- 代码风格遵循项目约定：2 空格、单引号、无分号，TypeScript 严格类型，禁止 `any`
- 只在必要时新增文件；优先复用既有模块与模式，保持改动面最小
- “最小化修改”不等于拒绝必要重构；当且仅当为修复根因且有充分测试/验证支撑时，可进行边界清晰的局部重构
- 依赖版本必须使用精确版本（移除 `^`/`~`），workspace 依赖保留 `workspace:*`
- 修改 `packages/shared` 后，必须先执行 `pnpm --filter @lumina/shared build` 再验证下游
- 不引入会泄露密钥/隐私的日志与代码；不在仓库内写入任何密钥
- 变更完成后必须通过：`pnpm lint`、`pnpm test`、`pnpm type-check`
- 破坏性清理命令仅在明确要求时执行（如 `pnpm docker:prune`）

## 建议规则（SHOULD）

- 优先小步提交、可审阅改动（Small PR 风格）
- 优先在既有目录与架构中扩展，避免平行实现
- 优先修复根因，避免仅在表层绕过问题
- 说明变更时优先给出“行为变化 + 验证方式 + 风险边界”

## 目录结构

```txt
apps/backend/     # NestJS 后端（Business Brain）
apps/frontend/    # Vue 3 前端（Web Core）
apps/wails/       # Wails（Go）桌面端（Native Shell）
packages/shared/  # 共享包（Zod Schemas, DTOs, Utils）
```

## 架构原则（Thin Shell, Thick Brain）

- 职责分工
  - 前端（Vue）：界面与交互、状态管理、请求编排、可视化与动效
  - 后端（NestJS）：领域逻辑、鉴权、持久化、任务队列、实时通信
  - 原生壳（Wails/Capacitor）：系统级能力（托盘、快捷键、文件、窗口）
- 通信策略
  - 业务流（Vue ↔ NestJS）：标准 HTTPS/WS 直连，不经原生层转发
  - 原生流（Vue ↔ Wails/Capacitor）：仅在调用系统能力时走 JS Bridge

## 依赖边界（防止跨层污染）

- `packages/shared` 必须保持可移植与无副作用：
  - 不依赖前端/后端实现
  - 不访问运行时环境（如 `window`、`document`）
  - 不读取 `process.env` 做业务分支
  - 不在模块顶层产生副作用
- `apps/frontend` 只能依赖 `packages/shared` 与前端自身模块，不引入后端私有实现
- `apps/backend` 只能依赖 `packages/shared` 与后端自身模块，不引入前端私有实现
- `apps/wails` 只承载原生能力与桥接，不承载业务规则

## 工作流（AI 执行顺序）

1. Synthesis：快速确认需求边界与隐含约束，优先查阅代码现状而非凭空假设
2. Modeling：抽象最小数据流与接口，先定 DTO/Schema/返回结构，再写业务实现
3. Execution：按既有模式落地，避免跨层调用，优先可审阅的小步改动
4. Refinement：自检与重构，收敛重复逻辑，补边界测试，确保质量门禁通过

## TypeScript 与代码风格

- 统一使用 2 空格、单引号、无分号；保持与仓库 ESLint/Prettier 一致
- 类型优先：用类型表达约束与状态，宁可显式定义，也不要 `any`
- 错误处理：对外暴露的失败必须可预期（可辨别、可恢复或可提示）
- 导入约定

```ts
import { xxx } from '@lumina/shared'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
```

## 共享契约（Zod → DTO → 类型推断）

- 共享包定义 Schema，前端用 `toTypedSchema(Schema)`，后端用 `createZodDto(Schema)`
- 共享类型变更必须同步影响前后端，避免运行时漂移
- 公共契约调整时，必须同步更新测试与（如需要）迁移说明

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
- `@lumina/shared` 当前导出的 `ApiResponse<T>` 为兼容类型（`success/data/message?/timestamp`），可视为上述响应的子集/超集使用

## 国际化（i18n）

- 前后端语言资源分离管理
- 新增文案必须中英文同步，禁止硬编码 UI 文本
- 约定：枚举值大写蛇形；UI 文本小写驼峰

## 前端规范（Vue 3.5 + Vite + Pinia）

- 组织方式：Feature-based Modularization
  - `src/features/<feature>/{api,stores,components,composables,views}`
  - `src/services/` 放跨 feature 的抽象服务（如 AI、原生桥接）
  - `src/composables/` 放全局可复用组合式函数
- 状态管理：优先 Pinia；需要持久化时使用 `pinia-plugin-persistedstate`
- 数据请求：优先 TanStack Query 管理缓存与并发；Axios 只做传输层封装
- 组件约定：`<script setup lang="ts">` → `<template>` → `<style>`，Composition API 优先

## UI 与交互规范（Tailwind 3.4 + Reka UI + GSAP + Three.js）

- 布局：Mobile First；优先 Flex/Grid，避免硬编码尺寸；关键容器使用 `mx-auto` + `max-w-*`
- 视觉：留白与呼吸感优先；圆角设计遵循 `--radius: 0.75rem`
- 动效：必须使用 `useGsap`，并将动画包裹在 `ctx.add(() => { ... })` 内确保自动清理
- 3D 交互：利用 Three.js 实现高性能 3D 动效（如 Pomodoro Earth），确保渲染性能与电力效率
- Tailwind：原子化优先；动态 class 通过 `cn()` 合并
- A11y：交互控件需可键盘操作、可聚焦、可读 label；状态变化需有可感知反馈

## 后端规范（NestJS 11 + Prisma + Redis + BullMQ）

- 分层：Controller 只处理协议层（DTO/鉴权/序列化），领域逻辑在 Service，持久化在 Prisma 层封装
- 数据一致性：写操作优先事务；避免在请求链路中做不可控的外部副作用
- 鉴权：accessToken + refreshToken；需要认证的接口使用 `Authorization: Bearer <accessToken>`
- Cookie 规则：仅 OAuth 回调路径会从 Cookie 提取 accessToken，其余接口不接受 Cookie 认证
- 安全约束：除 `GET/HEAD/OPTIONS` 外，必须携带 `X-Requested-With: XMLHttpRequest`
- 限流：默认策略（1s/10、10s/50、1min/100），可通过 `THROTTLE_*` 环境变量覆盖
- 缓存：仅缓存确定性且可失效的数据；TTL 统一用常量（如 `CacheableTTL.FIVE_MINUTES`）
- 实时通信：通过 `EventsGateway` 广播，避免在业务层散落 Socket 逻辑
- 任务队列：BullMQ + Redis；耗时/可重试工作进入队列，避免阻塞请求
- 日志：只打印排障必要信息；禁止输出 token、cookie、邮箱验证码等敏感数据

## 测试规范（Vitest）

- 前端：Vitest + Happy DOM + `@vue/test-utils`，测试文件在 `apps/frontend/tests/`
- 后端：Vitest + Node + `@nestjs/testing`，测试文件在 `apps/backend/tests/`，配置使用 `vitest.config.mts`
- 共享包：Vitest + Node，测试文件在 `packages/shared/src/**/*.spec.ts`
- 覆盖率：`@vitest/coverage-v8`，报告输出 `text`、`json`、`html`
- 常用命令：`pnpm test` / `pnpm test:watch` / `pnpm test:coverage`
- 运行单个文件：
  - 使用 `pnpm --filter <package> test -- <relative_path>`
  - 路径需相对于包目录（如 `tests/features/foo.spec.ts`），不要包含 `apps/frontend/` 等前缀
  - 示例：`pnpm --filter @lumina/frontend test -- tests/features/ai/services/aiServiceParams.spec.ts`

## 服务端入口

- Swagger：`http://localhost:3000/api/docs`
- Health Check：`http://localhost:3000/api/health/liveness`

## 代理与跨域

- Docker 开发时前端容器通过 `VITE_PROXY_TARGET` 配置代理目标（通常为 `http://backend:3000`）
- 部署时确保前端域名与后端 CORS 配置一致
- 后端接口统一 `/api` 前缀

## 跨端规范（Wails/Capacitor）

- 原生层只提供能力，不承载业务决策
- 原生接口必须可降级：前端需对桥接调用失败进行可恢复处理

## 常用命令（按场景）

```bash
# 本地研发
pnpm dev
pnpm docker:dev

# 质量门禁（必须通过）
pnpm lint
pnpm test
pnpm type-check

# 可选质量辅助
pnpm format
pnpm format:check
pnpm test:watch
pnpm test:coverage

# 数据库
pnpm db:generate
pnpm db:push
pnpm db:migrate
pnpm db:studio

# Docker 生产编排
pnpm docker:build
pnpm docker:up
pnpm docker:down
pnpm docker:logs
pnpm docker:clean

# Docker 开发编排
pnpm docker:dev:ps
pnpm docker:dev:logs
pnpm docker:dev:restart
pnpm docker:dev:down
pnpm docker:dev:clean

# Wails
pnpm wails:dev
pnpm wails:build
pnpm wails:deploy

# 破坏性操作（仅在明确要求时）
pnpm docker:prune
```

## 环境与依赖（Docker 开发流）

- 开发默认在 `pnpm docker:dev` 下运行，命令执行需考虑容器网络与端口映射
- 共享包修改后需先构建：`pnpm --filter @lumina/shared build`
- 前端 `zod` 需显式声明
- 若容器状态异常：优先 `pnpm docker:dev:restart`，仍异常再 `pnpm docker:dev:clean`

## 交付标准（Definition of Done）

- 功能完整：覆盖主路径与关键边界条件，交互与状态一致
- 兼容性：不破坏既有 API/Schema/存量数据（必要时提供迁移）
- 可观测：错误可定位（语义化错误码/信息），不打印敏感信息
- 可维护：遵循既有架构、命名、文件组织；无重复实现
- 质量门禁：`pnpm lint`、`pnpm test`、`pnpm type-check` 全绿

## 工程人格与执行风格（Persona Mapping）

- 行为基调：博学、严谨、务实；以最简路径拆解复杂问题，优先解释“为什么”
- 工程标准：坚持最佳实践、拒绝 Hack、默认防御式编程、遵循 SOLID、严禁跨层调用
- 代码美学：逻辑扁平、剔除冗余、强类型优先（禁止 `any`）、遵循 2 空格/单引号/无分号
- 视觉要求：UI 遵循系统化比例与 CSS 变量规范，兼顾精致交互、性能优化与 A11y
- 执行流程：Synthesis & Trade-off → Modeling → Execution → Refinement
- 冲突处理：若 Persona 细则与本文件其他工程规则冲突，以本文件“强制规则（MUST）”与架构边界为准

## AI 交付清单（提交前自检）

- 是否严格遵守依赖边界，未引入跨层污染
- 是否补齐了受影响行为的测试
- 是否同步更新了共享契约、类型与调用方
- 是否验证了 API 响应结构与错误语义
- 是否完成并记录质量门禁结果（`lint/test/type-check`）
- 是否确认未引入敏感信息日志与密钥
