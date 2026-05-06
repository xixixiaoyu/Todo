import { serve } from '@hono/node-server'
import { loadConfig } from './config'
import { createApp } from './server/app'
import { createMcpRoutes } from './routes/mcp'
import { createHealthRoutes } from './routes/health'
import { createWorkspaceRoutes } from './routes/workspaces'
import { createFsRoutes } from './routes/fs'
import { createBashRoutes } from './routes/bash'
import { McpConfigStore } from './store/mcp-config-store'
import { WorkspaceStore } from './store/workspace-store'
import { McpClient } from './mcp/mcp-client'
import { CheckpointStore } from './security/checkpoint'
import { findFreePort } from './utils/port'
import { logger } from './utils/logger'

async function main() {
  const config = loadConfig()
  logger.info('Sidecar starting', { host: config.host, dataDir: config.dataDir })

  // 分配端口
  const port = config.port || (await findFreePort(config.host))

  // 初始化存储
  const configStore = new McpConfigStore(config.dataDir)
  const workspaceStore = new WorkspaceStore(config.dataDir)
  const checkpointStore = new CheckpointStore()

  // 初始化 MCP 服务（注入 workspace 守卫）
  const mcpClient = new McpClient(workspaceStore)

  // 创建 Hono app（含鉴权中间件）
  const app = createApp({ authToken: config.authToken, port })

  // 注册路由
  app.route('/sidecar/health', createHealthRoutes(configStore, mcpClient))
  app.route('/sidecar/mcp', createMcpRoutes(configStore, mcpClient))
  app.route('/sidecar/workspaces', createWorkspaceRoutes(workspaceStore))
  app.route('/sidecar/fs', createFsRoutes(workspaceStore, checkpointStore))
  app.route('/sidecar/bash', createBashRoutes(workspaceStore))

  // 启动 HTTP server
  serve({ fetch: app.fetch, port, hostname: config.host }, (info) => {
    // stdout 输出单行 JSON — Go 层解析此行获取端口
    // 此后所有日志走 stderr，stdout 保持干净
    const readyMsg = JSON.stringify({ type: 'sidecar:ready', port: info.port })
    process.stdout.write(readyMsg + '\n')
    logger.info(`Sidecar listening on ${config.host}:${info.port}`)
  })

  // 优雅关闭
  const shutdown = async (signal: string) => {
    logger.info(`Received ${signal}, shutting down...`)
    await mcpClient.disconnectAll()
    process.exit(0)
  }

  process.on('SIGTERM', () => shutdown('SIGTERM'))
  process.on('SIGINT', () => shutdown('SIGINT'))
}

main().catch((err) => {
  logger.error(`Fatal error: ${err}`)
  process.exit(1)
})
