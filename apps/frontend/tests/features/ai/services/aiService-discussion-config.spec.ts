import { describe, it, expect, vi, beforeEach } from 'vitest'
import { getMultiModelDiscussionStream } from '@/features/ai/services/aiService'
import {
  toUrlString,
  makePreset,
  makeTwoPresets,
  setupDiscussionConfig,
  makeStreamResponse,
  makeNonStreamResponse,
  makeUserMessage,
} from './aiService-discussion.fixtures'
import type { ChatMessage } from './aiService-discussion.fixtures'

const fetchMock = vi.mocked(fetch)

// hoisted i18n mock (must be inline, not from fixtures)
vi.mock('@/i18n', () => ({
  default: {
    global: {
      t: vi.fn((key: string, params?: Record<string, unknown>) => {
        if (key === 'ai.parallelSynthesisPrompt' && params) {
          return `Synthesis: ${params.originalQuery} - ${params.discussionData}`
        }
        return key
      }),
    },
  },
}))

const tools = [
  {
    type: 'function' as const,
    function: {
      name: 'lookup_fact',
      description: 'Lookup a fact',
      parameters: {
        type: 'object',
        properties: { topic: { type: 'string' } },
        required: ['topic'],
      },
    },
  },
]

describe('aiService - Discussion Config & Prompt', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
  })

  it('should expose tools only to the primary synthesis request', async () => {
    const messages: ChatMessage[] = [makeUserMessage('Need a grounded answer')]
    const onStepUpdate = vi.fn()
    const onFinalChunk = vi.fn()

    localStorage.setItem('ai-presets', JSON.stringify(makeTwoPresets()))
    setupDiscussionConfig({
      discussionMode: true,
      discussionModelIds: ['p1', 'p2'],
      discussionPrimaryModelId: 'p1',
    })

    fetchMock.mockImplementation(async (_input: string | URL | Request, init?: RequestInit) => {
      const body = init?.body ? JSON.parse(init.body as string) : {}

      if (body.stream === false) {
        expect(body.tools).toBeUndefined()
        expect(body.tool_choice).toBeUndefined()
        return makeNonStreamResponse('Contributor answer')
      }

      expect(body.tools).toEqual(tools)
      expect(body.tool_choice).toBe('auto')
      return makeStreamResponse('Final synthesis')
    })

    await getMultiModelDiscussionStream(
      messages,
      onStepUpdate,
      onFinalChunk,
      undefined,
      undefined,
      { tools },
    )

    expect(fetchMock).toHaveBeenCalledTimes(3)
    expect(onFinalChunk).toHaveBeenCalledWith('Final synthesis')
  })

  it('should use explicitly configured primary model if provided, independent of basic settings', async () => {
    const messages = [makeUserMessage('hello')]
    const onStepUpdate = vi.fn()
    const onFinalChunk = vi.fn()

    localStorage.setItem(
      'ai-presets',
      JSON.stringify([
        makePreset({
          id: 'p1',
          name: 'Primary Model',
          baseUrl: 'api.p1.com',
          apiKey: 'key-p1',
          model: 'm-p1',
        }),
        makePreset({
          id: 'p2',
          name: 'Other Model',
          baseUrl: 'api.p2.com',
          apiKey: 'key-p2',
          model: 'm-p2',
        }),
      ]),
    )
    setupDiscussionConfig({
      discussionMode: true,
      discussionModelIds: ['p2'],
      discussionPrimaryModelId: 'p1',
      // Basic settings are intentionally different from p1
      baseUrl: 'api.basic.com',
      apiKey: 'key-basic',
      model: 'm-basic',
      temperature: 0.7,
    })

    fetchMock.mockImplementation(async (input: string | URL | Request, init?: RequestInit) => {
      const url = toUrlString(input)
      const body = init?.body ? JSON.parse(init.body as string) : {}

      if (body.stream === false) {
        // Parallel model request (p2)
        expect(url).toContain('api.p2.com')
        return makeNonStreamResponse('Answer 1')
      }

      // Final synthesis request (should use p1, not basic)
      expect(url).toContain('api.p1.com')
      expect((init?.headers as Record<string, string>).Authorization).toBe('Bearer key-p1')
      return makeStreamResponse('Final')
    })

    await getMultiModelDiscussionStream(messages, onStepUpdate, onFinalChunk)
  })

  it('should include primary model in contributors if selected', async () => {
    const messages = [makeUserMessage('hello')]
    const onStepUpdate = vi.fn()
    const onFinalChunk = vi.fn()

    const presets = makeTwoPresets()
    localStorage.setItem('ai-presets', JSON.stringify(presets))
    setupDiscussionConfig({
      discussionMode: true,
      discussionModelIds: ['p1', 'p2'],
      discussionPrimaryModelId: 'p1',
      baseUrl: presets[0].baseUrl,
      apiKey: presets[0].apiKey,
      model: presets[0].model,
      temperature: 0.7,
    })

    fetchMock.mockImplementation(async (_input: string | URL | Request, init?: RequestInit) => {
      const body = init?.body ? JSON.parse(init.body as string) : {}
      if (body.stream === true) return makeStreamResponse('Final')
      return makeNonStreamResponse('Answer')
    })

    await getMultiModelDiscussionStream(messages, onStepUpdate, onFinalChunk)

    const lastSteps = onStepUpdate.mock.calls[onStepUpdate.mock.calls.length - 1][0]
    expect(lastSteps).toHaveLength(2)
    expect(lastSteps[0].modelId).toBe('p1')
    expect(lastSteps[1].modelId).toBe('p2')
  })

  it('should pass global thinking config to parallel model requests', async () => {
    const messages = [makeUserMessage('hello')]
    const onStepUpdate = vi.fn()
    const onFinalChunk = vi.fn()

    localStorage.setItem('ai-presets', JSON.stringify([makePreset()]))
    setupDiscussionConfig({
      discussionMode: true,
      discussionModelIds: ['p1'],
      thinkingMode: 'auto',
    })

    fetchMock.mockImplementation(async (_input: string | URL | Request, init?: RequestInit) => {
      const body = init?.body ? JSON.parse(init.body as string) : {}
      if (body.stream === false) {
        expect(body.thinking).toEqual({ type: 'enabled' })
        return makeNonStreamResponse('Success')
      }
      return makeStreamResponse('Final')
    })

    await getMultiModelDiscussionStream(messages, onStepUpdate, onFinalChunk)
  })

  it('should NOT include global system prompt in contributor steps if preset has no prompt', async () => {
    const messages = [makeUserMessage('hello')]
    const onStepUpdate = vi.fn()
    const onFinalChunk = vi.fn()
    const systemPrompt = 'Global System Prompt'

    localStorage.setItem('ai-presets', JSON.stringify([makePreset()]))
    setupDiscussionConfig({
      discussionMode: true,
      discussionModelIds: ['p1'],
      systemPrompt,
    })

    fetchMock.mockImplementation(async (_input: string | URL | Request, init?: RequestInit) => {
      const body = init?.body ? JSON.parse(init.body as string) : {}

      if (body.stream === false) {
        // Parallel model request (contributor)
        expect(body.messages).not.toContainEqual({ role: 'system', content: systemPrompt })
        return makeNonStreamResponse('Success')
      }

      // Final synthesis request
      expect(body.messages).toContainEqual({ role: 'system', content: systemPrompt })
      return makeStreamResponse('Final')
    })

    await getMultiModelDiscussionStream(messages, onStepUpdate, onFinalChunk)
  })

  it('should use preset specific system prompt for contributors', async () => {
    const messages = [makeUserMessage('hello')]
    const onStepUpdate = vi.fn()
    const onFinalChunk = vi.fn()
    const globalSystemPrompt = 'Global System Prompt'
    const presetSystemPrompt = 'Preset System Prompt'

    localStorage.setItem(
      'ai-presets',
      JSON.stringify([makePreset({ systemPrompt: presetSystemPrompt })]),
    )
    setupDiscussionConfig({
      discussionMode: true,
      discussionModelIds: ['p1'],
      systemPrompt: globalSystemPrompt,
    })

    fetchMock.mockImplementation(async (_input: string | URL | Request, init?: RequestInit) => {
      const body = init?.body ? JSON.parse(init.body as string) : {}

      if (body.stream === false) {
        // Parallel model request (contributor)
        expect(body.messages).toContainEqual({ role: 'system', content: presetSystemPrompt })
        expect(body.messages).not.toContainEqual({ role: 'system', content: globalSystemPrompt })
        return makeNonStreamResponse('Success')
      }

      // Final synthesis request
      expect(body.messages).toContainEqual({ role: 'system', content: globalSystemPrompt })
      return makeStreamResponse('Final')
    })

    await getMultiModelDiscussionStream(messages, onStepUpdate, onFinalChunk)
  })
})
