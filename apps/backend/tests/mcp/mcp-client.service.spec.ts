import { Test, TestingModule } from '@nestjs/testing'
import { McpClientService } from '@/mcp/mcp-client.service'
import { McpTransportType } from '@/mcp/mcp.dto'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { describe, it, expect, beforeEach, vi } from 'vitest'

// Mock instances to be used in tests
const mockClientInstance = {
  connect: vi.fn().mockResolvedValue(undefined),
  close: vi.fn().mockResolvedValue(undefined),
  listTools: vi.fn().mockResolvedValue({ tools: [] }),
  callTool: vi.fn().mockResolvedValue({ content: [], isError: false }),
}

// Mock the MCP SDK
vi.mock('@modelcontextprotocol/sdk/client/index.js', () => {
  return {
    Client: vi.fn().mockImplementation(function () {
      return mockClientInstance
    }),
  }
})

vi.mock('@modelcontextprotocol/sdk/client/stdio.js', () => {
  return {
    StdioClientTransport: vi.fn().mockImplementation(function () {
      return {}
    }),
  }
})

vi.mock('@modelcontextprotocol/sdk/client/streamableHttp.js', () => {
  return {
    StreamableHTTPClientTransport: vi.fn().mockImplementation(function () {
      return {}
    }),
  }
})

describe('McpClientService', () => {
  let service: McpClientService

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [McpClientService],
    }).compile()

    service = module.get<McpClientService>(McpClientService)
    vi.clearAllMocks()
  })

  it('should be defined', () => {
    expect(service).toBeDefined()
  })

  describe('connect', () => {
    it('should connect to a stdio server', async () => {
      const serverId = 'test-stdio'
      const config = {
        command: 'node',
        args: ['test.js'],
        env: { KEY: 'VALUE' },
      }

      await service.connect(serverId, McpTransportType.STDIO, config)

      expect(Client).toHaveBeenCalled()
      expect(service.isConnected(serverId)).toBe(true)
    })

    it('should connect to an http server', async () => {
      const serverId = 'test-http'
      const config = {
        url: 'http://localhost:8080/mcp',
        headers: { Authorization: 'Bearer test' },
      }

      await service.connect(serverId, McpTransportType.HTTP, config)

      expect(Client).toHaveBeenCalled()
      expect(service.isConnected(serverId)).toBe(true)
    })

    it('should disconnect before connecting if already connected', async () => {
      const serverId = 'test-reconnect'
      const config = { command: 'node', args: [] }

      await service.connect(serverId, McpTransportType.STDIO, config)
      const disconnectSpy = vi.spyOn(service, 'disconnect')

      await service.connect(serverId, McpTransportType.STDIO, config)

      expect(disconnectSpy).toHaveBeenCalledWith(serverId)
    })
  })

  describe('tools and execution', () => {
    const serverId = 'test-server'

    beforeEach(async () => {
      await service.connect(serverId, McpTransportType.STDIO, { command: 'node', args: [] })
    })

    it('should list tools', async () => {
      const mockTools = [{ name: 'tool1', description: 'desc1', inputSchema: {} }]
      const connection = (
        service as unknown as { connections: Map<string, { client: typeof mockClientInstance }> }
      ).connections.get(serverId)!
      connection.client.listTools.mockResolvedValue({ tools: mockTools })

      const tools = await service.listTools(serverId)

      expect(tools).toHaveLength(1)
      expect(tools[0].name).toBe('tool1')
    })

    it('should call a tool', async () => {
      const mockResult = { content: [{ type: 'text', text: 'result' }], isError: false }
      const connection = (
        service as unknown as { connections: Map<string, { client: typeof mockClientInstance }> }
      ).connections.get(serverId)!
      connection.client.callTool.mockResolvedValue(mockResult)

      const result = await service.callTool(serverId, 'tool1', { arg: 'val' })

      expect(result.content[0].text).toBe('result')
      expect(connection.client.callTool).toHaveBeenCalledWith({
        name: 'tool1',
        arguments: { arg: 'val' },
      })
    })

    it('should throw error if calling tool on non-existent server', async () => {
      await expect(service.callTool('invalid', 'tool1', {})).rejects.toThrow(
        'Not connected to MCP server',
      )
    })
  })

  describe('disconnect', () => {
    it('should disconnect and remove connection', async () => {
      const serverId = 'test-disconnect'
      await service.connect(serverId, McpTransportType.STDIO, { command: 'node', args: [] })

      await service.disconnect(serverId)

      expect(service.isConnected(serverId)).toBe(false)
    })
  })
})
