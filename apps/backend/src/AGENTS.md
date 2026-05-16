# Backend — NestJS 11 + Fastify

**生成**: 2026-05-16 | **项目**: Lumina

## 概览

NestJS 11（Fastify 适配器）后端，负责 Todo CRUD、AI Agent 会话、用户鉴权、MCP 集成、任务调度。

## 模块清单

| 模块               | 职责                            | 备注                                      |
| ------------------ | ------------------------------- | ----------------------------------------- |
| `auth/`            | JWT 登录/注册/刷新/登出         | Bearer Token，拒绝 Cookie 认证            |
| `todos/`           | Todo CRUD + 增量同步 + 递归任务 | 版本冲突检测、墓碑机制                    |
| `agent/`           | AI Agent 会话管理 + 任务队列    | session-file/ + task-queue/ 子模块        |
| `mcp/`             | MCP 服务器注册与工具调用        | 前后端共享 MCP 配置                       |
| `events/`          | WebSocket 网关 (Socket.IO)      | 实时广播，不走业务层                      |
| `users/`           | 用户资料与设置                  |                                           |
| `common/`          | 过滤器、拦截器、限流            | TransformInterceptor、AllExceptionsFilter |
| `prisma/`          | Prisma 数据库模块               | 模块化 schema（6 个 .prisma 文件）        |
| `redis/`           | Redis 缓存模块                  | CacheableTTL 常量管理                     |
| `upload/`          | 文件上传                        |                                           |
| `web-search/`      | AI 网络搜索集成                 |                                           |
| `ai-sync/`         | AI 设置增量同步                 |                                           |
| `skill-sources/`   | AI 技能源管理                   |                                           |
| `teaching/`        | 教学模式后端                    | 测验记录、学习进度                        |
| `scheduled-tasks/` | 定时任务                        |                                           |
| `mail/`            | 邮件服务                        |                                           |
| `i18n/`            | 后端国际化                      | en-US / zh-CN                             |
| `health/`          | 健康检查端点                    | `/api/health/liveness`                    |

## 结构风险

| 问题                             | 位置              | 建议                       |
| -------------------------------- | ----------------- | -------------------------- |
| 模块扁平化，无 dto/guards 技术层 | `auth/` (11 文件) | >10 文件时引入子目录       |
| Fastify 插件散布在 `main.ts`     | 第 78-128 行      | 提取为 FastifyConfigModule |

## 关键模式

- **Controller → Service → Prisma** 三层架构
- 事务保护写操作（`prisma.$transaction`）
- 限流：`1s/10, 10s/50, 1min/100`
- 缓存：仅可失效数据 + TTL 常量
- X-Requested-With 安全头验证

## 测试

- 位置：`apps/backend/tests/`
- E2E 测试：`tests/e2e/` 使用 `createE2eApp()` + 内存 Prisma/Redis
- 覆盖率阈值：60% lines/funcs, 50% branches
