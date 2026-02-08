import { Module } from '@nestjs/common'
import { McpController } from './mcp.controller'
import { McpServerConfigService } from './mcp-server-config.service'
import { McpClientService } from './mcp-client.service'

/**
 * MCP (Model Context Protocol) 模块
 * 提供对外部 MCP 服务器的管理和调用功能
 */
@Module({
  controllers: [McpController],
  providers: [McpServerConfigService, McpClientService],
  exports: [McpServerConfigService, McpClientService],
})
export class McpModule {}
