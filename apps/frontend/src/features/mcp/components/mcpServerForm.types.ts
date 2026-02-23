import type { McpTransportType } from '@/features/mcp/api/mcp'

export type McpAuthType = 'bearer' | 'api_key' | 'oauth'

export interface McpServerFormState {
  name: string
  description: string
  transport: McpTransportType
  enabled: boolean
  config: {
    command: string
    args: string[]
    env: Record<string, string>
    cwd: string
    url: string
    headers: Record<string, string>
    auth: {
      type: McpAuthType
      token: string
      apiKey: string
      apiKeyHeader: string
    }
  }
}
