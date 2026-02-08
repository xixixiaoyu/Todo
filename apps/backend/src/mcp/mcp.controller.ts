import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
  Logger,
} from '@nestjs/common'
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'
import { CurrentUser } from '../auth/current-user.decorator'
import { McpServerConfigService } from './mcp-server-config.service'
import { McpClientService } from './mcp-client.service'
import {
  CreateMcpServerDto,
  UpdateMcpServerDto,
  CallToolDto,
  type McpServerResponse,
  type McpToolResponse,
  type ToolCallResult,
} from './mcp.dto'

interface JwtPayload {
  sub: number
  email: string
}

@ApiTags('MCP')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('mcp')
export class McpController {
  private readonly logger = new Logger(McpController.name)

  constructor(
    private readonly configService: McpServerConfigService,
    private readonly clientService: McpClientService,
  ) {}

  /**
   * 创建 MCP Server 配置
   */
  @Post('servers')
  @ApiOperation({ summary: 'Create MCP server configuration' })
  async createServer(
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateMcpServerDto,
  ): Promise<McpServerResponse> {
    return this.configService.create(user.sub, dto)
  }

  /**
   * 获取所有 MCP Server 配置
   */
  @Get('servers')
  @ApiOperation({ summary: 'Get all MCP server configurations' })
  async getServers(@CurrentUser() user: JwtPayload): Promise<McpServerResponse[]> {
    return this.configService.findAll(user.sub)
  }

  /**
   * 获取单个 MCP Server 配置
   */
  @Get('servers/:id')
  @ApiOperation({ summary: 'Get MCP server configuration by ID' })
  async getServer(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<McpServerResponse> {
    return this.configService.findOne(user.sub, id)
  }

  /**
   * 更新 MCP Server 配置
   */
  @Put('servers/:id')
  @ApiOperation({ summary: 'Update MCP server configuration' })
  async updateServer(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateMcpServerDto,
  ): Promise<McpServerResponse> {
    return this.configService.update(user.sub, id, dto)
  }

  /**
   * 删除 MCP Server 配置
   */
  @Delete('servers/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete MCP server configuration' })
  async deleteServer(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    // 先断开连接（如果有的话）
    await this.clientService.disconnect(id)
    await this.configService.delete(user.sub, id)
  }

  /**
   * 获取 MCP Server 提供的工具列表
   */
  @Get('servers/:id/tools')
  @ApiOperation({ summary: 'Get available tools from MCP server' })
  async getTools(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<McpToolResponse[]> {
    // 先验证所有权并获取配置
    const config = await this.configService.findOne(user.sub, id)

    // 确保已连接
    if (!this.clientService.isConnected(id)) {
      await this.clientService.connect(id, config.transport, config.config)
    }

    return this.clientService.listTools(id)
  }

  /**
   * 调用 MCP Server 的工具
   */
  @Post('servers/:id/tools/call')
  @ApiOperation({ summary: 'Call a tool on MCP server' })
  async callTool(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CallToolDto,
  ): Promise<ToolCallResult> {
    // 先验证所有权并获取配置
    const config = await this.configService.findOne(user.sub, id)

    // 确保已连接
    if (!this.clientService.isConnected(id)) {
      await this.clientService.connect(id, config.transport, config.config)
    }

    return this.clientService.callTool(id, dto.name, dto.arguments)
  }

  /**
   * 获取所有启用的 MCP Server 工具列表 (用于 AI 辅助)
   */
  @Get('tools')
  @ApiOperation({ summary: 'Get all tools from all enabled MCP servers' })
  async getEnabledTools(@CurrentUser() user: JwtPayload): Promise<McpToolResponse[]> {
    const enabledServers = await this.configService.findEnabled(user.sub)
    const allTools: McpToolResponse[] = []

    for (const server of enabledServers) {
      try {
        // 自动连接
        if (!this.clientService.isConnected(server.id)) {
          await this.clientService.connect(server.id, server.transport, server.config)
        }
        const tools = await this.clientService.listTools(server.id)
        // 注入 serverId
        allTools.push(...tools.map((t) => ({ ...t, serverId: server.id })))
      } catch (error) {
        this.logger.error(`Failed to load tools from server ${server.name} (${server.id}):`, error)
        // 忽略单个服务器故障，继续加载其他服务
      }
    }

    return allTools
  }

  /**
   * 手动连接到 MCP Server
   */
  @Post('servers/:id/connect')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Connect to MCP server' })
  async connect(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    const config = await this.configService.findOne(user.sub, id)
    await this.clientService.connect(id, config.transport, config.config)
  }

  /**
   * 断开与 MCP Server 的连接
   */
  @Post('servers/:id/disconnect')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Disconnect from MCP server' })
  async disconnect(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    // 验证所有权
    await this.configService.findOne(user.sub, id)
    await this.clientService.disconnect(id)
  }
}
