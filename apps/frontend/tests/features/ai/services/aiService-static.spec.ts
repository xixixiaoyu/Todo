import { describe, it, expect, vi, beforeEach } from 'vitest'
import { getAIStaticResponse } from '@/features/ai/services/aiService'

// Mock fetch
const mockFetch = vi.fn()
Object.defineProperty(window, 'fetch', {
  value: mockFetch,
})

describe('aiService - Static Response', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should get static response with reasoning', async () => {
    const messages = [{ role: 'user', content: 'hello' }]

    mockFetch.mockImplementation(async () => ({
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
    }))

    const result = await getAIStaticResponse(messages)

    expect(result.content).toBe('Hello world')
    // 优先级: reasoning_details > reasoning > reasoning_content
    expect(result.reasoning_details).toBe('Standard reasoning')
  })

  it('should handle array format reasoning_details in non-stream response', async () => {
    const messages = [{ role: 'user', content: 'hello' }]

    mockFetch.mockImplementation(async () => ({
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
    }))

    const result = await getAIStaticResponse(messages)

    expect(result.reasoning_details).toBe('Step 1. Step 2.')
  })
})
