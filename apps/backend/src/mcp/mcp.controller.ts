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
import type { User } from '@my-app/shared'
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
    @CurrentUser() user: User,
    @Body() dto: CreateMcpServerDto,
  ): Promise<McpServerResponse> {
    return this.configService.create(user.id, dto)
  }

  /**
   * 获取所有 MCP Server 配置
   */
  @Get('servers')
  @ApiOperation({ summary: 'Get all MCP server configurations' })
  async getServers(@CurrentUser() user: User): Promise<McpServerResponse[]> {
    return this.configService.findAll(user.id)
  }

  /**
   * 获取单个 MCP Server 配置
   */
  @Get('servers/:id')
  @ApiOperation({ summary: 'Get MCP server configuration by ID' })
  async getServer(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<McpServerResponse> {
    return this.configService.findOne(user.id, id)
  }

  /**
   * 更新 MCP Server 配置
   */
  @Put('servers/:id')
  @ApiOperation({ summary: 'Update MCP server configuration' })
  async updateServer(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateMcpServerDto,
  ): Promise<McpServerResponse> {
    return this.configService.update(user.id, id, dto)
  }

  /**
   * 删除 MCP Server 配置
   */
  @Delete('servers/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete MCP server configuration' })
  async deleteServer(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    return this.configService.delete(user.id, id)
  }

  /**
   * 获取已启用的所有工具
   */
  @Get('tools')
  @ApiOperation({ summary: 'Get all tools from all enabled MCP servers' })
  async getAllTools(@CurrentUser() user: User): Promise<McpToolResponse[]> {
    const enabledServers = await this.configService.findEnabled(user.id)
    const allTools: McpToolResponse[] = []

    for (const server of enabledServers) {
      try {
        // 如果未连接，尝试连接 (Lazy connection)
        if (!this.clientService.isConnected(server.id)) {
          this.logger.log(`Connecting to enabled server ${server.id} during tool discovery`)
          await this.clientService.connect(server.id, server.transport, server.config)
        }

        const tools = await this.clientService.listTools(server.id)
        // 注入 serverId 以便前端/模型识别工具归属
        allTools.push(...tools.map((t) => ({ ...t, serverId: server.id })))
      } catch (error) {
        this.logger.error(`Failed to get tools from enabled server ${server.id}:`, error)
      }
    }

    return allTools
  }

  /**
   * 连接到 MCP 服务器
   */
  @Post('servers/:id/connect')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Connect to MCP server' })
  async connect(@CurrentUser() user: User, @Param('id', ParseUUIDPipe) id: string): Promise<void> {
    const config = await this.configService.findOne(user.id, id)
    await this.clientService.connect(id, config.transport, config.config)
  }

  /**
   * 断开 MCP 服务器连接
   */
  @Post('servers/:id/disconnect')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Disconnect from MCP server' })
  async disconnect(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    // 验证所有权
    await this.configService.findOne(user.id, id)
    await this.clientService.disconnect(id)
  }

  /**
   * 获取单个服务器的工具
   */
  @Get('servers/:id/tools')
  @ApiOperation({ summary: 'Get tools from a specific MCP server' })
  async getTools(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<McpToolResponse[]> {
    // 验证权限
    const config = await this.configService.findOne(user.id, id)

    // 如果未连接，尝试连接
    if (!this.clientService.isConnected(id)) {
      await this.clientService.connect(id, config.transport, config.config)
    }

    return this.clientService.listTools(id)
  }

  /**
   * 调用工具
   */
  @Post('servers/:id/tools/call')
  @ApiOperation({ summary: 'Call a tool on MCP server' })
  async callTool(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CallToolDto,
  ): Promise<ToolCallResult> {
    // 验证权限
    const config = await this.configService.findOne(user.id, id)

    // 确保已连接
    if (!this.clientService.isConnected(id)) {
      await this.clientService.connect(id, config.transport, config.config)
    }

    return this.clientService.callTool(id, dto.name, dto.arguments || {})
  }
}
