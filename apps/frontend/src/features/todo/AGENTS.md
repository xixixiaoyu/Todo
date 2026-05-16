# Todo Feature — 核心业务域

**生成**: 2026-05-16

## 概览

任务管理核心模块：CRUD、筛选排序、增量同步、递归任务、番茄钟 3D 专注。

## 文件组织

```
features/todo/
├── api/              # 后端接口封装
├── stores/           # Pinia store（27 文件 — 过度拆分）
├── components/       # Todo 组件
│   └── pomodoro/     # 3D 番茄钟子模块
└── composables/      # Todo 组合式函数
```

## Store 结构（风险：过度拆分）

27 个相关文件，包括 `todo.ts`、`todo.actions.ts`、`todo.cloud.sync.ts`、`todo.filtering.ts` 等。
建议合并为单一 store + Pinia modules。

## 关键组件

| 组件                 | 行数 | 职责                         |
| -------------------- | ---- | ---------------------------- |
| `TodoScratchpad.vue` | 837  | 草稿/快速录入（文本+图片）   |
| `PomodoroEarth.vue`  | 580  | 3D 番茄钟（Three.js + GSAP） |

## 后端关联

- 后端模块：`apps/backend/src/todos/`
- 增量同步：`todos-sync.service.ts`（版本冲突检测 + 墓碑机制）
- 递归任务：`todos-sync.recurrence.ts`

## 测试

- 位置：`tests/features/todo/`
- 主要测试：`TodoItem.spec.ts` (949 行)、`todo.actions.spec.ts` (897 行)
- 后端同步测试：`backend/tests/todos-sync.service.spec.ts` (641 行)
