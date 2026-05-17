import { Injectable, Logger, NotFoundException, Inject } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import type { CreateMcpServerDto, UpdateMcpServerDto, McpServerResponse } from './mcp.dto'

/**
 * MCP Server 配置管理服务
 * 处理 MCP Server 配置的全局 CRUD 操作
 */
@Injectable()
export class McpServerConfigService {
  private readonly logger = new Logger(McpServerConfigService.name)

  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  /**
   * 创建新的 MCP Server 配置
   */
  async create(dto: CreateMcpServerDto): Promise<McpServerResponse> {
    const server = await this.prisma.mcpServer.create({
      data: {
        name: dto.name,
        description: dto.description,
        transport: dto.transport,
        config: dto.config as object,
        enabled: dto.enabled ?? true,
      },
    })

    this.logger.log(`Created MCP server config: ${server.id}`)

    return this.toResponse(server)
  }

  /**
   * 获取所有 MCP Server 配置
   */
  async findAll(): Promise<McpServerResponse[]> {
    const servers = await this.prisma.mcpServer.findMany({
      orderBy: { createdAt: 'desc' },
    })

    return servers.map((s) => this.toResponse(s))
  }

  /**
   * 获取单个 MCP Server 配置
   */
  async findOne(id: string): Promise<McpServerResponse> {
    const server = await this.prisma.mcpServer.findFirst({
      where: { id },
    })

    if (!server) {
      throw new NotFoundException(`MCP server config not found: ${id}`)
    }

    return this.toResponse(server)
  }

  /**
   * 更新 MCP Server 配置
   */
  async update(id: string, dto: UpdateMcpServerDto): Promise<McpServerResponse> {
    // 验证存在性
    await this.findOne(id)

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
  async delete(id: string): Promise<void> {
    // 验证存在性
    await this.findOne(id)

    await this.prisma.mcpServer.delete({
      where: { id },
    })

    this.logger.log(`Deleted MCP server config: ${id}`)
  }

  /**
   * 获取所有启用的 MCP Server 配置
   * 用于 AI 助手自动发现工具
   */
  async findEnabled(): Promise<McpServerResponse[]> {
    const servers = await this.prisma.mcpServer.findMany({
      where: { enabled: true },
      orderBy: { createdAt: 'asc' },
    })

    return servers.map((s) => this.toResponse(s))
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
      createdAt: server.createdAt,
      updatedAt: server.updatedAt,
    }
  }
}
