import { z } from 'zod'

/**
 * MCP Server Transport 类型
 */
export const McpTransportType = {
  STDIO: 'stdio',
  HTTP: 'http',
} as const

export type McpTransportType = (typeof McpTransportType)[keyof typeof McpTransportType]

function isPrivateOrLoopbackIpv4(hostname: string): boolean {
  const parts = hostname.split('.')
  if (parts.length !== 4) return false
  if (!parts.every((p) => /^\d+$/.test(p))) return false

  const octets = parts.map((p) => Number(p)) as [number, number, number, number]
  if (octets.some((o) => o < 0 || o > 255)) return false

  const [a, b] = octets
  if (a === 10) return true
  if (a === 127) return true
  if (a === 169 && b === 254) return true
  if (a === 172 && b >= 16 && b <= 31) return true
  if (a === 192 && b === 168) return true
  if (a === 0) return true

  return false
}

function isPrivateOrLoopbackIpv6(hostname: string): boolean {
  const normalized = hostname.toLowerCase()
  if (!normalized.includes(':')) return false
  if (normalized === '::1') return true
  if (normalized.startsWith('fe80:')) return true
  if (normalized.startsWith('fc') || normalized.startsWith('fd')) return true
  return false
}

function isBlockedHostname(hostname: string): boolean {
  const normalized = hostname.toLowerCase()

  if (
    normalized === 'localhost' ||
    normalized.endsWith('.localhost') ||
    normalized.endsWith('.local')
  ) {
    return true
  }

  if (isPrivateOrLoopbackIpv4(normalized)) {
    return true
  }

  if (isPrivateOrLoopbackIpv6(normalized)) {
    return true
  }

  return false
}

function isAllowedMcpHttpUrl(url: string): boolean {
  try {
    const parsed = new URL(url)
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return false
    }

    return !isBlockedHostname(parsed.hostname)
  } catch {
    return false
  }
}

/**
 * Stdio Transport 配置 Schema
 */
export const StdioConfigSchema = z.object({
  command: z.string().min(1, 'Command is required'),
  args: z.array(z.string()).optional().default([]),
  env: z.record(z.string()).optional(),
  cwd: z.string().optional(),
})

export type StdioConfig = z.infer<typeof StdioConfigSchema>

/**
 * 创建 MCP Server 参数
 */
export type CreateMcpServerDto = z.infer<typeof CreateMcpServerSchema>

/**
 * 更新 MCP Server 参数
 */
export type UpdateMcpServerDto = z.infer<typeof UpdateMcpServerSchema>

/**
 * HTTP Transport 基础配置 Schema（不含 URL 安全校验）
 * 用于组合出不同安全策略的 HTTP 配置
 */
export const HttpConfigBaseSchema = z.object({
  url: z.string().url('Invalid URL format'),
  headers: z.record(z.string()).optional(),
  auth: z
    .object({
      type: z.enum(['bearer', 'api_key', 'oauth']),
      token: z.string().optional(),
      apiKey: z.string().optional(),
      apiKeyHeader: z.string().optional().default('X-API-Key'),
    })
    .optional(),
})

/**
 * 桌面端 HTTP URL 校验 — 仅验证协议，允许 localhost / private IP
 */
function isLocalMcpHttpUrl(data: { url: string }): boolean {
  try {
    const parsed = new URL(data.url)
    return parsed.protocol === 'http:' || parsed.protocol === 'https:'
  } catch {
    return false
  }
}

/**
 * HTTP Transport 配置 Schema（服务端 — 拦截私有地址）
 */
export const HttpConfigSchema = HttpConfigBaseSchema.refine(
  (data) => isAllowedMcpHttpUrl(data.url),
  'Only public http(s) MCP URLs are allowed',
)

export type HttpConfig = z.infer<typeof HttpConfigSchema>

/**
 * HTTP Transport 配置 Schema（桌面端 — 允许 localhost / private IP）
 */
export const LocalHttpConfigSchema = HttpConfigBaseSchema.refine(
  isLocalMcpHttpUrl,
  'Only http(s) MCP URLs are allowed',
)

export type LocalHttpConfig = z.infer<typeof LocalHttpConfigSchema>

/**
 * 创建 MCP Server 配置的基础对象 Schema
 */
export const McpServerBaseSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  description: z.string().max(500).optional(),
  transport: z.enum([McpTransportType.STDIO, McpTransportType.HTTP]),
  config: z.union([StdioConfigSchema, HttpConfigSchema]),
  enabled: z.boolean().optional().default(true),
})

/**
 * 验证 Transport 和 Config 是否匹配的逻辑
 */
const validateTransportConfig = (data: Record<string, unknown>) => {
  if (!data.transport || !data.config) return true // 让 partial 模式下的校验通过
  if (data.transport === McpTransportType.STDIO) {
    return StdioConfigSchema.safeParse(data.config).success
  }
  if (data.transport === McpTransportType.HTTP) {
    return HttpConfigSchema.safeParse(data.config).success
  }
  return false
}

/**
 * 创建 MCP Server 配置 Schema
 */
export const CreateMcpServerSchema = McpServerBaseSchema.refine(validateTransportConfig, {
  message: 'Config must match the transport type',
  path: ['config'],
})

/**
 * 更新 MCP Server 配置 Schema
 */
export const UpdateMcpServerSchema = McpServerBaseSchema.partial()
  .refine(validateTransportConfig, {
    message: 'Config must match the transport type',
    path: ['config'],
  })
  .superRefine((data, ctx) => {
    const hasTransport = data.transport !== undefined
    const hasConfig = data.config !== undefined

    if (hasTransport !== hasConfig) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['config'],
        message: 'transport and config must be provided together when updating runtime config',
      })
    }
  })

/**
 * 桌面端 MCP Server 配置基础 Schema（使用 LocalHttpConfigSchema）
 */
export const LocalMcpServerBaseSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  description: z.string().max(500).optional(),
  transport: z.enum([McpTransportType.STDIO, McpTransportType.HTTP]),
  config: z.union([StdioConfigSchema, LocalHttpConfigSchema]),
  enabled: z.boolean().optional().default(true),
})

/**
 * 桌面端验证 Transport 和 Config 是否匹配
 */
const validateLocalTransportConfig = (data: Record<string, unknown>) => {
  if (!data.transport || !data.config) return true
  if (data.transport === McpTransportType.STDIO) {
    return StdioConfigSchema.safeParse(data.config).success
  }
  if (data.transport === McpTransportType.HTTP) {
    return LocalHttpConfigSchema.safeParse(data.config).success
  }
  return false
}

/**
 * 桌面端创建 MCP Server 配置 Schema
 */
export const CreateLocalMcpServerSchema = LocalMcpServerBaseSchema.refine(
  validateLocalTransportConfig,
  { message: 'Config must match the transport type', path: ['config'] },
)

export type CreateLocalMcpServerDto = z.infer<typeof CreateLocalMcpServerSchema>

/**
 * 桌面端更新 MCP Server 配置 Schema
 */
export const UpdateLocalMcpServerSchema = LocalMcpServerBaseSchema.partial()
  .refine(validateLocalTransportConfig, {
    message: 'Config must match the transport type',
    path: ['config'],
  })
  .superRefine((data, ctx) => {
    const hasTransport = data.transport !== undefined
    const hasConfig = data.config !== undefined
    if (hasTransport !== hasConfig) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['config'],
        message: 'transport and config must be provided together when updating runtime config',
      })
    }
  })

export type UpdateLocalMcpServerDto = z.infer<typeof UpdateLocalMcpServerSchema>

/**
 * 调用工具 Schema
 */
export const CallToolSchema = z.object({
  name: z.string().min(1, 'Tool name is required'),
  arguments: z.record(z.unknown()).optional().default({}),
})

/**
 * MCP Server 响应类型
 */
export interface McpServerResponse {
  id: string
  name: string
  description: string | null
  transport: McpTransportType
  config: StdioConfig | HttpConfig
  enabled: boolean
  userId: number
  createdAt: string | Date
  updatedAt: string | Date
}

/**
 * MCP Tool 响应类型
 */
export interface McpToolResponse {
  name: string
  description?: string
  inputSchema: Record<string, unknown>
  serverId?: string // 所属服务器 ID
}

/**
 * Tool 调用结果类型
 */
export interface ToolCallResult {
  content: Array<{
    type: string
    text?: string
    data?: string
    mimeType?: string
    [key: string]: unknown
  }>
  isError?: boolean
}
