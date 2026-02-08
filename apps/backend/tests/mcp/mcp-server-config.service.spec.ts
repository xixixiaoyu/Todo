import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Test, TestingModule } from '@nestjs/testing'
import { McpServerConfigService } from '@/mcp/mcp-server-config.service'
import { PrismaService } from '@/prisma/prisma.service'
import { McpTransportType } from '@/mcp/mcp.dto'
import { NotFoundException, ForbiddenException } from '@nestjs/common'

describe('McpServerConfigService', () => {
  let service: McpServerConfigService
  const mockPrisma = {
    mcpServer: {
      create: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  }

  beforeEach(async () => {
    vi.clearAllMocks()
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        McpServerConfigService,
        {
          provide: PrismaService,
          useValue: mockPrisma,
        },
      ],
    }).compile()

    service = module.get<McpServerConfigService>(McpServerConfigService)
  })

  it('should be defined', () => {
    expect(service).toBeDefined()
  })

  describe('create', () => {
    it('should create a new MCP server config', async () => {
      const userId = 1
      const dto = {
        name: 'Test Server',
        description: 'Test Description',
        transport: McpTransportType.STDIO,
        config: { command: 'node', args: ['index.js'] },
        enabled: true,
      }
      const mockResult = {
        id: 'uuid',
        ...dto,
        userId,
        createdAt: new Date(),
        updatedAt: new Date(),
      }
      mockPrisma.mcpServer.create.mockResolvedValue(mockResult)

      const result = await service.create(userId, dto)

      expect(mockPrisma.mcpServer.create).toHaveBeenCalledWith({
        data: {
          name: dto.name,
          description: dto.description,
          transport: dto.transport,
          config: dto.config,
          enabled: dto.enabled,
          userId,
        },
      })
      expect(result.id).toBe('uuid')
    })
  })

  describe('findAll', () => {
    it('should return all servers for a user', async () => {
      const userId = 1
      const mockServers = [
        {
          id: '1',
          name: 'S1',
          transport: 'stdio',
          config: {},
          enabled: true,
          userId,
          createdAt: new Date(),
          updatedAt: new Date(),
          description: null,
        },
      ]
      mockPrisma.mcpServer.findMany.mockResolvedValue(mockServers)

      const result = await service.findAll(userId)

      expect(mockPrisma.mcpServer.findMany).toHaveBeenCalledWith({
        where: { userId },
        orderBy: { createdAt: 'desc' },
      })
      expect(result).toHaveLength(1)
      expect(result[0].name).toBe('S1')
    })
  })

  describe('validateOwnership', () => {
    it('should throw NotFoundException if server not found', async () => {
      mockPrisma.mcpServer.findUnique.mockResolvedValue(null)
      await expect(service.delete(1, 'uuid')).rejects.toThrow(NotFoundException)
    })

    it('should throw ForbiddenException if user does not own the server', async () => {
      mockPrisma.mcpServer.findUnique.mockResolvedValue({ userId: 2 })
      await expect(service.delete(1, 'uuid')).rejects.toThrow(ForbiddenException)
    })
  })
})
