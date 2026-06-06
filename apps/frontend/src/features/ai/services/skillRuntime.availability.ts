import type { McpToolResponse, ToolCallResult } from '@/features/mcp/api/mcp'
import { getSkillRuntimeConfig } from '@/features/ai/composables/useSkillRuntimeConfig'
import type { SkillRuntimeConfig } from '@/features/ai/composables/useSkillRuntimeConfig'
import type { AISkill, AISkillMcpRuntime, AISkillRuntimeAvailability, Tool } from './types'
import { callSkillHttpRuntime } from './skillRuntime.http'
import {
  isOmittedSkillRuntimeValue,
  materializeSkillRuntimeArgsTemplateValue,
} from './skillRuntime.materialization'
import {
  createExecutableHttpRuntime,
  getMissingRequiredSecretLabels,
  pickConfiguredSecrets,
} from './skillRuntime.config'
import { resolveSkillRuntime } from './skillRuntime.normalize'

type LocalToolHandler = (args: Record<string, unknown>) => string | Promise<string>

function resolveMcpRuntimeTarget(
  runtime: AISkillMcpRuntime,
  mcpTools: McpToolResponse[],
): { serverId: string; toolName: string } {
  const matches = mcpTools.filter((tool) => {
    if (!tool.serverId) return false
    if (tool.name !== runtime.target.toolName) return false
    if (runtime.target.serverId && tool.serverId !== runtime.target.serverId) return false
    return true
  })

  if (matches.length === 0) {
    throw new Error(`MCP tool not found: ${runtime.target.toolName}`)
  }

  if (!runtime.target.serverId && matches.length > 1) {
    throw new Error(
      `Ambiguous MCP tool "${runtime.target.toolName}". Add target.serverId to the skill runtime.`,
    )
  }

  const match = matches[0]
  if (!match.serverId) {
    throw new Error(`MCP tool "${runtime.target.toolName}" is missing serverId`)
  }

  return {
    serverId: match.serverId,
    toolName: match.name,
  }
}

function materializeMcpRuntimeArguments(
  runtime: AISkillMcpRuntime,
  args: Record<string, unknown>,
): Record<string, unknown> {
  if (runtime.arguments === undefined) {
    return args
  }

  const materialized = materializeSkillRuntimeArgsTemplateValue(runtime.arguments, args)
  if (isOmittedSkillRuntimeValue(materialized)) {
    return {}
  }

  if (materialized === null || typeof materialized !== 'object' || Array.isArray(materialized)) {
    throw new Error('MCP runtime arguments must resolve to an object')
  }

  return materialized
}

export function getSkillRuntimeAvailability(
  activeSkills: AISkill[],
  deps: {
    runtimeConfig?: SkillRuntimeConfig
    mcpTools?: McpToolResponse[]
    enableHttpRuntime?: boolean
    enableMcpRuntime?: boolean
  } = {},
): AISkillRuntimeAvailability[] {
  const runtimeConfig = deps.runtimeConfig ?? getSkillRuntimeConfig()
  const mcpTools = deps.mcpTools ?? []
  const enableHttpRuntime = deps.enableHttpRuntime ?? true
  const enableMcpRuntime = deps.enableMcpRuntime ?? true
  const registeredToolNames = new Set<string>()
  const availability: AISkillRuntimeAvailability[] = []

  for (const skill of activeSkills) {
    const runtime = resolveSkillRuntime(skill)
    if (!runtime) continue

    const toolName = runtime.tool.name
    if (!toolName || registeredToolNames.has(toolName)) continue
    registeredToolNames.add(toolName)

    if (runtime.type === 'http') {
      if (!enableHttpRuntime) {
        availability.push({
          skillId: skill.id,
          skillName: skill.name,
          runtimeType: runtime.type,
          toolName,
          status: 'blocked',
          reasonCode: 'auth_required',
        })
        continue
      }

      const missingSecrets = getMissingRequiredSecretLabels(runtime, runtimeConfig)
      if (missingSecrets.length > 0) {
        availability.push({
          skillId: skill.id,
          skillName: skill.name,
          runtimeType: runtime.type,
          toolName,
          status: 'blocked',
          reasonCode: 'missing_secrets',
          missingSecrets,
        })
        continue
      }

      availability.push({
        skillId: skill.id,
        skillName: skill.name,
        runtimeType: runtime.type,
        toolName,
        status: 'available',
      })
      continue
    }

    if (!enableMcpRuntime) {
      availability.push({
        skillId: skill.id,
        skillName: skill.name,
        runtimeType: runtime.type,
        toolName,
        status: 'blocked',
        reasonCode: 'mcp_disabled',
      })
      continue
    }

    try {
      resolveMcpRuntimeTarget(runtime, mcpTools)
      availability.push({
        skillId: skill.id,
        skillName: skill.name,
        runtimeType: runtime.type,
        toolName,
        status: 'available',
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      availability.push({
        skillId: skill.id,
        skillName: skill.name,
        runtimeType: runtime.type,
        toolName,
        status: 'blocked',
        reasonCode: message.includes('Ambiguous MCP tool')
          ? 'mcp_tool_ambiguous'
          : 'mcp_tool_not_found',
      })
    }
  }

  return availability
}

export function buildSkillRuntimeTools(
  activeSkills: AISkill[],
  deps: {
    runtimeConfig?: SkillRuntimeConfig
    executeHttpRuntime?: (payload: Parameters<typeof callSkillHttpRuntime>[0]) => Promise<unknown>
    mcpTools?: McpToolResponse[]
    callMcpTool?: (
      serverId: string,
      toolName: string,
      args: Record<string, unknown>,
    ) => Promise<ToolCallResult>
    enableHttpRuntime?: boolean
    enableMcpRuntime?: boolean
  } = {},
): {
  aiTools: Tool[]
  localToolHandlers: Map<string, LocalToolHandler>
} {
  const aiTools: Tool[] = []
  const localToolHandlers = new Map<string, LocalToolHandler>()
  const runtimeConfig = deps.runtimeConfig ?? getSkillRuntimeConfig()
  const executeHttpRuntime = deps.executeHttpRuntime ?? callSkillHttpRuntime
  const mcpTools = deps.mcpTools ?? []
  const enableHttpRuntime = deps.enableHttpRuntime ?? true
  const enableMcpRuntime = deps.enableMcpRuntime ?? true
  const registeredToolNames = new Set<string>()

  for (const skill of activeSkills) {
    const runtime = resolveSkillRuntime(skill)
    if (!runtime) continue
    if (runtime.type === 'http' && !enableHttpRuntime) continue
    if (runtime.type === 'mcp' && !enableMcpRuntime) continue

    const toolName = runtime.tool.name
    if (!toolName || registeredToolNames.has(toolName)) continue
    registeredToolNames.add(toolName)

    aiTools.push({
      type: 'function',
      function: {
        name: runtime.tool.name,
        description: runtime.tool.description,
        parameters: runtime.tool.parameters,
      },
    })

    localToolHandlers.set(toolName, async (args) => {
      if (runtime.type === 'http') {
        const secrets = pickConfiguredSecrets(runtime, runtimeConfig)
        const result = await executeHttpRuntime({
          skillName: skill.name,
          runtime: createExecutableHttpRuntime(runtime),
          arguments: args,
          ...(secrets ? { secrets } : {}),
        })

        return typeof result === 'string' ? result : JSON.stringify(result)
      }

      if (!deps.callMcpTool) {
        return JSON.stringify({
          error: 'MCP runtime is not available in the current chat context.',
        })
      }

      const target = resolveMcpRuntimeTarget(runtime, mcpTools)
      const mappedArgs = materializeMcpRuntimeArguments(runtime, args)
      const result = await deps.callMcpTool(target.serverId, target.toolName, mappedArgs)
      return JSON.stringify(result.content)
    })
  }

  return { aiTools, localToolHandlers }
}
