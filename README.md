# 简思 (Lumina)

[![Tech Stack](https://img.shields.io/badge/Stack-NestJS%20%7C%20Vue%203.5%20%7C%20TypeScript-blue)](https://github.com/your-repo)

基于 **NestJS 11** 与 **Vue 3.5** 构建的 **简思 (Lumina)** — 简于形，深于思的高效纯粹 AI 个人待办应用。采用 **pnpm Monorepo** 架构，集成了现代 Web 开发的最佳实践、严谨的工程规范与极致的跨端能力。

## 核心设计哲学

本项目不仅是一个代码模板，更是一套工程化实践指南：

- **类型至上 (Type-Safe)**：利用 Zod 实现从数据库、后端 DTO 到前端表单的“单一事实源”类型推断，杜绝 `any`。
- **直击本质 (Simplicity)**：坚持逻辑扁平化，避免过度设计，确保模块间高内聚、低耦合。
- **极致交互 (Exquisite UX)**：基于 GSAP 与 Tailwind 打造丝滑的动效与响应式布局，追求像素级的细节。
- **跨端原生 (Cross-Platform)**：一套代码，通过 Capacitor 覆盖 Web、iOS 和 Android。

---

## 项目架构

```text
.
├── apps/
│   ├── backend/          # NestJS 后端 (@my-app/backend) - 核心业务逻辑、存储、认证
│   └── frontend/         # Vue 3 前端 (@my-app/frontend) - 现代化 UI、跨端适配层
├── packages/
│   └── shared/           # 共享包 (@my-app/shared) - Zod Schemas、常量、工具函数
├── docker-compose.yml    # 容器编排 (PostgreSQL 16, Redis 7)
└── pnpm-workspace.yaml   # 工作空间配置
```

---

## 技术图谱

### 后端 (Modern NestJS)
- **运行时**: Node.js 20.19+ / NestJS 11.1+
- **数据层**: PostgreSQL 16 + Prisma 7 ORM
- **异步任务**: BullMQ 5 + Redis 7 (消息队列与缓存)
- **安全认证**: JWT (Double Token) + Passport + CSRF Protection
- **效能**: nestjs-zod (验证 + Swagger) + nestjs-pino (极速日志)

### 前端 (Next-Gen Vue)
- **核心**: Vue 3.5+ (Composition API) + Vite 7
- **状态/路由**: Pinia (持久化) + Vue Router 4
- **UI 体系**: Tailwind CSS 3.4+ + shadcn-vue (Reka UI) + Lucide Icons
- **数据流**: TanStack Vue Query 5 + Axios
- **动效**: GSAP 3.14 (高性能动画引擎)

### 跨端能力 (Universal)
- **桌面端**: Wails 2.11 (Go + WebKit)
- **移动端**: Capacitor 8 (iOS/Android 原生访问)
- **离线能力**: Vite PWA (Service Workers)

---

## 快速开始

### 环境准备
- **Node.js**: >= 20.19.0
- **pnpm**: >= 9.15.0
- **Docker**: 推荐使用 Docker Desktop 运行数据库与缓存

### 5 分钟起步
```bash
# 1. 克隆并安装
git clone <repository-url>
pnpm install

# 2. 环境变量
cp .env.example .env

# 3. 基础设施 (PostgreSQL & Redis)
docker compose up postgres redis -d

# 4. 数据库初始化
pnpm db:push
pnpm db:generate

# 5. 启动开发服务器
pnpm dev

# 6. 桌面端开发与打包 (Wails)
pnpm wails:dev        # 启动桌面端开发模式
pnpm wails:build      # 打包桌面端应用 (根据当前 OS 生成)

### 跨平台打包指南

由于 Wails 依赖于各系统的原生 WebView 引擎（Windows 使用 WebView2/Edge，macOS 使用 WebKit），在 macOS 上**无法直接**通过本地命令行打包出 Windows 的 `.exe` 文件。

推荐的解决方法有：

1. **GitHub Actions (推荐)**: 
   - 我已经为你配置了 [wails-build.yml](file:///.github/workflows/wails-build.yml)。
   - 只要推送一个以 `v` 开头的标签（如 `git tag v1.0.0 && git push --tags`），GitHub 就会自动在 Windows 和 macOS 虚拟机上并行打包，并生成可下载的产物。
   - **小技巧**: 如果你推送标签后发现代码有误，修复后可以使用 `pnpm tag:refresh <tag_name>` 快速重置标签并重新触发打包。
2. **虚拟机**: 在 Mac 上安装 Windows 虚拟机（如 Parallels 或 UTM），在虚拟机内配置 Go 环境进行打包。
3. **Docker**: 使用专门的跨平台构建镜像（如 `wailsapp/wails-build`），但这需要配置较复杂的 CGO 交叉编译环境。
```

---

## 核心功能规范

### Zod 类型共享 (Single Source of Truth)
我们通过 `@my-app/shared` 导出 Schema，实现前后端验证逻辑的完美同步：
```typescript
// 1. 在 shared 中定义
export const LoginSchema = z.object({ ... })

// 2. 后端直接生成 DTO
export class LoginDto extends createZodDto(LoginSchema) {}

// 3. 前端直接用于表单验证
const { handleSubmit } = useForm({ validationSchema: toTypedSchema(LoginSchema) })
```

### 响应式布局与动效
- **Mobile First**: 所有 UI 组件均优先适配移动端。
- **GSAP 最佳实践**: 必须使用 `useGsap` composable 确保动画在组件销毁时自动清理。

---

## 关键特性详情

### 1. 安全与防御 (Security by Design)
- **三级速率限制**: 后端内置短(1s/3次)、中(10s/20次)、长(1min/100次)三级限流策略，有效抵御暴力破解。
- **双令牌认证**: 采用 AccessToken + RefreshToken 机制，结合 HttpOnly Cookie 与 CSRF 防护。
- **数据清洗**: 集成 `sanitize-html` 与 `xss` 库，深度过滤用户输入。

### 2. 国际化 (i18n)
- **多端支持**: 前端使用 `Vue I18n 11`，后端使用 `nestjs-i18n`，支持简中与英文实时切换。
- **优先级**: `localStorage` → 浏览器语言 → `en-US`。

### 3. 基础设施与可观测性
- **健康检查**: 集成 `NestJS Terminus`，实时监控数据库、Redis 及存储服务的运行状态。
- **文件存储**: 统一 `StorageService` 接口，支持 AWS S3、阿里云 OSS 与 MinIO。
- **任务调度**: 基于 BullMQ 实现可靠的延迟任务与定时任务，支持失败重试与可视化监控。

---

## 常用命令手册

| 类别 | 命令 | 说明 |
| :--- | :--- | :--- |
| **开发** | `pnpm dev` | 同时启动前后端开发环境 |
| **构建** | `pnpm build` | 构建所有应用 (Turbo 驱动) |
| **数据库** | `pnpm db:studio` | 打开可视化数据库管理界面 |
| **测试** | `pnpm test` | 运行全栈单元与集成测试 |
| **代码规范** | `pnpm lint:fix` | 自动修复 ESLint 与 Prettier 问题 |
| **移动端** | `pnpm cap:sync` | 同步 Web 资源至 iOS/Android |

---

## 开发规范与质量保证

- **排版**: 中文与 English/Number 之间保持一个空格。
- **代码风格**: 2 空格缩进、单引号、无分号。
- **测试驱动**: 任何逻辑变更必须伴随对应的 Vitest 测试用例。
- **提交规范**: 集成 Husky 与 lint-staged，确保每一行入库代码都经过校验。

---

&copy; 2026
