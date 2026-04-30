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
  makeDoneStep,
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

describe('aiService - Discussion Edge Cases & Tools', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
  })

  it('should handle model errors gracefully', async () => {
    const messages: ChatMessage[] = [makeUserMessage('Hello')]
    const onStepUpdate = vi.fn()
    const onFinalChunk = vi.fn()

    localStorage.setItem('ai-presets', JSON.stringify([makePreset()]))
    setupDiscussionConfig({
      discussionMode: true,
      discussionModelIds: ['p1'],
      discussionPrimaryModelId: 'p1',
    })

    fetchMock.mockImplementation(async (input: string | URL | Request, init?: RequestInit) => {
      const url = toUrlString(input)
      const body = init?.body ? JSON.parse(init.body as string) : {}
      // Stream request
      if (body.stream === true) {
        return makeStreamResponse('Fallback synthesis')
      }

      if (url.includes('api.p1.com')) {
        throw new Error('Network error')
      }

      return { ok: false } as unknown as Response
    })

    await getMultiModelDiscussionStream(messages, onStepUpdate, onFinalChunk)

    const lastSteps = onStepUpdate.mock.calls[onStepUpdate.mock.calls.length - 1][0]
    expect(lastSteps).toHaveLength(1)
    expect(lastSteps[0].status).toBe('error')
    expect(lastSteps[0].content).toBe('Network error')
    expect(onFinalChunk).toHaveBeenCalledWith('Fallback synthesis')
  })

  it('should preserve contributor execution order from discussionModelIds', async () => {
    const messages = [makeUserMessage('hello')]
    const onStepUpdate = vi.fn()
    const onFinalChunk = vi.fn()

    const presets = makeTwoPresets()
    localStorage.setItem('ai-presets', JSON.stringify(presets))
    setupDiscussionConfig({
      discussionMode: true,
      discussionModelIds: ['p2', 'p1'],
      discussionPrimaryModelId: 'p1',
    })

    fetchMock.mockImplementation(async (input: string | URL | Request, init?: RequestInit) => {
      const url = toUrlString(input)
      const body = init?.body ? JSON.parse(init.body as string) : {}
      if (body.stream === true) return makeStreamResponse('Final')
      return makeNonStreamResponse(url.includes('api.a.com') ? 'A1' : 'A2')
    })

    await getMultiModelDiscussionStream(messages, onStepUpdate, onFinalChunk)

    const lastSteps = onStepUpdate.mock.calls[onStepUpdate.mock.calls.length - 1][0]
    expect(lastSteps[0].modelId).toBe('p2')
    expect(lastSteps[1].modelId).toBe('p1')
  })

  it('should resume only the primary synthesis after tool execution', async () => {
    const messages: ChatMessage[] = [
      makeUserMessage('What is 1+1?'),
      {
        id: 'a1',
        role: 'assistant',
        content: '',
        discussionSteps: [
          makeDoneStep('p1', 'Primary Model', 'The answer is 2.'),
          makeDoneStep('p2', 'Other Model', 'I also think it is 2.'),
        ],
        tool_calls: [
          {
            id: 'call-1',
            type: 'function',
            function: { name: 'lookup_fact', arguments: '{"topic":"1+1"}' },
          },
        ],
      },
      {
        id: 'tool-1',
        role: 'tool',
        tool_call_id: 'call-1',
        toolName: 'lookup_fact',
        content: '{"answer":"2"}',
      },
    ]
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

      expect(body.stream).toBe(true)
      expect(body.messages).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            role: 'user',
            content: expect.stringContaining('Synthesis: What is 1+1?'),
          }),
          expect.objectContaining({
            role: 'assistant',
            tool_calls: [
              expect.objectContaining({
                function: expect.objectContaining({ name: 'lookup_fact' }),
              }),
            ],
          }),
          expect.objectContaining({
            role: 'tool',
            content: '{"answer":"2"}',
          }),
        ]),
      )

      return makeStreamResponse('Tool-informed final answer')
    })

    await getMultiModelDiscussionStream(messages, onStepUpdate, onFinalChunk)

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(onStepUpdate).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ modelId: 'p1', status: 'done' }),
        expect.objectContaining({ modelId: 'p2', status: 'done' }),
      ]),
    )
    expect(onFinalChunk).toHaveBeenCalledWith('Tool-informed final answer')
  })

  it('should preserve earlier synthesis tool history across repeated resumptions', async () => {
    const messages: ChatMessage[] = [
      makeUserMessage('What is 1+1?'),
      {
        id: 'a1',
        role: 'assistant',
        content: '',
        discussionSteps: [
          makeDoneStep('p1', 'Primary Model', 'The answer is 2.'),
          makeDoneStep('p2', 'Other Model', 'I also think it is 2.'),
        ],
        tool_calls: [
          {
            id: 'call-1',
            type: 'function',
            function: { name: 'lookup_fact', arguments: '{"topic":"1+1"}' },
          },
        ],
      },
      {
        id: 'tool-1',
        role: 'tool',
        tool_call_id: 'call-1',
        toolName: 'lookup_fact',
        content: '{"answer":"2"}',
      },
      {
        id: 'a2',
        role: 'assistant',
        content: '',
        discussionSteps: [
          makeDoneStep('p1', 'Primary Model', 'The answer is 2.'),
          makeDoneStep('p2', 'Other Model', 'I also think it is 2.'),
        ],
        tool_calls: [
          {
            id: 'call-2',
            type: 'function',
            function: { name: 'lookup_alt_fact', arguments: '{"topic":"basic arithmetic"}' },
          },
        ],
      },
      {
        id: 'tool-2',
        role: 'tool',
        tool_call_id: 'call-2',
        toolName: 'lookup_alt_fact',
        content: '{"answer":"still 2"}',
      },
    ]
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

      expect(body.stream).toBe(true)
      expect(body.messages).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            role: 'assistant',
            tool_calls: [
              expect.objectContaining({
                function: expect.objectContaining({ name: 'lookup_fact' }),
              }),
            ],
          }),
          expect.objectContaining({
            role: 'tool',
            tool_call_id: 'call-1',
            content: '{"answer":"2"}',
          }),
          expect.objectContaining({
            role: 'assistant',
            tool_calls: [
              expect.objectContaining({
                function: expect.objectContaining({ name: 'lookup_alt_fact' }),
              }),
            ],
          }),
          expect.objectContaining({
            role: 'tool',
            tool_call_id: 'call-2',
            content: '{"answer":"still 2"}',
          }),
        ]),
      )

      return makeStreamResponse('History-preserving answer')
    })

    await getMultiModelDiscussionStream(messages, onStepUpdate, onFinalChunk)

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(onFinalChunk).toHaveBeenCalledWith('History-preserving answer')
  })

  it('should safely fallback when discussionModelIds is invalid data', async () => {
    const messages = [makeUserMessage('hello')]
    const onStepUpdate = vi.fn()
    const onFinalChunk = vi.fn()

    localStorage.setItem('ai-presets', JSON.stringify([makePreset()]))
    setupDiscussionConfig({
      discussionMode: true,
      discussionModelIds: null,
      discussionPrimaryModelId: 'p1',
    })

    fetchMock.mockImplementation(async () => makeStreamResponse('Default response'))

    await getMultiModelDiscussionStream(messages, onStepUpdate, onFinalChunk)

    expect(onStepUpdate).not.toHaveBeenCalled()
    expect(onFinalChunk).toHaveBeenCalledWith('Default response')
  })
})
