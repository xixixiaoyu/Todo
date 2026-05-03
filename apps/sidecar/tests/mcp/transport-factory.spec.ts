import { mkdir, rm, mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { McpTransportFactory } from '../../src/mcp/transport-factory'
import { McpTransportType } from '@lumina/shared'
import { WorkspaceStore } from '../../src/store/workspace-store'

describe('McpTransportFactory', () => {
  let workRoot: string
  let dataDir: string
  let store: WorkspaceStore
  let factory: McpTransportFactory

  beforeEach(async () => {
    dataDir = await mkdtemp(join(tmpdir(), 'lumina-sidecar-'))
    workRoot = join(dataDir, 'workspace')
    await mkdir(workRoot, { recursive: true })
    store = new WorkspaceStore(dataDir)
    await store.add(workRoot)
    factory = new McpTransportFactory(store)
  })

  afterEach(async () => {
    await rm(dataDir, { recursive: true, force: true })
  })

  describe('createTransport', () => {
    it('不支持的 transport 类型抛出错误', async () => {
      await expect(
        factory.createTransport('s1', 'invalid' as McpTransportType, {} as never),
      ).rejects.toThrow('Unsupported transport type: invalid')
    })
  })

  describe('createStdioTransport', () => {
    it('命令包含空格时抛出错误', async () => {
      await expect(
        factory.createTransport('s1', McpTransportType.STDIO, {
          command: 'node script.js',
          args: [],
        }),
      ).rejects.toThrow('MCP stdio command must not include spaces')
    })

    it('cwd 未配置时放行（默认工作目录）', async () => {
      const transport = await factory.createTransport('s1', McpTransportType.STDIO, {
        command: 'echo',
        args: ['hello'],
      })
      expect(transport).toBeDefined()
      expect(transport.constructor.name).toBe('StdioClientTransport')
    })

    it('cwd 在白名单内时放行', async () => {
      const transport = await factory.createTransport('s1', McpTransportType.STDIO, {
        command: 'echo',
        args: ['hi'],
        cwd: workRoot,
      })
      expect(transport).toBeDefined()
    })

    it('cwd 越界时拒绝', async () => {
      await expect(
        factory.createTransport('s1', McpTransportType.STDIO, {
          command: 'echo',
          args: [],
          cwd: '/tmp/definitely-outside-allow-list',
        }),
      ).rejects.toThrow(/workspace allow-list/)
    })

    it('纠正 @upstash/context7 包名', async () => {
      const transport = await factory.createTransport('s1', McpTransportType.STDIO, {
        command: 'npx',
        args: ['-y', '@upstash/context7'],
      })
      expect(transport).toBeDefined()
    })
  })

  describe('createHttpTransport', () => {
    it('无效 URL 抛出错误', async () => {
      await expect(
        factory.createTransport('s1', McpTransportType.HTTP, {
          url: 'not-a-url',
        }),
      ).rejects.toThrow('Invalid MCP HTTP URL')
    })

    it('非 http(s) 协议抛出错误', async () => {
      await expect(
        factory.createTransport('s1', McpTransportType.HTTP, {
          url: 'ftp://example.com/mcp',
        }),
      ).rejects.toThrow('Unsupported MCP HTTP protocol')
    })

    it('成功创建 HTTP transport', async () => {
      const transport = await factory.createTransport('s1', McpTransportType.HTTP, {
        url: 'http://localhost:3000/mcp',
      })
      expect(transport).toBeDefined()
      expect(transport.constructor.name).toBe('StreamableHTTPClientTransport')
    })

    it('支持 bearer auth header', async () => {
      const transport = await factory.createTransport('s1', McpTransportType.HTTP, {
        url: 'http://localhost:3000/mcp',
        auth: {
          type: 'bearer',
          token: 'secret-token',
        },
      })
      expect(transport).toBeDefined()
    })

    it('支持 api_key auth', async () => {
      const transport = await factory.createTransport('s1', McpTransportType.HTTP, {
        url: 'http://localhost:3000/mcp',
        auth: {
          type: 'api_key',
          apiKey: 'my-key',
        },
      })
      expect(transport).toBeDefined()
    })

    it('支持自定义 headers', async () => {
      const transport = await factory.createTransport('s1', McpTransportType.HTTP, {
        url: 'http://localhost:3000/mcp',
        headers: { 'X-Custom': 'value' },
      })
      expect(transport).toBeDefined()
    })
  })
})
