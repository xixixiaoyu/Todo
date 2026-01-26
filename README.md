# Lumina (简思)

[![Engineering Status](https://img.shields.io/badge/Engineering-Production--Ready-success?style=flat-square)](https://github.com/your-repo)
[![Tech Stack](https://img.shields.io/badge/Stack-NestJS_11_%7C_Vue_3.5_%7C_TypeScript-blue?style=flat-square)](https://github.com/your-repo)
[![License](https://img.shields.io/badge/License-MIT-orange?style=flat-square)](LICENSE)

> **简于形，深于思。** Lumina 是一款追求极致交互体验与严谨工程实践的 AI 驱动个人待办系统。

---

## 🏗️ 架构哲学：Thin Native Shell + Thick Cloud Brain

Lumina 并非传统的全栈应用，它采用了“轻原生壳 + 重云端大脑”的设计模式，旨在平衡跨端灵活性与核心业务的深度。

- **云端大脑 (NestJS 11)**: 处理核心业务逻辑、多端同步、AI 模型集成及持久化存储 (PostgreSQL + Redis)。
- **交互界面 (Vue 3.5)**: 承载高度响应式的 UI 与流畅的 GSAP 动效，确保在 Web、Desktop 与 Mobile 上的视觉一致性。
- **原生容器 (Wails / Capacitor)**: 仅作为系统底层的“桥梁”，提供托盘图标、全局快捷键及原生 API 访问能力。

---

## 🛠️ 技术底座 (Engineering Stack)

### 🧠 后端 (The Brain)
- **Runtime**: Node.js 20+ (NestJS 11)
- **Persistence**: PostgreSQL 16 + Prisma 7 ORM
- **Cache & Queue**: Redis 7 + BullMQ (可靠任务调度)
- **Security**: JWT (Double Token) + Passport + Rate Limiting
- **Observability**: NestJS Terminus (Health Checks) + nestjs-pino

### 🎨 前端 (The Interface)
- **Core**: Vue 3.5 (Composition API) + Vite 7
- **Store**: Pinia (with Persistence)
- **UI Framework**: Tailwind CSS 3.4 + shadcn-vue (Reka UI)
- **Animation**: GSAP 3.14 (高性能动画引擎)
- **Data Fetching**: TanStack Vue Query 5 + Axios

### 📦 跨端与共享 (The Link)
- **Desktop**: Wails 2.11 (Go + WebKit)
- **Mobile**: Capacitor 8 (iOS/Android)
- **Shared logic**: `@lumina/shared` (Zod-based SSOT types)

---

## 💎 工程亮点 (Engineering Excellence)

### 1. 严格的“单一事实源”类型推断
通过 `packages/shared`，我们利用 Zod 实现了从数据库 Schema 到后端 DTO 再到前端 Form 校验的端到端类型自动推断，彻底消除因接口变更导致的潜在运行时错误。

### 2. 极致的视觉美学
- **响应式优先**: 坚持 Mobile First，核心容器使用灵活布局，确保在各尺寸屏幕下的呼吸感。
- **动效管理**: 统一使用 `useGsap` composable 封装动画逻辑，确保资源在组件销毁时自动释放。
- **字体优化**: 深度集成 `LXGW WenKai` 与 `JetBrains Mono`，提供极致的文字阅读体验。

### 3. 安全防御体系
- **三级限流**: 内置短、中、长三种维度的速率限制策略。
- **数据清洗**: 严格执行 `XSS` 过滤与输入 Sanitization。
- **TDD 心态**: 核心业务逻辑均由 Vitest 提供 100% 的测试覆盖。

---

## 🚀 快速开始

### 环境预要求
- **Node.js**: >= 20.19.0
- **pnpm**: >= 9.15.0
- **Go**: >= 1.21 (仅桌面端开发需要)
- **Docker**: 用于运行数据库与缓存基础设施

### 5 分钟部署
```bash
# 1. 初始化项目
git clone <repository-url>
pnpm install

# 2. 启动基础设施
docker compose up postgres redis -d

# 3. 数据库就绪
pnpm db:push

# 4. 开启开发模式
pnpm dev
```

---

## 📖 常用命令手册

| 类别 | 命令 | 描述 |
| :--- | :--- | :--- |
| **开发** | `pnpm dev` | 启动前后端并发开发模式 (Turbo 驱动) |
| **数据库** | `pnpm db:studio` | 开启可视化数据库管理界面 |
| **测试** | `pnpm test` | 运行全栈测试套件 |
| **格式化** | `pnpm lint:fix` | 自动修复 ESLint 与 Prettier 规范问题 |
| **桌面端** | `pnpm wails:dev` | 启动 Wails 桌面端实时开发环境 |
| **构建** | `pnpm build` | 执行全链路生产环境构建 |

---

## 🚢 持续集成与部署 (CI/CD)

本项目配置了完整的 GitHub Actions 流水线 ([ci.yml](file:///.github/workflows/ci.yml)):
- **代码质检**: 自动运行 Lint、Type Check 与全量测试。
- **跨平台构建**: 通过 [wails-build.yml](file:///.github/workflows/wails-build.yml) 在云端自动打包 Windows (.exe) 与 macOS (.app) 产物。

---

## 📜 规范约定

- **编码风格**: 遵循 SOLID 原则，2 空格缩进，单引号，无分号。
- **提交规范**: 采用 Husky 拦截，强制执行规范化的 Git Commit Message。
- **排版建议**: 中文与 English/Number 之间保持一个空格。

&copy; 2026 Lumina Engineering Team.
