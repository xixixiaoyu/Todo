# Frontend — Vue 3.5 + Vite + Pinia

**生成**: 2026-05-16 | **项目**: Lumina

## 概览

Vue 3.5 前端，Feature-based 组织架构。Tailwind 3.4 + Reka UI + GSAP + Three.js。

## 目录结构

```
src/
├── features/          # 业务功能模块
│   ├── ai/            # AI 聊天/助手（最大 feature）
│   ├── todo/          # 任务管理
│   ├── auth/          # 登录/注册
│   └── mcp/           # MCP 工具管理
├── components/
│   ├── auth/          # 应移入 features/auth/
│   └── ui/            # Reka UI 包装组件（14 个）
├── composables/       # 全局 composable
│   └── markdown/      # Markdown 渲染
├── api/               # Axios 实例 + 拦截器
├── services/          # 跨 feature 服务
├── stores/            # 全局 Pinia store（待迁移至 feature 内）
├── i18n/              # 国际化（en-US / zh-CN）
├── lib/               # 工具函数
├── router/            # 路由配置
├── types/             # 全局类型
├── styles/            # 全局样式
└── views/             # 页面容器（仅 error/）
```

## Feature 组织约定

每个 feature 可选包含：

- `api/` — 后端接口封装
- `stores/` — Pinia store
- `components/` — 组件
- `composables/` — 组合式函数
- `views/` — 页面

## 关键模式

- **状态**: Pinia + `pinia-plugin-persistedstate`
- **数据**: TanStack Query 管理缓存，Axios 仅做传输
- **组件顺序**: `<script setup>` → `<template>` → `<style>`
- **动效**: 使用 `useGsap` composable，自动清理

## 结构风险

| 问题                    | 位置                              | 建议                             |
| ----------------------- | --------------------------------- | -------------------------------- |
| **Todo Store 过度拆分** | `features/todo/stores/` (11 文件) | 考虑合并为单一 store + modules   |
| **auth 组件位置不当**   | `src/components/auth/`            | 移入 `features/auth/components/` |

## 测试

- 位置：`apps/frontend/tests/`（集中式，非 co-located）
- 环境：Happy DOM
- 全局 mock：`setup.ts`（localStorage, fetch, MCP API, lucide-vue-next icons）
- 565 条测试用例（占全仓库 85%）
