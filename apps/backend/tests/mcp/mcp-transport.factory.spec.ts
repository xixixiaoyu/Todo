import { describe, it, expect, vi, beforeEach } from 'vitest'
import { McpTransportFactory } from '@/mcp/core/mcp-transport.factory'
import { McpTransportType } from '@/mcp/mcp.dto'

let lastStdioOptions: unknown
vi.mock('@modelcontextprotocol/sdk/client/stdio.js', () => {
  class StdioClientTransport {
    constructor(options: unknown) {
      lastStdioOptions = options
    }
  }
  return { StdioClientTransport }
})

let lastHttpUrl: URL | undefined
let lastHttpOptions: unknown
vi.mock('@modelcontextprotocol/sdk/client/streamableHttp.js', () => {
  class StreamableHTTPClientTransport {
    constructor(url: URL, options: unknown) {
      lastHttpUrl = url
      lastHttpOptions = options
    }
  }
  return { StreamableHTTPClientTransport }
})

describe('McpTransportFactory', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    lastStdioOptions = undefined
    lastHttpUrl = undefined
    lastHttpOptions = undefined
  })

  it('should not pass non-allowlisted process env to stdio transport', async () => {
    process.env.PATH = '/usr/bin'
    process.env.DATABASE_URL = 'postgres://secret'
    process.env.JWT_SECRET = 'super-secret'

    const factory = new McpTransportFactory()
    await factory.createTransport('s1', McpTransportType.STDIO, {
      command: 'node',
      args: ['-e', 'console.log(1)'],
      env: {
        CUSTOM_KEY: 'custom',
      },
    })

    expect(lastStdioOptions).toBeDefined()

    const opts = lastStdioOptions as {
      env?: Record<string, string>
      command?: string
      args?: string[]
    }

    expect(opts.command).toBe('node')
    expect(opts.args).toEqual(['-e', 'console.log(1)'])
    expect(opts.env?.PATH).toBe('/usr/bin')
    expect(opts.env?.CUSTOM_KEY).toBe('custom')
    expect(opts.env?.DATABASE_URL).toBeUndefined()
    expect(opts.env?.JWT_SECRET).toBeUndefined()
  })

  it('should set Authorization header for oauth token', async () => {
    const factory = new McpTransportFactory()
    await factory.createTransport('s1', McpTransportType.HTTP, {
      url: 'https://example.com/mcp',
      auth: {
        type: 'oauth',
        token: 'token-1',
        apiKeyHeader: 'X-API-Key',
      },
    })

    expect(lastHttpUrl?.toString()).toBe('https://example.com/mcp')

    const opts = lastHttpOptions as {
      requestInit?: {
        headers?: Record<string, string>
      }
    }

    expect(opts.requestInit?.headers?.Authorization).toBe('Bearer token-1')
  })
})
