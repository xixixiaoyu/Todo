import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Test, TestingModule } from '@nestjs/testing'
import { McpServerConfigService } from '@/mcp/mcp-server-config.service'
import { PrismaService } from '@/prisma/prisma.service'
import { McpTransportType } from '@/mcp/mcp.dto'
import { NotFoundException } from '@nestjs/common'

describe('McpServerConfigService', () => {
  let service: McpServerConfigService
  const mockPrisma = {
    mcpServer: {
      create: vi.fn(),
      findMany: vi.fn(),
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

  describe('create', () => {
    it('should create a new MCP server config', async () => {
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
        createdAt: new Date(),
        updatedAt: new Date(),
      }
      mockPrisma.mcpServer.create.mockResolvedValue(mockResult)

      const result = await service.create(dto)

      expect(mockPrisma.mcpServer.create).toHaveBeenCalledWith({
        data: {
          name: dto.name,
          description: dto.description,
          transport: dto.transport,
          config: dto.config,
          enabled: dto.enabled,
        },
      })
      expect(result.id).toBe('uuid')
    })
  })

  describe('findAll', () => {
    it('should return all servers', async () => {
      const mockServers = [
        {
          id: '1',
          name: 'S1',
          transport: 'stdio',
          config: {},
          enabled: true,
          createdAt: new Date(),
          updatedAt: new Date(),
          description: null,
        },
      ]
      mockPrisma.mcpServer.findMany.mockResolvedValue(mockServers)

      const result = await service.findAll()

      expect(mockPrisma.mcpServer.findMany).toHaveBeenCalledWith({
        orderBy: { createdAt: 'desc' },
      })
      expect(result).toHaveLength(1)
      expect(result[0]!.name).toBe('S1')
    })
  })

  describe('delete', () => {
    it('should throw NotFoundException if server not found', async () => {
      mockPrisma.mcpServer.findFirst.mockResolvedValue(null)
      await expect(service.delete('uuid')).rejects.toThrow(NotFoundException)
    })

    it('should delete server if it exists', async () => {
      mockPrisma.mcpServer.findFirst.mockResolvedValue({
        id: 'uuid',
        name: 'Test',
        description: null,
        transport: 'stdio',
        config: {},
        enabled: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      mockPrisma.mcpServer.delete.mockResolvedValue({ id: 'uuid' })

      await service.delete('uuid')

      expect(mockPrisma.mcpServer.delete).toHaveBeenCalledWith({
        where: { id: 'uuid' },
      })
    })
  })
})
