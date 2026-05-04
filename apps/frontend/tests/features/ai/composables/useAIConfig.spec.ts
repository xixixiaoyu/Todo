import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { nextTick } from 'vue'
import { createHash } from 'node:crypto'
import { strToU8, zipSync } from 'fflate'
import { httpClient } from '@/api'
import {
  useAIConfig,
  _resetAIConfig,
  aiThinkingMode,
  getAIThinkingMode,
  syncSkillsFromServer,
  syncPresetsFromServer,
} from '@/features/ai/composables/useAIConfig'

vi.mock('@/features/ai/services/aiSyncService', () => ({
  fetchSkills: vi.fn().mockResolvedValue(null),
  pushSkills: vi.fn().mockResolvedValue(undefined),
  fetchPresets: vi.fn().mockResolvedValue(null),
  pushPresets: vi.fn().mockResolvedValue(undefined),
}))

function createByteStream(chunks: Uint8Array[]): ReadableStream<Uint8Array> {
  return new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(chunk)
      }
      controller.close()
    },
  })
}

describe('useAIConfig - Core', () => {
  beforeEach(() => {
    localStorage.clear()
    _resetAIConfig()
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  describe('initial state', () => {
    it('should initialize with default config', () => {
      const { config, DEFAULT_CONFIG } = useAIConfig()

      expect(config.value).toEqual(DEFAULT_CONFIG)
      expect(config.value.baseUrl).toBe('https://api.deepseek.com')
      expect(config.value.apiKey).toBe('')
      expect(config.value.model).toBe('deepseek-chat')
      expect(config.value.temperature).toBe(0.6)
    })

    it('should load saved config from localStorage', () => {
      const savedConfig = {
        baseUrl: 'https://api.test.com',
        apiKey: 'test-key',
        model: 'test-model',
        temperature: 0.7,
        systemPrompt: 'Test prompt',
        thinkingMode: 'enabled' as const,
        todoAssistant: true,
        discussionMode: true,
        discussionModelIds: ['1', '2'],
        discussionPrimaryModelId: null,
        memoryModelId: null,
        enableImageGeneration: false,
      }

      localStorage.setItem('ai-config', JSON.stringify(savedConfig))

      _resetAIConfig() // 手动触发重置以从 localStorage 加载
      const { config, DEFAULT_CONFIG } = useAIConfig()

      expect(config.value).toEqual({
        ...DEFAULT_CONFIG,
        ...savedConfig,
      })
    })

    it('should merge saved config with defaults', () => {
      const savedConfig = {
        baseUrl: 'https://api.test.com',
        apiKey: 'test-key',
      }

      localStorage.setItem('ai-config', JSON.stringify(savedConfig))

      _resetAIConfig() // 手动触发重置以从 localStorage 加载
      const { config, DEFAULT_CONFIG } = useAIConfig()

      expect(config.value).toEqual({
        ...DEFAULT_CONFIG,
        baseUrl: 'https://api.test.com',
        apiKey: 'test-key',
      })
    })

    it('should migrate legacy tavily skills to explicit runtime metadata on load', () => {
      localStorage.setItem(
        'ai-skills',
        JSON.stringify([
          {
            id: 'legacy-tavily',
            name: 'tavily-search',
            description: 'Search the live web',
            prompt: 'Use Tavily search when current web information is needed.',
          },
        ]),
      )

      _resetAIConfig()
      const { skills } = useAIConfig()

      expect(skills.value[0]?.runtime).toMatchObject({
        type: 'http',
        tool: {
          name: 'skill_tavily_search',
        },
      })

      const persisted = JSON.parse(localStorage.getItem('ai-skills') || '[]') as Array<{
        runtime?: unknown
      }>
      expect(persisted[0]?.runtime).toMatchObject({
        type: 'http',
      })
    })
  })

  describe('AI Thinking Mode', () => {
    it('should initialize with default value (enabled)', () => {
      expect(aiThinkingMode.value).toBe('enabled')
      expect(getAIThinkingMode()).toBe('enabled')
    })

    it('should load saved value from localStorage', () => {
      localStorage.setItem('ai_thinking_mode', 'disabled')
      _resetAIConfig()
      expect(aiThinkingMode.value).toBe('disabled')
    })

    it('should persist value to localStorage when changed', async () => {
      aiThinkingMode.value = 'disabled'
      await nextTick()
      expect(localStorage.getItem('ai_thinking_mode')).toBe('disabled')
    })

    it('should sync with config.thinkingMode', async () => {
      const { config, updateConfig } = useAIConfig()

      // aiThinkingMode -> config
      aiThinkingMode.value = 'disabled'
      await nextTick()
      expect(config.value.thinkingMode).toBe('disabled')

      // config -> aiThinkingMode
      updateConfig({ thinkingMode: 'enabled' })
      await nextTick()
      expect(aiThinkingMode.value).toBe('enabled')
    })
  })

  describe('updateConfig', () => {
    it('should update config with partial values', () => {
      const { config, updateConfig } = useAIConfig()

      const initialConfig = { ...config.value }
      updateConfig({ apiKey: 'new-key', model: 'new-model' })

      expect(config.value.apiKey).toBe('new-key')
      expect(config.value.model).toBe('new-model')
      expect(config.value.baseUrl).toBe(initialConfig.baseUrl) // Should remain unchanged
    })

    it('should persist updated config to localStorage', async () => {
      const { updateConfig } = useAIConfig()

      updateConfig({ apiKey: 'persisted-key' })
      await nextTick()

      const saved = localStorage.getItem('ai-config')
      expect(saved).toBeTruthy()
      expect(JSON.parse(saved!)).toHaveProperty('apiKey', 'persisted-key')
    })
  })

  describe('resetConfig', () => {
    it('should reset to default config', () => {
      const { config, updateConfig, resetConfig, DEFAULT_CONFIG } = useAIConfig()

      updateConfig({ apiKey: 'modified-key', model: 'modified-model' })
      expect(config.value.apiKey).toBe('modified-key')

      resetConfig()

      expect(config.value).toEqual(DEFAULT_CONFIG)
    })

    it('should update localStorage after reset', () => {
      const { updateConfig, resetConfig } = useAIConfig()

      updateConfig({ apiKey: 'modified-key' })
      resetConfig()

      const saved = localStorage.getItem('ai-config')
      expect(JSON.parse(saved!)).toHaveProperty('apiKey', '')
    })
  })

  describe('isConfigValid', () => {
    it('should return true when all required fields are present', () => {
      const { updateConfig, isConfigValid } = useAIConfig()

      updateConfig({
        baseUrl: 'https://api.test.com',
        apiKey: 'valid-key',
        model: 'valid-model',
      })

      expect(isConfigValid()).toBe(true)
    })

    it('should return false when baseUrl is missing', () => {
      const { updateConfig, isConfigValid } = useAIConfig()

      updateConfig({
        baseUrl: '',
        apiKey: 'valid-key',
        model: 'valid-model',
      })

      expect(isConfigValid()).toBe(false)
    })

    it('should return false when apiKey is missing', () => {
      const { updateConfig, isConfigValid } = useAIConfig()

      updateConfig({
        baseUrl: 'https://api.test.com',
        apiKey: '',
        model: 'valid-model',
      })

      expect(isConfigValid()).toBe(false)
    })

    it('should return false when model is missing', () => {
      const { updateConfig, isConfigValid } = useAIConfig()

      updateConfig({
        baseUrl: 'https://api.test.com',
        apiKey: 'valid-key',
        model: '',
      })

      expect(isConfigValid()).toBe(false)
    })
  })

  describe('readonly properties', () => {
    it('should make config readonly', () => {
      const { config } = useAIConfig()
      const originalValue = { ...config.value }

      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

      // @ts-expect-error - testing readonly property
      config.value = { ...config.value, apiKey: 'modified' }

      expect(config.value).toEqual(originalValue)

      warnSpy.mockRestore()
    })

    it('should make activePresetId readonly', () => {
      const { activePresetId } = useAIConfig()
      const originalValue = activePresetId.value

      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

      // @ts-expect-error - testing readonly property
      activePresetId.value = 'modified-id'

      expect(activePresetId.value).toBe(originalValue)

      warnSpy.mockRestore()
    })
  })

  describe('Import/Export', () => {
    it('should export all presets as JSON string', () => {
      const { addPreset, exportPresets } = useAIConfig()
      const preset1 = {
        name: 'Preset 1',
        baseUrl: 'https://api1.com',
        apiKey: 'key1',
        model: 'model1',
        systemPrompt: 'prompt1',
        temperature: 0.5,
        todoAssistant: false,
      }
      const preset2 = {
        name: 'Preset 2',
        baseUrl: 'https://api2.com',
        apiKey: 'key2',
        model: 'model2',
        systemPrompt: 'prompt2',
        temperature: 0.8,
        todoAssistant: true,
      }

      addPreset(preset1)
      addPreset(preset2)

      const exported = exportPresets()
      const parsed = JSON.parse(exported)

      expect(parsed).toHaveLength(2)
      expect(parsed[0]).toMatchObject(preset1)
      expect(parsed[1]).toMatchObject(preset2)
      expect(parsed[0]).toHaveProperty('id')
      expect(parsed[1]).toHaveProperty('id')
    })

    it('should import presets in merge mode', () => {
      const { presets, addPreset, importPresets } = useAIConfig()
      const existingPreset = {
        name: 'Existing',
        baseUrl: 'https://existing.com',
        apiKey: 'key',
        model: 'model',
        systemPrompt: 'prompt',
        temperature: 0.5,
        todoAssistant: false,
      }
      addPreset(existingPreset)

      const importData = [
        {
          name: 'Imported',
          baseUrl: 'https://imported.com',
          apiKey: 'newkey',
          model: 'newmodel',
          systemPrompt: 'newprompt',
          temperature: 0.7,
          todoAssistant: true,
        },
      ]

      importPresets(JSON.stringify(importData))

      expect(presets.value).toHaveLength(2)
      expect(presets.value[0].name).toBe('Existing')
      expect(presets.value[1].name).toBe('Imported')
      expect(presets.value[1]).toHaveProperty('id')
      expect(presets.value[1].id).not.toBe(presets.value[0].id)
    })

    it('should import presets in replace mode', () => {
      const { presets, addPreset, importPresets } = useAIConfig()
      addPreset({
        name: 'Existing',
        baseUrl: 'https://existing.com',
        apiKey: 'key',
        model: 'model',
        systemPrompt: 'prompt',
        temperature: 0.5,
        todoAssistant: false,
      })

      const importData = [
        {
          name: 'Imported',
          baseUrl: 'https://imported.com',
          apiKey: 'newkey',
          model: 'newmodel',
          systemPrompt: 'newprompt',
          temperature: 0.7,
          todoAssistant: true,
        },
      ]

      importPresets(JSON.stringify(importData), 'replace')

      expect(presets.value).toHaveLength(1)
      expect(presets.value[0].name).toBe('Imported')
    })

    it('should throw error for invalid JSON', () => {
      const { importPresets } = useAIConfig()

      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      expect(() => importPresets('invalid-json')).toThrow(SyntaxError)
      expect(errorSpy).toHaveBeenCalledWith('导入预设失败:', expect.any(SyntaxError))

      errorSpy.mockRestore()
    })

    it('should throw error for invalid data structure', () => {
      const { importPresets } = useAIConfig()

      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      expect(() => importPresets(JSON.stringify({ not: 'an array' }))).toThrow(
        'Invalid presets format',
      )
      expect(errorSpy).toHaveBeenCalledWith(
        '导入预设失败:',
        expect.objectContaining({ message: 'Invalid presets format: expected an array' }),
      )

      errorSpy.mockRestore()
    })

    it('should filter out invalid preset items during import', () => {
      const { presets, importPresets } = useAIConfig()
      const importData = [
        { name: 'Valid', baseUrl: 'https://v.com', model: 'm' },
        { name: 'Invalid' }, // missing baseUrl and model
      ]

      importPresets(JSON.stringify(importData))

      expect(presets.value).toHaveLength(1)
      expect(presets.value[0].name).toBe('Valid')
    })
  })

  describe('skills', () => {
    it('should add and toggle skills into config', () => {
      const { skills, config, addSkill, toggleSkill } = useAIConfig()

      const created = addSkill({
        name: 'code-review',
        description: 'review mode',
        aliases: ['review'],
        prompt: 'focus on bugs first',
      })

      expect(skills.value).toHaveLength(1)
      expect(config.value.skillIds).toEqual([])

      toggleSkill(created.id)
      expect(config.value.skillIds).toEqual([created.id])

      toggleSkill(created.id)
      expect(config.value.skillIds).toEqual([])
    })

    it('should delete selected skill and clean config references', () => {
      const { config, addSkill, setSkillIds, deleteSkill } = useAIConfig()

      const skill = addSkill({
        name: 'architect',
        prompt: 'provide architecture tradeoffs',
      })
      setSkillIds([skill.id])
      expect(config.value.skillIds).toEqual([skill.id])

      deleteSkill(skill.id)
      expect(config.value.skillIds).toEqual([])
    })

    it('should import skills from JSON and skip duplicate names in merge mode', () => {
      const { skills, importSkills } = useAIConfig()

      const first = importSkills(
        JSON.stringify([
          {
            name: 'code-review',
            description: 'Review code changes',
            prompt: 'Find bugs first',
          },
        ]),
      )
      expect(first).toBe(1)
      expect(skills.value).toHaveLength(1)

      const second = importSkills(
        JSON.stringify([
          {
            name: 'code-review',
            description: 'duplicate',
            prompt: 'duplicate',
          },
          {
            name: 'architecture',
            description: 'System design analysis',
            prompt: 'Provide trade-offs',
          },
        ]),
      )

      expect(second).toBe(1)
      expect(skills.value.map((item) => item.name)).toEqual(['code-review', 'architecture'])
    })

    it('should preserve skill runtime metadata when importing JSON skills', () => {
      const { skills, importSkills } = useAIConfig()

      const count = importSkills(
        JSON.stringify([
          {
            name: 'finance-lookup',
            description: 'Lookup finance headlines',
            prompt: 'Use the HTTP runtime',
            runtime: {
              type: 'http',
              tool: {
                name: 'skill_finance_lookup',
                description: 'Fetch finance headlines',
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
                  envVar: 'FINANCE_API_KEY',
                  required: true,
                },
              ],
              request: {
                url: 'https://api.example.com/finance',
                method: 'POST',
                body: {
                  q: {
                    $source: 'arg',
                    key: 'query',
                    required: true,
                  },
                },
              },
            },
          },
        ]),
      )

      expect(count).toBe(1)
      expect(skills.value[0]?.runtime).toMatchObject({
        type: 'http',
        tool: {
          name: 'skill_finance_lookup',
        },
        request: {
          url: 'https://api.example.com/finance',
          method: 'POST',
        },
      })
    })

    it('should preserve MCP runtime metadata when importing JSON skills', () => {
      const { skills, importSkills } = useAIConfig()

      const count = importSkills(
        JSON.stringify({
          name: 'browser-search',
          description: 'Search through MCP',
          prompt: 'Use MCP-backed browser search',
          runtime: {
            type: 'mcp',
            tool: {
              name: 'skill_browser_search',
              description: 'Search with MCP',
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
        }),
      )

      expect(count).toBe(1)
      expect(skills.value[0]?.runtime).toMatchObject({
        type: 'mcp',
        tool: {
          name: 'skill_browser_search',
        },
        target: {
          toolName: 'search_web',
        },
      })
    })

    it('should import a single SKILL.md document', () => {
      const { skills, importSkills } = useAIConfig()

      const markdown = [
        '---',
        'name: skill-md-demo',
        'description: Use this when demoing markdown skill import',
        '---',
        '',
        'Always provide concise steps.',
      ].join('\n')

      const count = importSkills(markdown)
      expect(count).toBe(1)
      expect(skills.value[0]).toMatchObject({
        name: 'skill-md-demo',
        description: 'Use this when demoing markdown skill import',
        prompt: 'Always provide concise steps.',
      })
    })

    it('should install skill from external url', async () => {
      const { skills, importSkillsFromExternalSource } = useAIConfig()
      const markdown = [
        '---',
        'name: remote-skill',
        'description: Installed from remote source',
        '---',
        '',
        'Follow remote skill workflow.',
      ].join('\n')

      const fetchMock = vi.fn(async () => ({
        ok: true,
        status: 200,
        headers: {
          get: (key: string) => (key.toLowerCase() === 'content-type' ? 'text/markdown' : null),
        },
        text: async () => markdown,
      }))
      vi.stubGlobal('fetch', fetchMock)

      const result = await importSkillsFromExternalSource(
        'https://raw.githubusercontent.com/openai/skills/main/skills/.curated/gh-address-comments/SKILL.md',
      )
      expect(result.importedCount).toBe(1)
      expect(result.sourceUrl).toBe(
        'https://raw.githubusercontent.com/openai/skills/main/skills/.curated/gh-address-comments/SKILL.md',
      )
      expect(skills.value.map((item) => item.name)).toContain('remote-skill')
    })

    it('should install legacy tavily skill package and migrate runtime metadata', async () => {
      const { skills, importSkillsFromExternalSource } = useAIConfig()
      const markdown = [
        '---',
        'name: tavily-search',
        'description: Installed from SkillHub package',
        '---',
        '',
        'Use Tavily search workflow.',
      ].join('\n')
      const archive = zipSync({ 'SKILL.md': strToU8(markdown) })
      const archiveBase64 = Buffer.from(archive).toString('base64')
      const proxySpy = vi.spyOn(httpClient, 'get').mockResolvedValue({
        data: {
          success: true,
          data: {
            sourceUrl: 'https://lightmake.site/api/v1/download?slug=tavily-search',
            finalUrl:
              'https://skillhub-1388575217.cos.accelerate.myqcloud.com/skills/tavily-search/1.0.0.zip',
            contentType: 'application/zip',
            contentLength: archive.byteLength,
            bodyBase64: archiveBase64,
          },
          timestamp: new Date().toISOString(),
        },
      })
      const fetchMock = vi.fn()
      vi.stubGlobal('fetch', fetchMock)

      const result = await importSkillsFromExternalSource('skillhub install tavily-search')

      expect(fetchMock).not.toHaveBeenCalled()
      expect(proxySpy).toHaveBeenCalledWith('/skills/external-source', {
        params: { url: 'https://lightmake.site/api/v1/download?slug=tavily-search' },
        timeout: 30000,
      })
      expect(result.importedCount).toBe(1)
      expect(result.sourceUrl).toBe('https://lightmake.site/api/v1/download?slug=tavily-search')
      expect(skills.value.map((item) => item.name)).toContain('tavily-search')
      expect(skills.value.find((item) => item.name === 'tavily-search')?.runtime).toMatchObject({
        type: 'http',
        tool: {
          name: 'skill_tavily_search',
        },
      })

      proxySpy.mockRestore()
    })

    it('should reject zip package when SKILL.md original size exceeds the file limit', async () => {
      const { importSkillsFromExternalSource } = useAIConfig()
      const oversizedPrompt = 'A'.repeat(530 * 1024)
      const markdown = [
        '---',
        'name: oversized-skill',
        'description: Oversized skill package',
        '---',
        '',
        oversizedPrompt,
      ].join('\n')
      const archive = zipSync({ 'nested/SKILL.md': strToU8(markdown) })
      const archiveBase64 = Buffer.from(archive).toString('base64')
      const proxySpy = vi.spyOn(httpClient, 'get').mockResolvedValue({
        data: {
          success: true,
          data: {
            sourceUrl: 'https://lightmake.site/api/v1/download?slug=tavily-search',
            finalUrl:
              'https://skillhub-1388575217.cos.accelerate.myqcloud.com/skills/tavily-search/1.0.0.zip',
            contentType: 'application/zip',
            contentLength: archive.byteLength,
            bodyBase64: archiveBase64,
          },
          timestamp: new Date().toISOString(),
        },
      })
      const fetchMock = vi.fn()
      vi.stubGlobal('fetch', fetchMock)

      await expect(
        importSkillsFromExternalSource('skillhub install tavily-search'),
      ).rejects.toThrow('File too large')

      expect(fetchMock).toHaveBeenCalledTimes(2)
      proxySpy.mockRestore()
    })

    it('should use backend proxy first for skillhub download candidates', async () => {
      const { skills, importSkillsFromExternalSource } = useAIConfig()
      const markdown = [
        '---',
        'name: proxy-installed-skill',
        'description: Installed by backend proxy',
        '---',
        '',
        'Use proxy install flow.',
      ].join('\n')
      const archive = zipSync({ 'SKILL.md': strToU8(markdown) })
      const archiveBase64 = Buffer.from(archive).toString('base64')

      vi.stubGlobal(
        'fetch',
        vi.fn(async () => Promise.reject(new TypeError('Failed to fetch'))),
      )

      const proxySpy = vi.spyOn(httpClient, 'get').mockResolvedValue({
        data: {
          success: true,
          data: {
            sourceUrl: 'https://lightmake.site/api/v1/download?slug=tavily-search',
            finalUrl:
              'https://skillhub-1388575217.cos.accelerate.myqcloud.com/skills/tavily-search/1.0.0.zip',
            contentType: 'application/zip',
            contentLength: archive.byteLength,
            bodyBase64: archiveBase64,
          },
          timestamp: new Date().toISOString(),
        },
      })

      const result = await importSkillsFromExternalSource('skillhub install tavily-search')

      expect(proxySpy).toHaveBeenCalledWith('/skills/external-source', {
        params: { url: 'https://lightmake.site/api/v1/download?slug=tavily-search' },
        timeout: 30000,
      })
      expect(result.importedCount).toBe(1)
      expect(skills.value.map((item) => item.name)).toContain('proxy-installed-skill')

      proxySpy.mockRestore()
    })

    it('should fallback to next external candidate when first one fails', async () => {
      const { importSkillsFromExternalSource } = useAIConfig()
      const markdown = [
        '---',
        'name: github-installed-skill',
        'description: Installed from GitHub raw fallback',
        '---',
        '',
        'Use GitHub fallback flow.',
      ].join('\n')

      const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input)
        if (url.includes('/.curated/github/')) {
          return {
            ok: false,
            status: 404,
            headers: {
              get: () => null,
            },
            text: async () => '',
          }
        }

        return {
          ok: true,
          status: 200,
          headers: {
            get: (key: string) => (key.toLowerCase() === 'content-type' ? 'text/markdown' : null),
          },
          text: async () => markdown,
        }
      })
      vi.stubGlobal('fetch', fetchMock)

      const result = await importSkillsFromExternalSource('skillhub install github')

      expect(fetchMock).toHaveBeenCalledTimes(3)
      expect(result.importedCount).toBe(1)
      expect(result.sourceUrl).toContain('/gh-address-comments/')
    })

    it('should fallback from curated raw url to alias candidate', async () => {
      const { importSkillsFromExternalSource } = useAIConfig()
      const markdown = [
        '---',
        'name: curated-raw-fallback-skill',
        'description: Installed from curated alias fallback',
        '---',
        '',
        'Use curated alias fallback flow.',
      ].join('\n')

      const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input)
        if (url.includes('/.curated/github/')) {
          return {
            ok: false,
            status: 404,
            headers: {
              get: () => null,
            },
            text: async () => '',
          }
        }

        return {
          ok: true,
          status: 200,
          headers: {
            get: (key: string) => (key.toLowerCase() === 'content-type' ? 'text/markdown' : null),
          },
          text: async () => markdown,
        }
      })
      vi.stubGlobal('fetch', fetchMock)

      const result = await importSkillsFromExternalSource(
        'https://raw.githubusercontent.com/openai/skills/main/skills/.curated/github/SKILL.md',
      )

      expect(fetchMock).toHaveBeenCalledTimes(2)
      expect(result.importedCount).toBe(1)
      expect(result.sourceUrl).toContain('/gh-address-comments/')
    })

    it('should reject untrusted external source host', async () => {
      const { importSkillsFromExternalSource } = useAIConfig()

      await expect(
        importSkillsFromExternalSource('https://example.com/skills/remote/SKILL.md'),
      ).rejects.toThrow('Untrusted source host')
    })

    it('should reject trusted candidate when final response url is untrusted', async () => {
      const { importSkillsFromExternalSource } = useAIConfig()
      const content = [
        '---',
        'name: redirected-skill',
        'description: Should be rejected',
        '---',
        '',
        'Do not install.',
      ].join('\n')

      const fetchMock = vi.fn(async () => ({
        ok: true,
        status: 200,
        url: 'https://example.com/redirected/SKILL.md',
        headers: {
          get: (key: string) => (key.toLowerCase() === 'content-type' ? 'text/markdown' : null),
        },
        body: createByteStream([new TextEncoder().encode(content)]),
        text: async () => {
          throw new Error('text() should not be called')
        },
        arrayBuffer: async () => {
          throw new Error('arrayBuffer() should not be called')
        },
      }))
      vi.stubGlobal('fetch', fetchMock)

      await expect(
        importSkillsFromExternalSource(
          'https://raw.githubusercontent.com/openai/skills/main/skills/.curated/gh-address-comments/SKILL.md',
        ),
      ).rejects.toThrow('Untrusted redirect host')
    })

    it('should validate expected SHA256 when provided', async () => {
      const { importSkillsFromExternalSource } = useAIConfig()
      const markdown = [
        '---',
        'name: sha-check-skill',
        'description: Verify SHA check',
        '---',
        '',
        'Use sha check.',
      ].join('\n')
      const validSha256 = createHash('sha256').update(markdown).digest('hex')

      const fetchMock = vi.fn(async () => ({
        ok: true,
        status: 200,
        headers: {
          get: (key: string) => (key.toLowerCase() === 'content-type' ? 'text/markdown' : null),
        },
        text: async () => markdown,
      }))
      vi.stubGlobal('fetch', fetchMock)

      await expect(
        importSkillsFromExternalSource(
          'https://raw.githubusercontent.com/openai/skills/main/skills/.curated/gh-address-comments/SKILL.md',
          {
            expectedSha256: validSha256,
          },
        ),
      ).resolves.toMatchObject({
        importedCount: 1,
      })

      await expect(
        importSkillsFromExternalSource(
          'https://raw.githubusercontent.com/openai/skills/main/skills/.curated/gh-address-comments/SKILL.md',
          {
            expectedSha256: '0'.repeat(64),
          },
        ),
      ).rejects.toThrow('SHA256 mismatch')
    })

    it('should enforce size limit using UTF-8 byte length for multibyte content', async () => {
      const { importSkillsFromExternalSource } = useAIConfig()
      const oversizedMultibyteContent = new TextEncoder().encode('你'.repeat(180000))
      const textSpy = vi.fn(async () => '')
      const arrayBufferSpy = vi.fn(async () => new ArrayBuffer(0))

      const fetchMock = vi.fn(async () => ({
        ok: true,
        status: 200,
        url: 'https://raw.githubusercontent.com/openai/skills/main/skills/.curated/gh-address-comments/SKILL.md',
        headers: {
          get: (key: string) => (key.toLowerCase() === 'content-type' ? 'text/markdown' : null),
        },
        body: createByteStream([oversizedMultibyteContent]),
        text: textSpy,
        arrayBuffer: arrayBufferSpy,
      }))
      vi.stubGlobal('fetch', fetchMock)

      await expect(
        importSkillsFromExternalSource(
          'https://raw.githubusercontent.com/openai/skills/main/skills/.curated/gh-address-comments/SKILL.md',
        ),
      ).rejects.toThrow('File too large')
      expect(textSpy).not.toHaveBeenCalled()
      expect(arrayBufferSpy).not.toHaveBeenCalled()
    })
  })

  describe('syncSkillsFromServer', () => {
    it('should merge local and remote skills by id, keeping newer updatedAt', async () => {
      const { fetchSkills, pushSkills } = await import('@/features/ai/services/aiSyncService')
      vi.mocked(fetchSkills).mockResolvedValue([
        {
          id: 's1',
          name: 'Remote Skill 1',
          prompt: 'Remote prompt 1',
          updatedAt: '2025-06-15T10:00:00.000Z',
        },
        {
          id: 's3',
          name: 'Remote Skill 3',
          prompt: 'Remote prompt 3',
          updatedAt: '2025-06-15T10:00:00.000Z',
        },
      ])
      vi.mocked(pushSkills).mockResolvedValue(undefined)

      const { skills } = useAIConfig()

      // Directly set local skills with known IDs for merge-by-id testing
      skills.value = [
        {
          id: 's1',
          name: 'Local Skill 1',
          prompt: 'Local prompt 1 (newer)',
          updatedAt: '2025-07-01T00:00:00.000Z',
        },
        {
          id: 's2',
          name: 'Local Skill 2',
          prompt: 'Local prompt 2',
          updatedAt: '2025-06-01T00:00:00.000Z',
        },
      ]

      await syncSkillsFromServer()

      // s1: local is newer → keep local
      const s1 = skills.value.find((s) => s.id === 's1')
      expect(s1?.prompt).toBe('Local prompt 1 (newer)')

      // s2: only local → kept
      expect(skills.value.find((s) => s.id === 's2')).toBeTruthy()

      // s3: only remote → added
      const s3 = skills.value.find((s) => s.id === 's3')
      expect(s3?.name).toBe('Remote Skill 3')
    })

    it('should keep local runtime when remote is newer', async () => {
      const { fetchSkills, pushSkills } = await import('@/features/ai/services/aiSyncService')
      vi.mocked(fetchSkills).mockResolvedValue([
        {
          id: 's1',
          name: 'Remote Name',
          prompt: 'Remote prompt (newer)',
          updatedAt: '2025-09-01T00:00:00.000Z',
        },
      ])
      vi.mocked(pushSkills).mockResolvedValue(undefined)

      const { skills } = useAIConfig()
      skills.value = [
        {
          id: 's1',
          name: 'Local Name',
          prompt: 'Local prompt (older)',
          updatedAt: '2025-06-01T00:00:00.000Z',
          runtime: {
            type: 'mcp',
            tool: { name: 'test-tool', description: '', parameters: {} },
            target: { toolName: 'test-tool', serverId: 'test-server' },
          },
        },
      ]

      await syncSkillsFromServer()

      // Remote data (newer) wins for name/prompt, but local runtime is kept
      const s1 = skills.value[0]
      expect(s1.name).toBe('Remote Name')
      expect(s1.prompt).toBe('Remote prompt (newer)')
      expect(s1.runtime).toMatchObject({
        type: 'mcp',
        target: { toolName: 'test-tool', serverId: 'test-server' },
      })
    })
  })

  describe('syncPresetsFromServer', () => {
    it('should merge local and remote presets by id, keeping newer updatedAt', async () => {
      const { fetchPresets, pushPresets } = await import('@/features/ai/services/aiSyncService')
      vi.mocked(fetchPresets).mockResolvedValue([
        {
          id: 'p1',
          name: 'Remote Preset 1',
          baseUrl: 'https://api.remote.com',
          model: 'remote-model',
          systemPrompt: '',
          temperature: 0.7,
          thinkingEffort: 'high' as const,
          todoAssistant: false,
          skillIds: [],
          updatedAt: '2025-08-01T00:00:00.000Z',
        },
      ])
      vi.mocked(pushPresets).mockResolvedValue(undefined)

      const { presets } = useAIConfig()
      presets.value = [
        {
          id: 'p1',
          name: 'Local Preset 1',
          baseUrl: 'https://api.local.com',
          model: 'local-model',
          systemPrompt: '',
          temperature: 0.7,
          todoAssistant: false,
          apiKey: 'sk-local-key',
          updatedAt: '2025-07-01T00:00:00.000Z',
        },
      ]

      await syncPresetsFromServer()

      // Remote is newer → remote data wins for display fields
      const p1 = presets.value[0]
      expect(p1.name).toBe('Remote Preset 1')
      expect(p1.baseUrl).toBe('https://api.remote.com')
      // But local apiKey is preserved
      expect(p1.apiKey).toBe('sk-local-key')
    })

    it('should keep local data when local updatedAt is newer', async () => {
      const { fetchPresets, pushPresets } = await import('@/features/ai/services/aiSyncService')
      vi.mocked(fetchPresets).mockResolvedValue([
        {
          id: 'p1',
          name: 'Old Remote Name',
          baseUrl: 'https://api.remote.com',
          model: 'remote-model',
          systemPrompt: '',
          temperature: 0.7,
          thinkingEffort: 'high' as const,
          todoAssistant: false,
          skillIds: [],
          updatedAt: '2025-01-01T00:00:00.000Z',
        },
      ])
      vi.mocked(pushPresets).mockResolvedValue(undefined)

      const { presets } = useAIConfig()
      presets.value = [
        {
          id: 'p1',
          name: 'Newer Local Name',
          baseUrl: 'https://api.local.com',
          model: 'local-model',
          systemPrompt: '',
          temperature: 0.7,
          todoAssistant: false,
          apiKey: 'sk-local-key',
          updatedAt: '2025-07-01T00:00:00.000Z',
        },
      ]

      await syncPresetsFromServer()

      // Local is newer → local data preserved
      expect(presets.value[0].name).toBe('Newer Local Name')
      expect(presets.value[0].baseUrl).toBe('https://api.local.com')
    })
  })
})
