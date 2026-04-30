import { describe, it, expect, vi, beforeEach } from 'vitest'
import { getMultiModelDiscussionStream } from '@/features/ai/services/aiService'
import {
  _resetAIConfig,
  toUrlString,
  makeTwoPresets,
  setupDiscussionConfig,
  makeStreamResponse,
  makeNonStreamResponse,
  makeErrorResponse,
  makeUserMessage,
} from './aiService-discussion.fixtures'
import type { ChatMessage, AIPreset } from './aiService-discussion.fixtures'

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

describe('aiService - Core Discussion Flow', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()

    // Default fetch mock for single model stream (used as fallback)
    fetchMock.mockImplementation(async () => makeStreamResponse('Default response'))
  })

  it('should fall back to single model if no primary or secondary presets are selected', async () => {
    const messages = [makeUserMessage('hello')]
    const onStepUpdate = vi.fn()
    const onFinalChunk = vi.fn()

    // Scenario 1: No secondary models
    localStorage.setItem(
      'ai-config',
      JSON.stringify({
        discussionMode: true,
        discussionModelIds: [],
        discussionPrimaryModelId: 'p1',
      }),
    )
    localStorage.setItem(
      'ai-presets',
      JSON.stringify([{ id: 'p1', name: 'P1', baseUrl: 'api.1.com', apiKey: 'k1', model: 'm1' }]),
    )
    _resetAIConfig()

    await getMultiModelDiscussionStream(messages, onStepUpdate, onFinalChunk)
    expect(onStepUpdate).not.toHaveBeenCalled()

    // Scenario 2: No primary model (even if secondary exists)
    vi.clearAllMocks()
    localStorage.setItem(
      'ai-config',
      JSON.stringify({
        discussionMode: true,
        discussionModelIds: ['p1'],
        discussionPrimaryModelId: null,
      }),
    )
    _resetAIConfig()

    await getMultiModelDiscussionStream(messages, onStepUpdate, onFinalChunk)
    expect(onStepUpdate).not.toHaveBeenCalled()
  })

  it('should handle multi-model discussion (parallel) correctly', async () => {
    const messages: ChatMessage[] = [makeUserMessage('What is 1+1?')]
    const onStepUpdate = vi.fn()
    const onFinalChunk = vi.fn()

    const presets: AIPreset[] = makeTwoPresets()
    localStorage.setItem('ai-presets', JSON.stringify(presets))
    setupDiscussionConfig({
      discussionMode: true,
      discussionModelIds: ['p1', 'p2'],
      discussionPrimaryModelId: 'p1',
    })

    fetchMock.mockImplementation(async (input: string | URL | Request, init?: RequestInit) => {
      const url = toUrlString(input)
      const body = init?.body ? JSON.parse(init.body as string) : {}
      // Stream request (synthesis)
      if (body.stream === true) {
        return makeStreamResponse('Final synthesis')
      }
      // Parallel requests (non-stream)
      const content = url.includes('api.a.com') ? 'Answer from A' : 'Answer from B'
      return makeNonStreamResponse(content)
    })

    await getMultiModelDiscussionStream(messages, onStepUpdate, onFinalChunk)

    expect(onStepUpdate).toHaveBeenCalled()
    const lastSteps = onStepUpdate.mock.calls[onStepUpdate.mock.calls.length - 1][0]
    expect(lastSteps).toHaveLength(2)
    expect(lastSteps[0].modelId).toBe('p1')
    expect(lastSteps[0].status).toBe('done')
    expect(lastSteps[0].content).toBe('Answer from A')
    expect(lastSteps[1].modelId).toBe('p2')
    expect(lastSteps[1].status).toBe('done')
    expect(lastSteps[1].content).toBe('Answer from B')
    expect(onFinalChunk).toHaveBeenCalledWith('Final synthesis')
  })

  it('should fallback to primary direct answer when all discussion models fail', async () => {
    const messages: ChatMessage[] = [makeUserMessage('What is 1+1?')]
    const onStepUpdate = vi.fn()
    const onFinalChunk = vi.fn()

    const presets: AIPreset[] = makeTwoPresets()
    localStorage.setItem('ai-presets', JSON.stringify(presets))
    setupDiscussionConfig({
      discussionMode: true,
      discussionModelIds: ['p1', 'p2'],
      discussionPrimaryModelId: 'p1',
    })

    fetchMock.mockImplementation(async (_input: string | URL | Request, init?: RequestInit) => {
      const body = init?.body ? JSON.parse(init.body as string) : {}
      // Stream request (fallback to primary direct answer)
      if (body.stream === true) {
        const lastMsg = body.messages[body.messages.length - 1]?.content || ''
        expect(lastMsg).toBe('What is 1+1?')
        expect(lastMsg).not.toContain('Synthesis:')
        return makeStreamResponse('Primary fallback answer')
      }
      // All parallel requests fail
      return makeErrorResponse(500, 'Internal Server Error')
    })

    await getMultiModelDiscussionStream(messages, onStepUpdate, onFinalChunk)

    expect(onStepUpdate).toHaveBeenCalled()
    const lastSteps = onStepUpdate.mock.calls[onStepUpdate.mock.calls.length - 1][0]
    expect(lastSteps[0].status).toBe('error')
    expect(lastSteps[0].content).toContain('500')
    expect(lastSteps[1].status).toBe('error')
    expect(lastSteps[1].content).toContain('500')

    expect(onFinalChunk).toHaveBeenCalledWith('Primary fallback answer')
  })
})
