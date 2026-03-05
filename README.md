# Lumina (简思)

[![License](https://img.shields.io/badge/License-AGPL--3.0-orange?style=flat-square)](LICENSE)
[![Stack](https://img.shields.io/badge/Stack-NestJS_11_%7C_Vue_3.5_%7C_TypeScript-blue?style=flat-square)](#-engineering-stack)
[![Status](https://img.shields.io/badge/Status-Production--Ready-brightgreen?style=flat-square)](#-engineering-excellence)

> **简于形，深于思。**  
> Lumina 是一款追求极致交互体验与严谨工程实践的 AI 驱动个人待办系统。它不仅仅是一个任务清单，更是一个具备“大脑”的效率中枢。

---

## 🏗️ 架构哲学：Thin Shell, Thick Brain

Lumina 采用了“轻原生壳 + 重云端大脑”的模式，在保持跨端灵活性的同时，确保核心逻辑的深度与一致性。

- **云端大脑 (NestJS 11)**: 处理核心领域逻辑、多端同步、AI 模型集成及可靠任务调度 (PostgreSQL + Redis + BullMQ)。
- **交互界面 (Vue 3.5)**: 承载高度响应式的 UI 与流畅的 GSAP 动效，注入“呼吸感”与“通透感”。
- **原生容器 (Wails / Capacitor)**: 作为系统底层的桥梁，提供托盘图标、全局快捷键及原生 API 访问能力。

---

## � 核心特性

- **🧠 AI 深度集成**: 
  - 支持 **MCP (Model Context Protocol)**，让 AI 能够调用外部工具与服务。
  - 具备 **AI Memory (长期记忆)** 与上下文压缩能力，越用越懂你。
  - 内置 Slash Commands (/) 与文件附件支持，沟通无界。
- **📊 数据可视化**: 利用 ECharts 动态生成任务树与统计图表，让进度一目了然。
- **⏳ 沉浸式番茄钟**: 独特的 `Pomodoro Earth` 视觉动效，配合任务流引导深度工作。
- **� 严格的类型安全**: 基于 Zod 实现从数据库 Schema 到后端 DTO 再到前端校验的全链路类型推断。
- **🎨 视觉美学**: 遵循 8px 网格系统，利用 `backdrop-blur` 与细腻阴影营造现代感，支持动态主题切换。

---

## 🛠️ 技术底座

| 维度 | 技术选型 |
| :--- | :--- |
| **后端** | NestJS 11, Prisma 7, PostgreSQL, Redis, BullMQ |
| **前端** | Vue 3.5, Vite 7, Pinia, Tailwind 3.4, GSAP 3.14 |
| **跨端** | Wails (Desktop), Capacitor 8 (Mobile) |
| **质量** | Vitest, ESLint, Prettier, Turborepo |

---

## 🚀 快速启动

### 环境准备
- **Node.js**: >= 20.19.0
- **pnpm**: >= 9.15.0
- **Docker**: 用于运行 PostgreSQL 与 Redis

### 启动步骤
1. **安装依赖**: `pnpm install`
2. **基础环境**: `docker compose up -d`
3. **数据库同步**: `pnpm db:push`
4. **开发模式**: `pnpm dev`

---

## �️ 开源治理

- **协议**: [AGPL-3.0](LICENSE) (保护核心代码，回馈开源社区)。
- **规范**: 遵循 [CONTRIBUTING.md](CONTRIBUTING.md) 中的工程标准与代码风格。
- **反馈**: 遇到安全漏洞请查阅 [SECURITY.md](SECURITY.md)，或发送邮件至 `yunmucoder@163.com`。

---

<p align="center">
  Made with ❤️ by <b>牧云 (Mu Yun)</b>
</p>
