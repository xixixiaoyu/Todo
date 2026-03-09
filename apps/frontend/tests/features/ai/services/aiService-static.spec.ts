import { describe, it, expect, vi, beforeEach } from 'vitest'
import { getAIStaticResponse } from '@/features/ai/services/aiService'
import { _resetAIConfig } from '@/features/ai/composables/useAIConfig'

const fetchMock = vi.mocked(fetch)

describe('aiService - Static Response', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    localStorage.clear()
    localStorage.setItem(
      'ai-config',
      JSON.stringify({
        baseUrl: 'https://api.example.com',
        apiKey: 'sk-test',
        model: 'test-model',
      }),
    )
    _resetAIConfig()
  })

  it('should get static response with reasoning', async () => {
    const messages = [{ role: 'user' as const, content: 'hello' }]

    fetchMock.mockImplementation(async () => {
      return {
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content: 'Hello world',
                reasoning_content: 'DeepSeek thinking',
                reasoning: 'Standard reasoning',
              },
            },
          ],
        }),
      } as unknown as Response
    })

    const result = await getAIStaticResponse(messages)

    expect(result.content).toBe('Hello world')
    // 优先级: reasoning_details > reasoning > reasoning_content
    expect(result.reasoning_details).toBe('Standard reasoning')
  })

  it('should handle array format reasoning_details in non-stream response', async () => {
    const messages = [{ role: 'user' as const, content: 'hello' }]

    fetchMock.mockImplementation(async () => {
      return {
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content: 'Hello world',
                reasoning: [{ type: 'reasoning.text', text: 'Step 1. ' }, { text: 'Step 2.' }],
              },
            },
          ],
        }),
      } as unknown as Response
    })

    const result = await getAIStaticResponse(messages)

    expect(result.reasoning_details).toBe('Step 1. Step 2.')
  })

  it('should normalize summary objects in reasoning array', async () => {
    const messages = [{ role: 'user' as const, content: 'hello' }]

    fetchMock.mockImplementation(async () => {
      return {
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content: 'Hello world',
                reasoning_details: [
                  {
                    type: 'reasoning.summary',
                    summary: [{ text: 'Answering multiple trick puzzles' }],
                  },
                ],
              },
            },
          ],
        }),
      } as unknown as Response
    })

    const result = await getAIStaticResponse(messages)

    expect(result.reasoning_details).toBe('Answering multiple trick puzzles')
  })

  it('should fallback to reasoning when reasoning_details is encrypted', async () => {
    const messages = [{ role: 'user' as const, content: 'hello' }]

    fetchMock.mockImplementation(async () => {
      return {
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content: 'Hello world',
                reasoning: 'visible summary',
                reasoning_details: [{ type: 'reasoning.encrypted', data: 'encrypted' }],
              },
            },
          ],
        }),
      } as unknown as Response
    })

    const result = await getAIStaticResponse(messages)

    expect(result.reasoning_details).toBe('visible summary')
  })
})
