# AGENTS — Lumina 工程规范（AI-first）

本文件是仓库内 AI 开发行为的唯一规范源。所有任务开始前必须阅读本文。

---

## 1. 工具链

| 环节 | 工具 | 说明 |
|------|------|------|
| Runtime | **Bun 1.3+** | TypeScript 原生执行 |
| 包管理 | pnpm 9.15+ | workspace + turbo 编排 |
| Lint | **oxlint** | `.oxlintrc.json` |
| Format | **oxfmt** | `.oxfmtrc.json` |
| 类型检查 | **tsgo** (非 Vue) / **vue-tsc** (Vue) | 并行运行 |
| 测试 | Vitest + Happy DOM + vue-test-utils | |
| 依赖边界 | `bun scripts/check-boundaries.js` | |

---

## 2. 硬约束（违反即阻断）

### 2.1 禁止 `any`

```ts
// ❌ const data: any = await fetchUser()
// ✅ const data: UserDTO = await fetchUser()
// ❌ resolveCb(c.json({...}) as any)
// ✅ resolveCb(c.json({...}) as unknown as void)
```

唯一的例外：测试 mock 函数签名中允许 `vi.fn<any>()`。

### 2.2 禁止跨依赖边界

```
shared ← backend
shared ← frontend
backend → frontend  (反向同样禁止)
```

具体边界见 `scripts/check-boundaries.js`。CI 自动拦截。

### 2.3 禁止 `console.log`

允许 `console.warn` / `console.error`。后端和 sidecar 放行所有 console。

### 2.4 禁止 `cross-env` / `NODE_OPTIONS` 样板

Bun 跨平台原生处理环境变量。脚本中直接写命令即可：

```bash
# ❌ cross-env NODE_OPTIONS='--max-old-space-size=8192' vite
# ✅ vite
```

### 2.5 共享契约变更必须同步测试

修改 `packages/shared` 的 Schema/DTO/类型后，必须同时更新对应测试。

### 2.6 变更后必须通过门禁

`pnpm ci:check` + `pnpm test` 全绿后才能交付。

---

## 3. AI 高频失误清单

### 3.1 NestJS

| 失误 | 正确做法 |
|------|---------|
| Controller 里写业务逻辑 | 逻辑放 Service，Controller 只做协议适配 |
| 忘记 `@Injectable()` | 被注入的类必须有装饰器 |
| 在请求链路中做外部副作用 | 耗时/可重试工作入 BullMQ 队列 |
| 直接 `throw new Error()` | 使用 NestJS 异常类（`BadRequestException` 等） |
| 注入 Prisma 而非 Service | 跨模块调用必须走 Service 层 |

### 3.2 Vue 3

| 失误 | 正确做法 |
|------|---------|
| Composable 外使用 `ref()` / `computed()` | 响应式 API 只能在 `setup` 或 composable 内 |
| 忘记 `ref()` 包装 | 需要响应性的原始值用 `ref()`，对象用 `reactive()` 或 `ref()` |
| Props 解构丢失响应性 | 使用 `toRefs(props)` 或 `props.xxx` |

### 3.3 Prisma

| 失误 | 正确做法 |
|------|---------|
| N+1 查询 | 使用 `include` 预加载关联数据 |
| 忽略事务 | 多表写操作必须 `prisma.$transaction([...])` |
| 不校验唯一约束 | `create` 可能抛 `PrismaClientKnownRequestError` |

### 3.4 TypeScript

| 失误 | 正确做法 |
|------|---------|
| 用 `as any` 绕过类型错误 | 修复类型定义或使用 `as unknown as X` |
| 忽略 `Promise` 返回值 | 必须 `await` 或显式处理（oxlint 检查） |
| 重复导入同一模块 | 合并为单条 import（oxlint 警告） |
| 创建循环依赖 | 提取共享代码到独立模块（oxlint 警告） |

---

## 4. 变更工作流

### Step 1: 评估影响面（动手前）

- 这个改动影响哪几个包？
- 是否会被 `check-boundaries.js` 拦截？
- shared 是否变了？如果变了，重建 shared 后再验证下游

### Step 2: 修改

- 优先在既有文件中扩展，不新建文件
- 遵循已有命名、目录结构、代码风格（oxfmt 保证）
- 新增逻辑补齐测试（共享层/后端 Service 必须）

### Step 3: 验证

```bash
pnpm format                     # oxfmt
pnpm lint:strict                # oxlint + 边界检查
pnpm type-check                 # tsgo + vue-tsc
pnpm test                       # vitest 全量
```

---

## 5. 目录与依赖边界

```
apps/backend/     # NestJS（限内部依赖 + @lumina/shared）
apps/frontend/    # Vue 3.5（限内部依赖 + @lumina/shared）
apps/sidecar/     # Hono 旁路（限内部依赖 + @lumina/shared）
apps/wails/       # Go 桌面壳（不参与依赖边界检查）
packages/shared/  # 零外部依赖 — Zod/DTO/工具
```

---

## 6. 常用命令

```bash
# 质量门禁
pnpm ci:check         # format + lint + boundary + type-check
pnpm test             # vitest 全量

# 单项
pnpm lint             # oxlint 快速检查
pnpm lint:eslint      # ESLint fallback
pnpm format           # oxfmt 格式化
pnpm type-check       # 全量类型检查
pnpm test:coverage    # 覆盖率

# 开发
pnpm dev              # 启动 backend + frontend + shared
pnpm docker:dev       # Docker 全栈

# 构建
pnpm build            # 全量构建
pnpm --filter @lumina/shared build  # 共享包单独构建
```

---

## 7. 交付前自检

- [ ] 无 `any`（oxlint 检查）
- [ ] 无跨边界导入（`check-boundaries.js` 检查）
- [ ] 无 `cross-env` / `NODE_OPTIONS` 残留
- [ ] 共享层变更已同步测试
- [ ] `ci:check` + `test` 全绿
- [ ] 未引入敏感信息日志与密钥
