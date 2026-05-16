# Shared — 跨包共享契约

**生成**: 2026-05-16 | **路径**: packages/shared/src/

## 概览

Zod Schema、DTO、Agent 类型、工具函数。前后端共同依赖，无外部依赖策略。

## 目录结构

```
shared/src/
├── schemas/    # Zod Schema（11 文件）
│   ├── auth.schema.ts
│   ├── user.schema.ts
│   ├── todo.schema.ts
│   ├── ai-config.schema.ts
│   └── mcp.schema.ts
├── dto/        # NestJS 运行时 DTO（createZodDto 包装）
├── agent/      # AI Agent 工具类型与契约
├── utils/      # 工具函数（unwrapApiResponse 等）
└── index.ts    # 统一 barrel export
```

## 关键约束

- **无外部依赖** — 禁止引入 npm 包
- **无模块顶层副作用** — 纯类型 + 函数
- **禁止 window/document/process.env 业务分支**
- 导出均通过 `index.ts` barrel

## 变更流程

1. 修改 Schema → 同步更新前端/后端调用方
2. 同步更新测试
3. 构建：`pnpm --filter @lumina/shared build`
4. 覆盖率门槛：**90%** lines/funcs, **80%** branches

## 使用示例

```ts
// Frontend
import { LoginSchema } from '@lumina/shared'
import { toTypedSchema } from '@vee-validate/zod'

// Backend
import { LoginSchema } from '@lumina/shared'
import { createZodDto } from 'nestjs-zod'
class LoginDto extends createZodDto(LoginSchema) {}
```

## 测试

- 位置：源码旁 `*.spec.ts`（co-located）
- 覆盖共享 Schema、DTO、工具函数
- 15 条测试用例（全仓库最少但覆盖率要求最高）
