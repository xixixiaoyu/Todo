import { Injectable, Logger, NotFoundException, ForbiddenException, Inject } from '@nestjs/common'
import { PrismaService } from '@/prisma/prisma.service'
import type { CreateMcpServerDto, UpdateMcpServerDto, McpServerResponse } from './mcp.dto'

/**
 * MCP Server 配置管理服务
 * 处理用户的 MCP Server 配置 CRUD 操作
 */
@Injectable()
export class McpServerConfigService {
  private readonly logger = new Logger(McpServerConfigService.name)

  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  /**
   * 创建新的 MCP Server 配置
   */
  async create(userId: number, dto: CreateMcpServerDto): Promise<McpServerResponse> {
    const server = await this.prisma.mcpServer.create({
      data: {
        name: dto.name,
        description: dto.description,
        transport: dto.transport,
        config: dto.config as object,
        enabled: dto.enabled ?? true,
        userId,
      },
    })

    this.logger.log(`Created MCP server config: ${server.id} for user ${userId}`)

    return this.toResponse(server)
  }

  /**
   * 获取用户的所有 MCP Server 配置
   */
  async findAll(userId: number): Promise<McpServerResponse[]> {
    const servers = await this.prisma.mcpServer.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    })

    return servers.map((s) => this.toResponse(s))
  }

  /**
   * 获取单个 MCP Server 配置
   */
  async findOne(userId: number, id: string): Promise<McpServerResponse> {
    const server = await this.prisma.mcpServer.findFirst({
      where: { id, userId },
    })

    if (!server) {
      throw new NotFoundException(`MCP server config not found: ${id}`)
    }

    return this.toResponse(server)
  }

  /**
   * 更新 MCP Server 配置
   */
  async update(userId: number, id: string, dto: UpdateMcpServerDto): Promise<McpServerResponse> {
    // 先验证所有权
    await this.validateOwnership(userId, id)

    const server = await this.prisma.mcpServer.update({
      where: { id },
      data: {
        ...(dto.name && { name: dto.name }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.transport && { transport: dto.transport }),
        ...(dto.config && { config: dto.config as object }),
        ...(dto.enabled !== undefined && { enabled: dto.enabled }),
      },
    })

    this.logger.log(`Updated MCP server config: ${id}`)

    return this.toResponse(server)
  }

  /**
   * 删除 MCP Server 配置
   */
  async delete(userId: number, id: string): Promise<void> {
    await this.validateOwnership(userId, id)

    await this.prisma.mcpServer.delete({
      where: { id },
    })

    this.logger.log(`Deleted MCP server config: ${id}`)
  }

  /**
   * 获取用户所有启用的 MCP Server 配置
   * 用于 AI 助手自动发现工具
   */
  async findEnabled(userId: number): Promise<McpServerResponse[]> {
    const servers = await this.prisma.mcpServer.findMany({
      where: { userId, enabled: true },
      orderBy: { createdAt: 'asc' },
    })

    return servers.map((s) => this.toResponse(s))
  }

  /**
   * 验证配置所有权
   */
  private async validateOwnership(userId: number, id: string): Promise<void> {
    const server = await this.prisma.mcpServer.findUnique({
      where: { id },
      select: { userId: true },
    })

    if (!server) {
      throw new NotFoundException(`MCP server config not found: ${id}`)
    }

    if (server.userId !== userId) {
      throw new ForbiddenException('You do not have permission to access this config')
    }
  }

  /**
   * 转换为响应格式
   */
  private toResponse(server: {
    id: string
    name: string
    description: string | null
    transport: string
    config: unknown
    enabled: boolean
    userId: number
    createdAt: Date
    updatedAt: Date
  }): McpServerResponse {
    return {
      id: server.id,
      name: server.name,
      description: server.description,
      transport: server.transport as McpServerResponse['transport'],
      config: server.config as McpServerResponse['config'],
      enabled: server.enabled,
      userId: server.userId,
      createdAt: server.createdAt,
      updatedAt: server.updatedAt,
    }
  }
}
