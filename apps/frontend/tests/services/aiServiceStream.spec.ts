import { describe, it, expect, vi, beforeEach } from 'vitest'
import { getAIStreamResponse } from '@/services/aiService'

// Mock global fetch
const mockFetch = vi.fn()
global.fetch = mockFetch

describe('aiService - Stream Parsing', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should handle standard SSE format with "data: " prefix and reasoning', async () => {
    const onChunk = vi.fn()
    const onThinking = vi.fn()
    const encoder = new TextEncoder()

    mockFetch.mockResolvedValueOnce({
      ok: true,
      body: {
        getReader: () => ({
          read: vi
            .fn()
            .mockResolvedValueOnce({
              value: encoder.encode(
                'data: {"choices":[{"delta":{"content":"Hello","reasoning_content":"Thinking..."}}]}\n\n',
              ),
              done: false,
            })
            .mockResolvedValueOnce({
              value: encoder.encode('data: [DONE]\n\n'),
              done: false,
            })
            .mockResolvedValueOnce({
              value: null,
              done: true,
            }),
        }),
      },
    })

    await getAIStreamResponse([], onChunk, onThinking)

    expect(onChunk).toHaveBeenCalledWith('Hello')
    expect(onThinking).toHaveBeenCalledWith('Thinking...')
    expect(onChunk).toHaveBeenCalledWith('[DONE]')
  })

  it('should handle raw JSON format without "data: " prefix and reasoning details', async () => {
    const onChunk = vi.fn()
    const onReasoningDetails = vi.fn()
    const encoder = new TextEncoder()

    mockFetch.mockResolvedValueOnce({
      ok: true,
      body: {
        getReader: () => ({
          read: vi
            .fn()
            .mockResolvedValueOnce({
              value: encoder.encode(
                '{"choices":[{"delta":{"content":"Hi","reasoning_details":"Details"}}]}\n',
              ),
              done: false,
            })
            .mockResolvedValueOnce({
              value: null,
              done: true,
            }),
        }),
      },
    })

    await getAIStreamResponse([], onChunk, undefined, onReasoningDetails)

    expect(onChunk).toHaveBeenCalledWith('Hi')
    expect(onReasoningDetails).toHaveBeenCalledWith('Details')
    expect(onChunk).toHaveBeenCalledWith('[DONE]')
  })

  it('should handle multiple JSON objects in one chunk', async () => {
    const onChunk = vi.fn()
    const encoder = new TextEncoder()

    mockFetch.mockResolvedValueOnce({
      ok: true,
      body: {
        getReader: () => ({
          read: vi
            .fn()
            .mockResolvedValueOnce({
              value: encoder.encode(
                '{"choices":[{"delta":{"content":"Part1"}}]}\n{"choices":[{"delta":{"content":"Part2"}}]}\n',
              ),
              done: false,
            })
            .mockResolvedValueOnce({
              value: null,
              done: true,
            }),
        }),
      },
    })

    await getAIStreamResponse([], onChunk)
    expect(onChunk).toHaveBeenCalledWith('Part1')
    expect(onChunk).toHaveBeenCalledWith('Part2')
  })

  it('should process remaining buffer at the end', async () => {
    const onChunk = vi.fn()
    const encoder = new TextEncoder()

    mockFetch.mockResolvedValueOnce({
      ok: true,
      body: {
        getReader: () => ({
          read: vi
            .fn()
            .mockResolvedValueOnce({
              value: encoder.encode('{"choices":[{"delta":{"content":"End"}}]}'), // No newline
              done: false,
            })
            .mockResolvedValueOnce({
              value: null,
              done: true,
            }),
        }),
      },
    })

    await getAIStreamResponse([], onChunk)

    expect(onChunk).toHaveBeenCalledWith('End')
    expect(onChunk).toHaveBeenCalledWith('[DONE]')
  })
})
