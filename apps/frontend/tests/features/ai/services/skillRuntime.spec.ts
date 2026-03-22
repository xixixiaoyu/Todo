import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { httpClient } from '@/api'
import {
  _resetSkillRuntimeConfig,
  getSkillRuntimeConfig,
} from '@/features/ai/composables/useSkillRuntimeConfig'
import type { AISkill } from '@/features/ai/services/aiService'
import type { McpToolResponse } from '@/features/mcp/api/mcp'
import {
  callSkillHttpRuntime,
  buildSkillRuntimeTools,
  getSkillRuntimeAvailability,
  getSkillRuntimeSecretDefinitions,
  migrateLegacySkillRuntime,
  TAVILY_SEARCH_TOOL_NAME,
} from '@/features/ai/services/aiService'

const genericHttpSkill: AISkill = {
  id: 's-http',
  name: 'finance-lookup',
  description: 'Lookup finance headlines',
  prompt: 'Call the finance runtime when the user needs live market headlines.',
  runtime: {
    type: 'http',
    tool: {
      name: 'skill_finance_lookup',
      description: 'Fetch finance headlines from a configured HTTP skill runtime.',
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
          },
        },
        required: ['query'],
      },
    },
    secrets: [
      {
        key: 'financeApiKey',
        label: 'Finance API Key',
        envVar: 'FINANCE_API_KEY',
        required: true,
      },
    ],
    request: {
      url: 'https://api.example.com/finance',
      method: 'POST',
      headers: {
        Authorization: {
          $source: 'secret',
          key: 'financeApiKey',
          prefix: 'Bearer ',
          required: true,
        },
      },
      body: {
        q: {
          $source: 'arg',
          key: 'query',
          required: true,
        },
      },
      responseType: 'json',
    },
  },
}

const legacyTavilySkill: AISkill = {
  id: 's-tavily',
  name: 'tavily-search',
  description: 'Search the live web',
  prompt: 'Use Tavily search when current web information is needed.',
}

const genericMcpSkill: AISkill = {
  id: 's-mcp',
  name: 'browser-search',
  description: 'Search through an MCP tool',
  prompt: 'Call the MCP-backed search tool when live browsing is needed.',
  runtime: {
    type: 'mcp',
    tool: {
      name: 'skill_browser_search',
      description: 'Search via the configured MCP browser tool.',
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
          },
          maxResults: {
            type: 'integer',
          },
        },
        required: ['query'],
      },
    },
    target: {
      toolName: 'search_web',
    },
    arguments: {
      query: {
        $source: 'arg',
        key: 'query',
        required: true,
      },
      limit: {
        $source: 'arg',
        key: 'maxResults',
        default: 5,
      },
    },
  },
}

const mcpTools: McpToolResponse[] = [
  {
    name: 'search_web',
    description: 'Search the web',
    inputSchema: {
      type: 'object',
    },
    serverId: 'srv-search',
  },
]

describe('skill runtime tools', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    _resetSkillRuntimeConfig()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('registers generic HTTP runtime tools from skill runtime definitions', () => {
    const result = buildSkillRuntimeTools([genericHttpSkill], {
      runtimeConfig: {
        secrets: {
          financeApiKey: 'finance-secret',
        },
      },
      executeHttpRuntime: vi.fn(),
    })

    expect(result.aiTools[0]?.function.name).toBe('skill_finance_lookup')
    expect(result.localToolHandlers.has('skill_finance_lookup')).toBe(true)
  })

  it('auto-registers runtime tools for legacy tavily skills', () => {
    const result = buildSkillRuntimeTools([legacyTavilySkill], {
      runtimeConfig: {
        secrets: {
          tavilyApiKey: 'tvly-test',
        },
      },
      executeHttpRuntime: vi.fn(),
    })

    expect(result.aiTools[0]?.function.name).toBe(TAVILY_SEARCH_TOOL_NAME)
    expect(result.localToolHandlers.has(TAVILY_SEARCH_TOOL_NAME)).toBe(true)
  })

  it('registers migrated tavily skills with explicit runtime metadata', () => {
    const migratedSkill: AISkill = {
      ...legacyTavilySkill,
      runtime: migrateLegacySkillRuntime(legacyTavilySkill),
    }

    const result = buildSkillRuntimeTools([migratedSkill], {
      runtimeConfig: {
        secrets: {
          tavilyApiKey: 'tvly-test',
        },
      },
      executeHttpRuntime: vi.fn(),
    })

    expect(result.aiTools[0]?.function.name).toBe(TAVILY_SEARCH_TOOL_NAME)
    expect(result.localToolHandlers.has(TAVILY_SEARCH_TOOL_NAME)).toBe(true)
  })

  it('calls the generic runtime executor and serializes the response', async () => {
    const executeHttpRuntime = vi.fn().mockResolvedValue({
      results: [
        {
          title: 'Headline A',
        },
      ],
    })

    const result = buildSkillRuntimeTools([genericHttpSkill], {
      runtimeConfig: {
        secrets: {
          financeApiKey: 'finance-secret',
        },
      },
      executeHttpRuntime,
    })

    const output = await result.localToolHandlers.get('skill_finance_lookup')?.({
      query: 'latest finance headlines',
    })

    expect(executeHttpRuntime).toHaveBeenCalledWith({
      skillName: 'finance-lookup',
      runtime: {
        type: 'http',
        secrets: [
          {
            key: 'financeApiKey',
            required: true,
          },
        ],
        request: {
          url: 'https://api.example.com/finance',
          method: 'POST',
          headers: {
            Authorization: {
              $source: 'secret',
              key: 'financeApiKey',
              prefix: 'Bearer',
              required: true,
            },
          },
          body: {
            q: {
              $source: 'arg',
              key: 'query',
              required: true,
            },
          },
          responseType: 'json',
        },
      },
      arguments: {
        query: 'latest finance headlines',
      },
      secrets: {
        financeApiKey: 'finance-secret',
      },
    })
    expect(output).toContain('"title":"Headline A"')
  })

  it('skips HTTP runtime tools when the current chat context cannot execute them', () => {
    const result = buildSkillRuntimeTools([genericHttpSkill], {
      enableHttpRuntime: false,
      executeHttpRuntime: vi.fn(),
    })

    expect(result.aiTools).toHaveLength(0)
    expect(result.localToolHandlers.has('skill_finance_lookup')).toBe(false)
  })

  it('reports blocked HTTP runtime when authentication is unavailable', () => {
    expect(
      getSkillRuntimeAvailability([genericHttpSkill], {
        enableHttpRuntime: false,
      }),
    ).toEqual([
      {
        skillId: 's-http',
        skillName: 'finance-lookup',
        runtimeType: 'http',
        toolName: 'skill_finance_lookup',
        status: 'blocked',
        reasonCode: 'auth_required',
      },
    ])
  })

  it('reports blocked HTTP runtime when required secrets are missing', () => {
    expect(
      getSkillRuntimeAvailability([genericHttpSkill], {
        runtimeConfig: {
          secrets: {},
        },
      }),
    ).toEqual([
      {
        skillId: 's-http',
        skillName: 'finance-lookup',
        runtimeType: 'http',
        toolName: 'skill_finance_lookup',
        status: 'blocked',
        reasonCode: 'missing_secrets',
        missingSecrets: ['Finance API Key'],
      },
    ])
  })

  it('requires explicit configured secrets even when the skill documents an env var name', async () => {
    const executeHttpRuntime = vi.fn()
    const result = buildSkillRuntimeTools([genericHttpSkill], {
      runtimeConfig: {
        secrets: {},
      },
      executeHttpRuntime,
    })

    await expect(
      result.localToolHandlers.get('skill_finance_lookup')?.({
        query: 'latest finance headlines',
      }),
    ).rejects.toThrow('Missing required skill runtime secret: Finance API Key')
    expect(executeHttpRuntime).not.toHaveBeenCalled()
  })

  it('calls the skill runtime proxy endpoint and unwraps the response', async () => {
    const postSpy = vi.spyOn(httpClient, 'post').mockResolvedValue({
      data: {
        success: true,
        data: {
          ok: true,
        },
        timestamp: new Date().toISOString(),
      },
    } as never)

    await expect(
      callSkillHttpRuntime({
        skillName: 'finance-lookup',
        runtime: {
          type: 'http',
          request: {
            url: 'https://api.example.com/finance',
            timeoutMs: 2500,
          },
        },
        arguments: {
          query: 'latest finance headlines',
        },
        secrets: {
          financeApiKey: 'finance-secret',
        },
      }),
    ).resolves.toEqual({
      ok: true,
    })

    expect(postSpy).toHaveBeenCalledWith(
      '/skills/runtime/http',
      expect.objectContaining({
        skillName: 'finance-lookup',
        runtime: expect.objectContaining({
          type: 'http',
        }),
      }),
      {
        timeout: 2500,
      },
    )
  })

  it('calls an MCP runtime target with mapped arguments', async () => {
    const callMcpTool = vi.fn().mockResolvedValue({
      content: [
        {
          type: 'text',
          text: 'Result A',
        },
      ],
    })

    const result = buildSkillRuntimeTools([genericMcpSkill], {
      mcpTools,
      callMcpTool,
    })

    const output = await result.localToolHandlers.get('skill_browser_search')?.({
      query: 'OpenAI latest',
    })

    expect(callMcpTool).toHaveBeenCalledWith('srv-search', 'search_web', {
      query: 'OpenAI latest',
      limit: 5,
    })
    expect(output).toContain('"Result A"')
  })

  it('returns an error when MCP runtime target resolution is ambiguous', async () => {
    const result = buildSkillRuntimeTools([genericMcpSkill], {
      mcpTools: [
        ...mcpTools,
        {
          ...mcpTools[0],
          serverId: 'srv-search-2',
        },
      ],
      callMcpTool: vi.fn(),
    })

    await expect(
      result.localToolHandlers.get('skill_browser_search')?.({
        query: 'OpenAI latest',
      }),
    ).rejects.toThrow('Ambiguous MCP tool')
  })

  it('returns merged secret definitions across installed skills', () => {
    const migratedSkill: AISkill = {
      ...legacyTavilySkill,
      runtime: migrateLegacySkillRuntime(legacyTavilySkill),
    }
    const secrets = getSkillRuntimeSecretDefinitions([genericHttpSkill, migratedSkill])

    expect(secrets).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: 'financeApiKey',
        }),
        expect.objectContaining({
          key: 'tavilyApiKey',
          envVar: 'TAVILY_API_KEY',
        }),
      ]),
    )
  })

  it('migrates legacy tavily secret config into the generic secrets shape', () => {
    localStorage.setItem(
      'ai-skill-runtime-config',
      JSON.stringify({
        tavilyApiKey: 'tvly-legacy',
      }),
    )

    _resetSkillRuntimeConfig()

    expect(getSkillRuntimeConfig()).toEqual({
      secrets: {
        tavilyApiKey: 'tvly-legacy',
      },
    })
    expect(JSON.parse(localStorage.getItem('ai-skill-runtime-config') || '{}')).toEqual({
      secrets: {
        tavilyApiKey: 'tvly-legacy',
      },
    })
  })
})
