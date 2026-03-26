import { getToken } from '@/api'
import type { AIConfig } from './useAIConfig'
import { hasRuntimeAuthToken } from './useChatActions.utils'
import { buildAiToolsFromMcpTools } from './useChatActions.mcpTools'
import {
  buildSkillReadTool,
  buildSkillRuntimeTools,
  createSkillReadToolHandler,
  getSkillRuntimeAvailability,
  READ_SKILL_TOOL_NAME,
  resolveSkillRuntime,
  type AISkill,
  type AISkillRuntimeAvailability,
  type Tool,
} from '@/features/ai/services/aiService'
import type { McpToolResponse } from '@/features/mcp/api/mcp'

type SkillContext = {
  catalogSkills: AISkill[]
  activatedSkills: AISkill[]
}

type LocalToolHandler = (args: Record<string, unknown>) => string | Promise<string>

type McpApiClient = typeof import('@/features/mcp/api/mcp').mcpApi

export async function prepareRuntimeCapabilities(params: {
  aiConfig: AIConfig
  getAuthToken: () => string | null
  hydrateAuth: () => void
  skillContext: SkillContext
}): Promise<{
  mcpApi: McpApiClient
  mcpTools: McpToolResponse[]
  aiTools: Tool[]
  mcpToolLookup: Map<string, { serverId: string; toolName: string }>
  localToolHandlers: Map<string, LocalToolHandler>
  activeSkillsForPrompt: AISkill[]
  skillRuntimeAvailability: AISkillRuntimeAvailability[]
}> {
  params.hydrateAuth()

  const hasRuntimeAuthAccess = hasRuntimeAuthToken(params.getAuthToken(), getToken())
  const { mcpApi } = await import('@/features/mcp/api/mcp')

  let mcpTools: McpToolResponse[] = []
  if (params.aiConfig.mcpEnabled && hasRuntimeAuthAccess) {
    try {
      mcpTools = await mcpApi.getAllTools()
    } catch (error) {
      console.error('Failed to fetch MCP tools:', error)
    }
  }

  const { aiTools: mcpAiTools, mcpToolLookup } = buildAiToolsFromMcpTools(mcpTools)
  const aiTools = [...mcpAiTools]
  const localToolHandlers = new Map<string, LocalToolHandler>()
  const skillRuntimeAvailability = getSkillRuntimeAvailability(
    params.skillContext.activatedSkills,
    {
      mcpTools,
      enableHttpRuntime: hasRuntimeAuthAccess,
      enableMcpRuntime: params.aiConfig.mcpEnabled && hasRuntimeAuthAccess,
    },
  )
  const activeSkillsForPrompt = params.skillContext.activatedSkills.filter(
    (skill) => !resolveSkillRuntime(skill),
  )
  const skillRuntime = buildSkillRuntimeTools(params.skillContext.activatedSkills, {
    mcpTools,
    callMcpTool: mcpApi.callTool,
    enableHttpRuntime: hasRuntimeAuthAccess,
    enableMcpRuntime: params.aiConfig.mcpEnabled && hasRuntimeAuthAccess,
  })

  aiTools.unshift(...skillRuntime.aiTools)
  skillRuntime.localToolHandlers.forEach((handler, name) => {
    localToolHandlers.set(name, handler)
  })

  const skillReadTool = buildSkillReadTool(params.skillContext.catalogSkills)
  if (skillReadTool) {
    aiTools.push(skillReadTool)
    localToolHandlers.set(
      READ_SKILL_TOOL_NAME,
      createSkillReadToolHandler(params.skillContext.catalogSkills),
    )
  }

  return {
    mcpApi,
    mcpTools,
    aiTools,
    mcpToolLookup,
    localToolHandlers,
    activeSkillsForPrompt,
    skillRuntimeAvailability,
  }
}
