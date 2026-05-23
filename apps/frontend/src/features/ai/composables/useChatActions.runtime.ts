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
} from '@/features/ai/services/aiService'
import type { AISkill, AISkillRuntimeAvailability, Tool } from '@/features/ai/services/aiService'
import type { McpToolResponse } from '@/features/mcp/api/mcp'
import { AGENT_TOOL_DEFINITIONS, buildAgentLocalToolHandlers } from './useChatActions.agentTools'
import {
  WEB_SEARCH_TOOL_DEFINITION,
  executeWebSearch,
  hasWebSearchApiKey,
} from './useChatActions.webSearch'

type SkillContext = {
  catalogSkills: AISkill[]
  activatedSkills: AISkill[]
}

type LocalToolHandler = (args: Record<string, unknown>) => string | Promise<string>

type McpApiClient = typeof import('@/features/mcp/api/mcp').mcpApi

interface SidecarState {
  port: number | null
  token: string | null
  isAvailable: boolean
}

export async function prepareRuntimeCapabilities(params: {
  aiConfig: AIConfig
  getAuthToken: () => string | null
  hydrateAuth: () => void
  skillContext: SkillContext
  /** Sidecar state for agent file tools */
  sidecarState?: SidecarState
  /** Current session ID for stage_files backend registration */
  sessionId?: string | null
}): Promise<{
  mcpApi: McpApiClient
  mcpTools: McpToolResponse[]
  aiTools: Tool[]
  mcpToolLookup: Map<string, { serverId: string; toolName: string }>
  localToolHandlers: Map<string, LocalToolHandler>
  activeSkillsForPrompt: AISkill[]
  skillRuntimeAvailability: AISkillRuntimeAvailability[]
  agentToolsEnabled: boolean
}> {
  params.hydrateAuth()

  const hasRuntimeAuthAccess = hasRuntimeAuthToken(params.getAuthToken(), null)
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

  // web_search 仅在已配置 API Key 时注册，避免无 Key 时 AI 仍尝试调用
  if (hasWebSearchApiKey()) {
    aiTools.push(WEB_SEARCH_TOOL_DEFINITION)
    localToolHandlers.set('web_search', (args) => executeWebSearch(args))
  }

  const agentToolsEnabled = params.aiConfig.agentMode && params.sidecarState?.isAvailable === true

  if (agentToolsEnabled && params.sidecarState) {
    const agentAiTools = AGENT_TOOL_DEFINITIONS
    const agentHandlers = buildAgentLocalToolHandlers({
      sidecar: params.sidecarState,
    })

    aiTools.push(...agentAiTools)
    agentHandlers.forEach((handler, name) => {
      if (!localToolHandlers.has(name)) {
        localToolHandlers.set(name, handler)
      }
    })
  }

  return {
    mcpApi,
    mcpTools,
    aiTools,
    mcpToolLookup,
    localToolHandlers,
    activeSkillsForPrompt,
    skillRuntimeAvailability,
    agentToolsEnabled,
  }
}
