import 'reflect-metadata'
import { Test, TestingModule } from '@nestjs/testing'
import { McpClientService } from '@/mcp/mcp-client.service'
import { McpTransportType } from '@/mcp/mcp.dto'
import { McpTransportFactory } from '@/mcp/core/mcp-transport.factory'
import { McpConnectionManager } from '@/mcp/core/mcp-connection.manager'
import { McpToolRegistry } from '@/mcp/core/mcp-tool.registry'
import { describe, it, expect, beforeEach, vi } from 'vitest'

describe('McpClientService', () => {
  let service: McpClientService
  let transportFactory: McpTransportFactory
  let connectionManager: McpConnectionManager
  let toolRegistry: McpToolRegistry

  const mockTransport = {}
  const mockClient = {
    callTool: vi.fn(),
  }
  const mockConnection = {
    client: mockClient,
    transport: mockTransport,
    serverId: 'test-server',
  }

  beforeEach(async () => {
    const mockTransportFactory = {
      createTransport: vi.fn().mockResolvedValue(mockTransport),
    }
    const mockConnectionManager = {
      connect: vi.fn().mockResolvedValue(mockConnection),
      disconnect: vi.fn().mockResolvedValue(undefined),
      getConnection: vi.fn().mockReturnValue(mockConnection),
      hasConnection: vi.fn().mockReturnValue(true),
      getAllServerIds: vi.fn().mockReturnValue(['test-server']),
    }
    const mockToolRegistry = {
      getTools: vi.fn().mockResolvedValue([]),
      refreshTools: vi.fn().mockResolvedValue([]),
      clearCache: vi.fn(),
    }

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        McpClientService,
        {
          provide: McpTransportFactory,
          useValue: mockTransportFactory,
        },
        {
          provide: McpConnectionManager,
          useValue: mockConnectionManager,
        },
        {
          provide: McpToolRegistry,
          useValue: mockToolRegistry,
        },
      ],
    }).compile()

    service = module.get<McpClientService>(McpClientService)
    transportFactory = module.get<McpTransportFactory>(McpTransportFactory)
    connectionManager = module.get<McpConnectionManager>(McpConnectionManager)
    toolRegistry = module.get<McpToolRegistry>(McpToolRegistry)
    vi.clearAllMocks()
  })

  it('should be defined', () => {
    expect(service).toBeDefined()
  })

  describe('connect', () => {
    it('should connect to a server', async () => {
      const serverId = 'test-server'
      const config = { command: 'node', args: [] }

      await service.connect(serverId, McpTransportType.STDIO, config)

      expect(transportFactory.createTransport).toHaveBeenCalledWith(
        serverId,
        McpTransportType.STDIO,
        config,
      )
      expect(connectionManager.connect).toHaveBeenCalledWith(serverId, mockTransport)
      expect(toolRegistry.refreshTools).toHaveBeenCalledWith(serverId)
    })
  })

  describe('tools and execution', () => {
    const serverId = 'test-server'

    it('should list tools', async () => {
      const mockTools = [{ name: 'tool1', description: 'desc1', inputSchema: {} }]
      vi.mocked(toolRegistry.getTools).mockResolvedValue(mockTools)

      const tools = await service.listTools(serverId)

      expect(tools).toEqual(mockTools)
      expect(toolRegistry.getTools).toHaveBeenCalledWith(serverId)
    })

    it('should call a tool', async () => {
      const mockResult = { content: [{ type: 'text', text: 'result' }], isError: false }
      const mockTools = [{ name: 'tool1', description: 'desc1', inputSchema: {} }]

      vi.mocked(toolRegistry.getTools).mockResolvedValue(mockTools)
      vi.mocked(mockClient.callTool).mockResolvedValue(mockResult)

      const result = await service.callTool(serverId, 'tool1', { arg: 'val' })

      expect(result.content[0]!.text).toBe('result')
      expect(mockClient.callTool).toHaveBeenCalledWith({
        name: 'tool1',
        arguments: { arg: 'val' },
      })
    })

    it('should throw error if calling tool on non-existent server', async () => {
      vi.mocked(connectionManager.getConnection).mockReturnValue(undefined)
      await expect(service.callTool('invalid', 'tool1', {})).rejects.toThrow(
        'Not connected to MCP server',
      )
    })

    it('should throw error if tool does not exist', async () => {
      vi.mocked(toolRegistry.getTools).mockResolvedValue([])
      await expect(service.callTool(serverId, 'invalid-tool', {})).rejects.toThrow(
        'Tool "invalid-tool" not found',
      )
    })
  })

  describe('disconnect', () => {
    it('should disconnect and remove connection', async () => {
      const serverId = 'test-disconnect'

      await service.disconnect(serverId)

      expect(toolRegistry.clearCache).toHaveBeenCalledWith(serverId)
      expect(connectionManager.disconnect).toHaveBeenCalledWith(serverId)
    })
  })
})
