# Lumina (简思)

[![License](https://img.shields.io/badge/License-AGPL--3.0-orange?style=flat-square)](LICENSE)
[![Stack](https://img.shields.io/badge/Stack-NestJS_11_%7C_Vue_3.5_%7C_Three.js-blue?style=flat-square)](#-engineering-stack)
[![Status](https://img.shields.io/badge/Status-Production--Ready-brightgreen?style=flat-square)](#-engineering-excellence)

> **简于形，深于思。**  
> Lumina 是一款追求极致交互体验与严谨工程实践的 AI 驱动个人待办系统。它不仅仅是一个任务清单，更是一个具备“大脑”的效率中枢。

## 📦 下载客户端

- **Release 列表**: [查看全部版本与资产](https://github.com/xixixiaoyu/lumina/releases)
- **最新预发布**: [查看预发布版本（Pre-release）](https://github.com/xixixiaoyu/lumina/releases)
- **开发构建（Actions Artifacts）**: [Desktop Installers 工作流](https://github.com/xixixiaoyu/lumina/actions/workflows/desktop-packages.yml)
- **macOS 启动排障（临时）**: 若提示“已损坏/无法打开”，执行  
  `xattr -dr com.apple.quarantine /Applications/Lumina.app`

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

- **🧠 AI 真的越用越懂你**  
  长期记忆 + 上下文压缩 + `/` 快捷指令 + 附件输入，让对话连续、执行顺手。
- **🔌 能接入你自己的工具链**  
  内置 MCP Server 管理页，可配置 HTTP / STDIO 服务，按需扩展 AI 能力边界。
- **📊 进度不靠感觉，靠可视化**  
  任务树与统计图表实时呈现，复杂项目也能快速看清重点与瓶颈。
- **⏳ 专注体验更沉浸**  
  `Pomodoro Earth` 番茄钟以低干扰视觉引导深度工作，减少频繁切换成本。
- **🔁 长任务也保持流畅反馈**  
  实时事件推送 + 后台任务编排，耗时操作不中断主流程，状态变化及时可见。
- **🔐 默认把安全放在前面**  
  支持密码登录与密码找回，配合请求校验与限流策略，降低常见风险面。
- **📱 一套核心，多端一致**  
  同时覆盖 Web、Desktop（Wails）与 Mobile（Capacitor），体验与能力保持统一。
- **🌍 多语言与类型一致性并重**  
  前后端 i18n 分离管理，配合 Zod 全链路类型约束，减少“能跑但不稳”的问题。
- **🎨 细节驱动的界面质感**  
  基于 8px 网格、毛玻璃与动态主题，兼顾审美、性能与可读性。

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

### 3. 访问统计看板 (GoAccess)

生产部署（`./deploy.sh`）会自动启动 GoAccess 实时统计服务，基于 Nginx access log 生成可视化报表。

- 默认地址：`http://127.0.0.1:7890`
- 默认绑定：`127.0.0.1`（更安全，建议通过反向代理+鉴权暴露）
- 可选环境变量：
  - `GOACCESS_REPORT_PORT`：看板端口（默认 `7890`）
  - `GOACCESS_REPORT_BIND`：监听地址（默认 `127.0.0.1`）

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
