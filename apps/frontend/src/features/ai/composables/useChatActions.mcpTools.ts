import type { Tool } from '@/features/ai/services/aiService'
import type { McpToolResponse } from '@/features/mcp/api/mcp'

function fnv1a(input: string): string {
  let hash = 0x811c9dc5
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193)
  }
  return (hash >>> 0).toString(16)
}

function buildMcpAiToolName(serverId: string, toolName: string): string {
  const safeServer = serverId.slice(0, 8).replace(/[^a-zA-Z0-9_-]/g, '_')
  const safeTool = toolName.replace(/[^a-zA-Z0-9_-]/g, '_')
  const prefix = `mcp_${safeServer}_`
  const full = `${prefix}${safeTool}`

  if (full.length <= 64) return full

  const hash = fnv1a(`${serverId}:${toolName}`).slice(0, 8)
  const keep = Math.max(0, 64 - prefix.length - 1 - hash.length)
  return `${prefix}${safeTool.slice(0, keep)}_${hash}`.slice(0, 64)
}

export function buildAiToolsFromMcpTools(mcpTools: McpToolResponse[]): {
  aiTools: Tool[]
  mcpToolLookup: Map<string, { serverId: string; toolName: string }>
} {
  const mcpToolLookup = new Map<string, { serverId: string; toolName: string }>()

  const aiTools: Tool[] = mcpTools
    .filter((t) => !!t.serverId)
    .map((t) => {
      const serverId = t.serverId as string
      const aiName = buildMcpAiToolName(serverId, t.name)
      mcpToolLookup.set(aiName, { serverId, toolName: t.name })
      return {
        type: 'function',
        function: {
          name: aiName,
          description: t.description,
          parameters: t.inputSchema,
        },
      }
    })

  return { aiTools, mcpToolLookup }
}
