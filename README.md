# Lumina (简思)

[![License](https://img.shields.io/badge/License-AGPL--3.0-orange?style=flat-square)](LICENSE)
[![Stack](https://img.shields.io/badge/Stack-NestJS_11_%7C_Vue_3.5_%7C_Three.js-blue?style=flat-square)](#-engineering-stack)
[![Status](https://img.shields.io/badge/Status-Production--Ready-brightgreen?style=flat-square)](#-engineering-excellence)

> **简于形，深于思。**  
> Lumina 是一款追求极致交互体验与严谨工程实践的 AI 驱动个人待办系统。它不仅仅是一个任务清单，更是一个具备“大脑”的效率中枢。

---

## 🏗️ 架构哲学：Thin Shell, Thick Brain

Lumina 采用了“轻原生壳 + 重云端大脑”的模式，在保持跨端灵活性的同时，确保核心逻辑的深度与一致性。

- **云端大脑 (NestJS 11)**: 驱动核心领域逻辑、多端同步与 AI 模型集成。
- **交互界面 (Vue 3.5)**: 承载高度响应式的 UI 与丝滑的 GSAP 动效，注入“呼吸感”与“通透感”。
- **原生容器 (Wails / Capacitor)**: 作为系统底层的桥梁，提供托盘图标、全局快捷键等原生能力。

## 📂 目录结构

```text
.
├── apps/
│   ├── backend/    # NestJS 核心 (Business Brain)
│   ├── frontend/   # Vue 3.5 Web (User Interface)
│   └── wails/      # Go + Wails (Desktop Shell)
├── packages/
│   └── shared/     # 共享 Zod Schemas & 类型定义
└── turbo.json      # 任务编排
```

---

## ✨ 核心特性

- **🧠 AI 深度集成**: 
  - 支持 **MCP (Model Context Protocol)**，可灵活接入自定义工具与服务。
  - 具备 **AI Memory (长期记忆)** 与上下文压缩，越用越懂你。
  - 内置 Slash Commands (/) 与文件附件支持。
- **📊 数据可视化**: 动态任务树与统计图表，让进度一目了然。
- **⏳ 沉浸式番茄钟**: `Pomodoro Earth` 视觉动效，引导深度工作。
- **🌍 全栈国际化**: 前后端资源分离，支持多语言动态切换。
- **🔒 类型安全**: 全链路 Zod 类型推断，从 DB 到 UI 始终如一。
- **🎨 视觉美学**: 8px 网格系统、毛玻璃效果与动态主题。

---

## 🛠️ 技术底座

| 维度 | 技术选型 |
| :--- | :--- |
| **后端** | NestJS 11, Prisma 7, PostgreSQL, Redis, BullMQ |
| **前端** | Vue 3.5, Vite 7, Pinia, Tailwind 3.4, GSAP, Three.js |
| **跨端** | Wails (Desktop), Capacitor 8 (Mobile) |
| **质量** | Vitest, ESLint, Prettier, Turborepo |

---

## 🚀 快速启动

### 1. 环境准备
- **Node.js**: >= 20.19.0 (推荐使用 corepack)
- **pnpm**: 9.15.0 (仓库锁定)
- **Docker**: 用于运行基础容器

### 2. 启动方式

#### 方案 A：容器化全栈 (推荐)
```bash
pnpm install
pnpm docker:dev
```
*一键启动全栈服务（含 DB、Redis、Backend、Frontend）。*

#### 方案 B：本地混合开发
1. **安装依赖**: `pnpm install`
2. **基础环境**: `docker compose up -d`
3. **初始化库**: `pnpm db:push`
4. **启动服务**: `pnpm dev`

---

## 🤖 AI 开发辅助

为了提升 AI 在本仓库内的开发质量与上下文理解，建议将以下文件作为**前置上下文 (Context)**：

- **[AI_RULES.md](file:///Users/yunmu/Desktop/Todo/docs/AI_RULES.md)**: 包含项目概览、技术栈规范、架构原则及必须遵守的开发门禁（Lint/Test/Type-check）。

---

## 🛡️ 开源治理

- **协议**: [AGPL-3.0](LICENSE) (保护核心代码，回馈社区)。
- **规范**: 遵循 [CONTRIBUTING.md](CONTRIBUTING.md) 的工程标准。
- **反馈**: 遇到漏洞请查阅 [SECURITY.md](SECURITY.md)，或联系 `yunmucoder@163.com`。

---

<p align="center">
  Made with ❤️ by <b>牧云 (Mu Yun)</b>
</p>
