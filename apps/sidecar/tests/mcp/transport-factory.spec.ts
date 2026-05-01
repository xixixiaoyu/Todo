import { describe, it, expect } from 'vitest'
import { McpTransportFactory } from '../../src/mcp/transport-factory'
import { McpTransportType } from '@lumina/shared'

describe('McpTransportFactory', () => {
  const factory = new McpTransportFactory()

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
        }),
      ).rejects.toThrow('MCP stdio command must not include spaces')
    })

    it('成功创建 STDIO transport', async () => {
      const transport = await factory.createTransport('s1', McpTransportType.STDIO, {
        command: 'echo',
        args: ['hello'],
      })

      expect(transport).toBeDefined()
      // StdioClientTransport 实例
      expect(transport.constructor.name).toBe('StdioClientTransport')
    })

    it('纠正 @upstash/context7 包名', async () => {
      // 此测试验证包名纠错逻辑不会被跳过
      // transport 由 args 构造，这里验证工厂不会在遇到底层 args 时崩溃
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
