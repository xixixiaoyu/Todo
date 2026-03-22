import type {
  AISkill,
  AISkillHttpRuntime,
  AISkillMcpRuntime,
  AISkillRuntime,
  AISkillRuntimeSecret,
  AISkillRuntimeTemplateValue,
  AISkillRuntimeValueBinding,
} from '../types'

export const TAVILY_SEARCH_TOOL_NAME = 'skill_tavily_search'

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

    const prefix = normalizeString(value.prefix)
    const suffix = normalizeString(value.suffix)
    const binding: AISkillRuntimeValueBinding = {
      $source: value.$source,
      key,
      ...(typeof value.required === 'boolean' ? { required: value.required } : {}),
      ...(prefix ? { prefix } : {}),
      ...(suffix ? { suffix } : {}),
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

      const label = normalizeString(item.label)
      const placeholder = normalizeString(item.placeholder)
      const hint = normalizeString(item.hint)
      const envVar = normalizeString(item.envVar)

      return {
        key,
        ...(label ? { label } : {}),
        ...(placeholder ? { placeholder } : {}),
        ...(hint ? { hint } : {}),
        ...(envVar ? { envVar } : {}),
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
  const secrets = normalizeRuntimeSecrets(value.secrets)

  return {
    type: 'http',
    tool: {
      name: toolName,
      description: toolDescription,
      parameters,
    },
    ...(secrets ? { secrets } : {}),
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
      timeoutMs: 15000,
    },
  }
}

export function normalizeSkillRuntime(value: unknown): AISkillRuntime | undefined {
  const normalizedMcpRuntime = normalizeMcpRuntime(value)
  if (normalizedMcpRuntime) return normalizedMcpRuntime

  return normalizeHttpRuntime(value)
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
