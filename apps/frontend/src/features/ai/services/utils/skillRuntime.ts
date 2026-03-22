import { httpClient } from '@/api'
import type { McpToolResponse, ToolCallResult } from '@/features/mcp/api/mcp'
import {
  getSkillRuntimeConfig,
  type SkillRuntimeConfig,
} from '@/features/ai/composables/useSkillRuntimeConfig'
import { unwrapApiResponse, type ApiResponse } from '@lumina/shared'
import type {
  AISkill,
  AISkillHttpRuntime,
  AISkillMcpRuntime,
  AISkillRuntimeAvailability,
  AISkillRuntime,
  AISkillRuntimeSecret,
  AISkillRuntimeTemplateValue,
  AISkillRuntimeValueBinding,
  Tool,
} from '../types'

export const TAVILY_SEARCH_TOOL_NAME = 'skill_tavily_search'

interface ExecuteSkillHttpRuntimeSecret {
  key: string
  required?: boolean
}

interface ExecuteSkillHttpRuntime {
  type: 'http'
  secrets?: ExecuteSkillHttpRuntimeSecret[]
  request: AISkillHttpRuntime['request']
}

export interface ExecuteSkillHttpRuntimeRequest {
  skillName: string
  runtime: ExecuteSkillHttpRuntime
  arguments: Record<string, unknown>
  secrets?: Record<string, string>
}

type MaterializedRuntimeValue =
  | string
  | number
  | boolean
  | null
  | MaterializedRuntimeValue[]
  | { [key: string]: MaterializedRuntimeValue }

const OMITTED_RUNTIME_VALUE = Symbol('omitted-runtime-value')

type LocalToolHandler = (args: Record<string, unknown>) => string | Promise<string>

const DEFAULT_HTTP_TIMEOUT_MS = 15000

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

function normalizeSkillToken(value: string): string {
  return value.trim().toLowerCase()
}

function hasAlias(skill: AISkill, candidates: string[]): boolean {
  return (skill.aliases || []).some((alias) => candidates.includes(normalizeSkillToken(alias)))
}

function isTavilySearchSkill(skill: AISkill): boolean {
  const candidates = ['tavily-search', 'tavily_search', 'tavily']
  const name = normalizeSkillToken(skill.name)
  return candidates.includes(name) || hasAlias(skill, candidates)
}

function normalizeString(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined
  const normalized = value.trim()
  return normalized || undefined
}

function normalizeFiniteNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined
}

function isRuntimeValueBinding(value: unknown): value is AISkillRuntimeValueBinding {
  if (!isRecord(value)) return false
  return value.$source === 'arg' || value.$source === 'secret'
}

function normalizeRuntimeTemplateValue(value: unknown): AISkillRuntimeTemplateValue | undefined {
  if (value === null) return null
  if (typeof value === 'string' || typeof value === 'boolean') return value

  const normalizedNumber = normalizeFiniteNumber(value)
  if (typeof normalizedNumber === 'number') return normalizedNumber

  if (Array.isArray(value)) {
    const items = value
      .map((item) => normalizeRuntimeTemplateValue(item))
      .filter((item): item is AISkillRuntimeTemplateValue => item !== undefined)

    return items
  }

  if (!isRecord(value)) return undefined

  if (isRuntimeValueBinding(value)) {
    const key = normalizeString(value.key)
    if (!key) return undefined

    const binding: AISkillRuntimeValueBinding = {
      $source: value.$source,
      key,
      ...(typeof value.required === 'boolean' ? { required: value.required } : {}),
      ...(normalizeString(value.prefix) ? { prefix: normalizeString(value.prefix) } : {}),
      ...(normalizeString(value.suffix) ? { suffix: normalizeString(value.suffix) } : {}),
    }

    const defaultValue = normalizeRuntimeTemplateValue(value.default)
    if (defaultValue !== undefined) {
      binding.default = defaultValue
    }

    return binding
  }

  const normalizedEntries = Object.entries(value)
    .map(([key, entryValue]) => {
      const normalizedValue = normalizeRuntimeTemplateValue(entryValue)
      return normalizedValue === undefined ? null : [key, normalizedValue]
    })
    .filter((entry): entry is [string, AISkillRuntimeTemplateValue] => !!entry)

  return Object.fromEntries(normalizedEntries)
}

function normalizeRuntimeSecrets(value: unknown): AISkillRuntimeSecret[] | undefined {
  if (!Array.isArray(value)) return undefined

  const seen = new Set<string>()
  const secrets = value
    .map((item) => {
      if (!isRecord(item)) return null

      const key = normalizeString(item.key)
      if (!key || seen.has(key)) return null
      seen.add(key)

      return {
        key,
        ...(normalizeString(item.label) ? { label: normalizeString(item.label) } : {}),
        ...(normalizeString(item.placeholder)
          ? { placeholder: normalizeString(item.placeholder) }
          : {}),
        ...(normalizeString(item.hint) ? { hint: normalizeString(item.hint) } : {}),
        ...(normalizeString(item.envVar) ? { envVar: normalizeString(item.envVar) } : {}),
        ...(typeof item.required === 'boolean' ? { required: item.required } : {}),
      } satisfies AISkillRuntimeSecret
    })
    .filter((item): item is AISkillRuntimeSecret => !!item)

  return secrets.length > 0 ? secrets : undefined
}

function normalizeHttpRuntime(value: unknown): AISkillHttpRuntime | undefined {
  if (
    !isRecord(value) ||
    value.type !== 'http' ||
    !isRecord(value.tool) ||
    !isRecord(value.request)
  ) {
    return undefined
  }

  const toolName = normalizeString(value.tool.name)
  const toolDescription = normalizeString(value.tool.description)
  const parameters = isRecord(value.tool.parameters) ? value.tool.parameters : undefined
  const url = normalizeString(value.request.url)

  if (!toolName || !toolDescription || !parameters || !url) {
    return undefined
  }

  const method =
    value.request.method === 'GET' || value.request.method === 'POST'
      ? value.request.method
      : undefined
  const timeoutMs = normalizeFiniteNumber(value.request.timeoutMs)
  const responseType =
    value.request.responseType === 'json' || value.request.responseType === 'text'
      ? value.request.responseType
      : undefined

  const headers = isRecord(value.request.headers)
    ? normalizeRuntimeTemplateValue(value.request.headers)
    : undefined
  const query = isRecord(value.request.query)
    ? normalizeRuntimeTemplateValue(value.request.query)
    : undefined
  const body =
    value.request.body !== undefined ? normalizeRuntimeTemplateValue(value.request.body) : undefined

  return {
    type: 'http',
    tool: {
      name: toolName,
      description: toolDescription,
      parameters,
    },
    ...(normalizeRuntimeSecrets(value.secrets)
      ? { secrets: normalizeRuntimeSecrets(value.secrets) }
      : {}),
    request: {
      url,
      ...(method ? { method } : {}),
      ...(isRecord(headers) ? { headers } : {}),
      ...(isRecord(query) ? { query } : {}),
      ...(body !== undefined ? { body } : {}),
      ...(typeof timeoutMs === 'number' ? { timeoutMs } : {}),
      ...(responseType ? { responseType } : {}),
    },
  }
}

function normalizeMcpRuntime(value: unknown): AISkillMcpRuntime | undefined {
  if (
    !isRecord(value) ||
    value.type !== 'mcp' ||
    !isRecord(value.tool) ||
    !isRecord(value.target)
  ) {
    return undefined
  }

  const toolName = normalizeString(value.tool.name)
  const toolDescription = normalizeString(value.tool.description)
  const parameters = isRecord(value.tool.parameters) ? value.tool.parameters : undefined
  const targetToolName = normalizeString(value.target.toolName)
  const targetServerId = normalizeString(value.target.serverId)
  const mappedArguments =
    value.arguments !== undefined ? normalizeRuntimeTemplateValue(value.arguments) : undefined

  if (!toolName || !toolDescription || !parameters || !targetToolName) {
    return undefined
  }

  return {
    type: 'mcp',
    tool: {
      name: toolName,
      description: toolDescription,
      parameters,
    },
    target: {
      toolName: targetToolName,
      ...(targetServerId ? { serverId: targetServerId } : {}),
    },
    ...(mappedArguments !== undefined ? { arguments: mappedArguments } : {}),
  }
}

export function normalizeSkillRuntime(value: unknown): AISkillRuntime | undefined {
  const normalizedMcpRuntime = normalizeMcpRuntime(value)
  if (normalizedMcpRuntime) return normalizedMcpRuntime

  const normalizedHttpRuntime = normalizeHttpRuntime(value)
  return normalizedHttpRuntime
}

function createMigratedTavilySearchRuntime(): AISkillHttpRuntime {
  return {
    type: 'http',
    tool: {
      name: TAVILY_SEARCH_TOOL_NAME,
      description:
        'Search the live web with Tavily for current information, news, and finance updates.',
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'Search query in the user language.',
          },
          topic: {
            type: 'string',
            enum: ['general', 'news', 'finance'],
            description: 'Search topic category.',
          },
          searchDepth: {
            type: 'string',
            enum: ['basic', 'advanced'],
            description: 'Advanced search returns richer content snippets.',
          },
          maxResults: {
            type: 'integer',
            minimum: 1,
            maximum: 10,
            description: 'Maximum number of results to return.',
          },
          timeRange: {
            type: 'string',
            enum: ['day', 'week', 'month', 'year', 'd', 'w', 'm', 'y'],
            description: 'Optional recency filter.',
          },
          includeDomains: {
            type: 'array',
            items: { type: 'string' },
            description: 'Optional list of domains to include.',
          },
          excludeDomains: {
            type: 'array',
            items: { type: 'string' },
            description: 'Optional list of domains to exclude.',
          },
        },
        required: ['query'],
        additionalProperties: false,
      },
    },
    secrets: [
      {
        key: 'tavilyApiKey',
        label: 'Tavily API Key',
        placeholder: 'tvly-...',
        envVar: 'TAVILY_API_KEY',
        required: true,
      },
    ],
    request: {
      url: 'https://api.tavily.com/search',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: {
          $source: 'secret',
          key: 'tavilyApiKey',
          required: true,
          prefix: 'Bearer ',
        },
      },
      body: {
        query: {
          $source: 'arg',
          key: 'query',
          required: true,
        },
        topic: {
          $source: 'arg',
          key: 'topic',
          default: 'general',
        },
        search_depth: {
          $source: 'arg',
          key: 'searchDepth',
          default: 'advanced',
        },
        max_results: {
          $source: 'arg',
          key: 'maxResults',
          default: 5,
        },
        time_range: {
          $source: 'arg',
          key: 'timeRange',
        },
        include_domains: {
          $source: 'arg',
          key: 'includeDomains',
        },
        exclude_domains: {
          $source: 'arg',
          key: 'excludeDomains',
        },
        include_answer: false,
        include_raw_content: false,
      },
      responseType: 'json',
      timeoutMs: DEFAULT_HTTP_TIMEOUT_MS,
    },
  }
}

export function migrateLegacySkillRuntime(skill: {
  name: string
  aliases?: string[]
  runtime?: unknown
}): AISkillRuntime | undefined {
  const normalizedRuntime = normalizeSkillRuntime(skill.runtime)
  if (normalizedRuntime) return normalizedRuntime

  const candidate: AISkill = {
    id: '',
    name: skill.name,
    prompt: '',
    ...(skill.aliases?.length ? { aliases: skill.aliases } : {}),
  }

  return isTavilySearchSkill(candidate) ? createMigratedTavilySearchRuntime() : undefined
}

export function resolveSkillRuntime(skill: AISkill): AISkillRuntime | undefined {
  return migrateLegacySkillRuntime({
    name: skill.name,
    aliases: skill.aliases,
    runtime: skill.runtime,
  })
}

function mergeSkillSecretDefinition(
  current: AISkillRuntimeSecret | undefined,
  next: AISkillRuntimeSecret,
): AISkillRuntimeSecret {
  if (!current) return { ...next }

  return {
    ...current,
    ...(next.label ? { label: next.label } : {}),
    ...(next.placeholder ? { placeholder: next.placeholder } : {}),
    ...(next.hint ? { hint: next.hint } : {}),
    ...(next.envVar ? { envVar: next.envVar } : {}),
    ...(typeof next.required === 'boolean' ? { required: next.required } : {}),
  }
}

export function getSkillRuntimeSecretDefinitions(skills: AISkill[]): AISkillRuntimeSecret[] {
  const merged = new Map<string, AISkillRuntimeSecret>()

  for (const skill of skills) {
    const runtime = resolveSkillRuntime(skill)
    if (!runtime || runtime.type !== 'http' || !runtime.secrets?.length) continue

    for (const secret of runtime.secrets) {
      merged.set(secret.key, mergeSkillSecretDefinition(merged.get(secret.key), secret))
    }
  }

  return Array.from(merged.values())
}

function createExecutableHttpRuntime(runtime: AISkillHttpRuntime): ExecuteSkillHttpRuntime {
  const secrets = runtime.secrets?.map((secret) => ({
    key: secret.key,
    ...(typeof secret.required === 'boolean' ? { required: secret.required } : {}),
  }))

  return {
    type: 'http',
    ...(secrets && secrets.length > 0 ? { secrets } : {}),
    request: {
      url: runtime.request.url,
      ...(runtime.request.method ? { method: runtime.request.method } : {}),
      ...(runtime.request.headers ? { headers: runtime.request.headers } : {}),
      ...(runtime.request.query ? { query: runtime.request.query } : {}),
      ...(runtime.request.body !== undefined ? { body: runtime.request.body } : {}),
      ...(typeof runtime.request.timeoutMs === 'number'
        ? { timeoutMs: runtime.request.timeoutMs }
        : {}),
      ...(runtime.request.responseType ? { responseType: runtime.request.responseType } : {}),
    },
  }
}

function getMissingRequiredSecretLabels(
  runtime: AISkillHttpRuntime,
  runtimeConfig: SkillRuntimeConfig,
): string[] {
  if (!runtime.secrets?.length) return []

  const missingLabels: string[] = []

  for (const secret of runtime.secrets) {
    if (!secret.required) continue

    const value = runtimeConfig.secrets[secret.key]?.trim()
    if (value) continue

    missingLabels.push(secret.label || secret.key)
  }

  return missingLabels
}

function pickConfiguredSecrets(
  runtime: AISkillHttpRuntime,
  runtimeConfig: SkillRuntimeConfig,
): Record<string, string> | undefined {
  if (!runtime.secrets?.length) return undefined

  const secrets: Record<string, string> = {}

  for (const secret of runtime.secrets) {
    const value = runtimeConfig.secrets[secret.key]?.trim()
    if (value) {
      secrets[secret.key] = value
      continue
    }

    if (secret.required) {
      throw new Error(`Missing required skill runtime secret: ${secret.label || secret.key}`)
    }
  }

  return Object.keys(secrets).length > 0 ? secrets : undefined
}

function getNestedValue(source: Record<string, unknown>, path: string): unknown {
  const segments = path
    .split('.')
    .map((segment) => segment.trim())
    .filter(Boolean)

  let current: unknown = source
  for (const segment of segments) {
    if (Array.isArray(current)) {
      const index = Number(segment)
      if (!Number.isInteger(index) || index < 0) return undefined
      current = current[index]
      continue
    }

    if (!isRecord(current)) return undefined
    current = current[segment]
  }

  return current
}

function stringifyRuntimeScalar(value: MaterializedRuntimeValue): string {
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  if (value === null) return 'null'
  return JSON.stringify(value)
}

function materializeResolvedRuntimeValue(
  value: unknown,
): MaterializedRuntimeValue | typeof OMITTED_RUNTIME_VALUE {
  if (value === null) return null
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return value
  }

  if (Array.isArray(value)) {
    return value
      .map((item) => materializeResolvedRuntimeValue(item))
      .filter((item): item is MaterializedRuntimeValue => item !== OMITTED_RUNTIME_VALUE)
  }

  if (!isRecord(value)) return OMITTED_RUNTIME_VALUE

  const entries = Object.entries(value)
    .map(([key, entryValue]) => {
      const materialized = materializeResolvedRuntimeValue(entryValue)
      return materialized === OMITTED_RUNTIME_VALUE ? null : [key, materialized]
    })
    .filter((entry): entry is [string, MaterializedRuntimeValue] => !!entry)

  return Object.fromEntries(entries)
}

function materializeRuntimeTemplateValue(
  value: AISkillRuntimeTemplateValue,
  args: Record<string, unknown>,
): MaterializedRuntimeValue | typeof OMITTED_RUNTIME_VALUE {
  if (
    value === null ||
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  ) {
    return value
  }

  if (Array.isArray(value)) {
    return value
      .map((item) => materializeRuntimeTemplateValue(item, args))
      .filter((item): item is MaterializedRuntimeValue => item !== OMITTED_RUNTIME_VALUE)
  }

  if (isRuntimeValueBinding(value)) {
    const rawValue = value.$source === 'arg' ? getNestedValue(args, value.key) : undefined

    if (rawValue === undefined || rawValue === null || rawValue === '') {
      if (value.default !== undefined) {
        return materializeRuntimeTemplateValue(value.default, args)
      }

      if (value.required) {
        throw new Error(`Missing required runtime ${value.$source}: ${value.key}`)
      }

      return OMITTED_RUNTIME_VALUE
    }

    const materialized = materializeResolvedRuntimeValue(rawValue)
    if (materialized === OMITTED_RUNTIME_VALUE) return OMITTED_RUNTIME_VALUE

    if (!value.prefix && !value.suffix) {
      return materialized
    }

    return `${value.prefix || ''}${stringifyRuntimeScalar(materialized)}${value.suffix || ''}`
  }

  if (!isRecord(value)) return OMITTED_RUNTIME_VALUE

  const entries = Object.entries(value)
    .map(([key, entryValue]) => {
      const materialized = materializeRuntimeTemplateValue(entryValue, args)
      return materialized === OMITTED_RUNTIME_VALUE ? null : [key, materialized]
    })
    .filter((entry): entry is [string, MaterializedRuntimeValue] => !!entry)

  return Object.fromEntries(entries)
}

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

  const materialized = materializeRuntimeTemplateValue(runtime.arguments, args)
  if (materialized === OMITTED_RUNTIME_VALUE) {
    return {}
  }

  if (!isRecord(materialized)) {
    throw new Error('MCP runtime arguments must resolve to an object')
  }

  return materialized
}

export async function callSkillHttpRuntime(
  payload: ExecuteSkillHttpRuntimeRequest,
): Promise<unknown> {
  const { data } = await httpClient.post<ApiResponse<unknown>>('/skills/runtime/http', payload, {
    timeout: payload.runtime.request.timeoutMs || DEFAULT_HTTP_TIMEOUT_MS,
  })

  return unwrapApiResponse(data)
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
    executeHttpRuntime?: (payload: ExecuteSkillHttpRuntimeRequest) => Promise<unknown>
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
