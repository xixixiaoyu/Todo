import { createZodDto } from 'nestjs-zod'
import {
  CreateMcpServerSchema,
  UpdateMcpServerSchema,
  CallToolSchema,
  McpTransportType,
} from '@lumina/shared'
import type {
  McpServerResponse as SharedMcpServerResponse,
  McpToolResponse as SharedMcpToolResponse,
  ToolCallResult as SharedToolCallResult,
  StdioConfig,
  HttpConfig,
} from '@lumina/shared'

/**
 * Re-export McpTransportType for convenience in backend
 */
export { McpTransportType }

/**
 * 创建 MCP Server 配置 DTO
 */
export class CreateMcpServerDto extends createZodDto(CreateMcpServerSchema) {}

/**
 * 更新 MCP Server 配置 DTO
 */
export class UpdateMcpServerDto extends createZodDto(UpdateMcpServerSchema) {}

/**
 * 调用工具 DTO
 */
export class CallToolDto extends createZodDto(CallToolSchema) {}

/**
 * MCP Server 响应类型 (后端扩展 Date 类型)
 */
export interface McpServerResponse extends Omit<
  SharedMcpServerResponse,
  'createdAt' | 'updatedAt'
> {
  createdAt: Date
  updatedAt: Date
}

/**
 * MCP Tool 响应类型
 */
export type McpToolResponse = SharedMcpToolResponse

/**
 * Tool 调用结果类型
 */
export type ToolCallResult = SharedToolCallResult

/**
 * Transport 配置类型
 */
export type { StdioConfig, HttpConfig }
