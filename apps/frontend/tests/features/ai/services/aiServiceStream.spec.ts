import { describe, it, expect, vi, beforeEach } from 'vitest'
import { getAIStreamResponse } from '@/features/ai/services/aiService'
import { _resetAIConfig } from '@/features/ai/composables/useAIConfig'

const fetchMock = vi.mocked(fetch)

describe('aiService - Stream Parsing', () => {
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

  it('should handle standard SSE format with "data: " prefix and reasoning', async () => {
    const onChunk = vi.fn()
    const onThinking = vi.fn()
    const encoder = new TextEncoder()

    fetchMock.mockResolvedValueOnce({
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
    } as unknown as Response)

    await getAIStreamResponse([], onChunk, onThinking)

    expect(onChunk).toHaveBeenCalledWith('Hello')
    expect(onThinking).toHaveBeenCalledWith('Thinking...')
    expect(onChunk).toHaveBeenCalledWith('[DONE]')
  })

  it('should handle raw JSON format without "data: " prefix and reasoning details', async () => {
    const onChunk = vi.fn()
    const onReasoningDetails = vi.fn()
    const encoder = new TextEncoder()

    fetchMock.mockResolvedValueOnce({
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
    } as unknown as Response)

    await getAIStreamResponse([], onChunk, undefined, onReasoningDetails)

    expect(onChunk).toHaveBeenCalledWith('Hi')
    expect(onReasoningDetails).toHaveBeenCalledWith('Details')
    expect(onChunk).toHaveBeenCalledWith('[DONE]')
  })

  it('should handle multiple JSON objects in one chunk', async () => {
    const onChunk = vi.fn()
    const encoder = new TextEncoder()

    fetchMock.mockResolvedValueOnce({
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
    } as unknown as Response)

    await getAIStreamResponse([], onChunk)
    expect(onChunk).toHaveBeenCalledWith('Part1')
    expect(onChunk).toHaveBeenCalledWith('Part2')
  })

  it('should process remaining buffer at the end', async () => {
    const onChunk = vi.fn()
    const encoder = new TextEncoder()

    fetchMock.mockResolvedValueOnce({
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
    } as unknown as Response)

    await getAIStreamResponse([], onChunk)

    expect(onChunk).toHaveBeenCalledWith('End')
    expect(onChunk).toHaveBeenCalledWith('[DONE]')
  })

  it('should prefer reasoning details over reasoning content when both exist', async () => {
    const onChunk = vi.fn()
    const onThinking = vi.fn()
    const onReasoningDetails = vi.fn()
    const encoder = new TextEncoder()

    fetchMock.mockResolvedValueOnce({
      ok: true,
      body: {
        getReader: () => ({
          read: vi
            .fn()
            .mockResolvedValueOnce({
              value: encoder.encode(
                'data: {"choices":[{"delta":{"reasoning_content":"generic","reasoning_details":[{"type":"reasoning.summary","summary":[{"text":"detailed summary"}]}]}}]}\n\n',
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
    } as unknown as Response)

    await getAIStreamResponse([], onChunk, onThinking, onReasoningDetails)

    expect(onReasoningDetails).toHaveBeenCalledWith('detailed summary')
    expect(onThinking).not.toHaveBeenCalled()
  })

  it('should fallback to reasoning text when reasoning_details is encrypted', async () => {
    const onChunk = vi.fn()
    const onReasoningDetails = vi.fn()
    const encoder = new TextEncoder()

    fetchMock.mockResolvedValueOnce({
      ok: true,
      body: {
        getReader: () => ({
          read: vi
            .fn()
            .mockResolvedValueOnce({
              value: encoder.encode(
                'data: {"choices":[{"delta":{"reasoning":"visible summary","reasoning_details":[{"type":"reasoning.encrypted","data":"abc"}]}}]}\n\n',
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
    } as unknown as Response)

    await getAIStreamResponse([], onChunk, undefined, onReasoningDetails)

    expect(onReasoningDetails).toHaveBeenCalledWith('visible summary')
  })

  it('should accumulate single-chunk tool_call arguments correctly', async () => {
    const encoder = new TextEncoder()
    const onChunk = vi.fn()
    const onToolCall = vi.fn()
    const onThinking = vi.fn()
    const onReasoningDetails = vi.fn()

    const chunkPayload = JSON.stringify({
      choices: [
        {
          delta: {
            tool_calls: [
              {
                index: 0,
                id: 'call_1',
                function: { name: 'web_search', arguments: '{"query":"hello"}' },
              },
            ],
          },
        },
      ],
    })

    fetchMock.mockResolvedValueOnce({
      ok: true,
      body: {
        getReader: () => ({
          read: vi
            .fn()
            .mockResolvedValueOnce({
              value: encoder.encode(`data: ${chunkPayload}\n\n`),
              done: false,
            })
            .mockResolvedValueOnce({ value: encoder.encode('data: [DONE]\n\n'), done: false })
            .mockResolvedValueOnce({ value: null, done: true }),
        }),
      },
    } as unknown as Response)

    await getAIStreamResponse([], onChunk, onThinking, onReasoningDetails, {}, onToolCall)

    expect(onToolCall).toHaveBeenCalledTimes(1)
    expect(onToolCall).toHaveBeenCalledWith({
      id: 'call_1',
      type: 'function',
      function: { name: 'web_search', arguments: '{"query":"hello"}' },
    })
    expect(onChunk).toHaveBeenCalledWith('[DONE]')
  })

  it('should accumulate tool_call arguments across multiple SSE chunks', async () => {
    const encoder = new TextEncoder()
    const onChunk = vi.fn()
    const onToolCall = vi.fn()
    const onThinking = vi.fn()
    const onReasoningDetails = vi.fn()

    // Chunk 1: first fragment with name and partial arguments
    const chunk1 = JSON.stringify({
      choices: [
        {
          delta: {
            tool_calls: [
              {
                index: 0,
                function: { name: 'web_search', arguments: '{"query":' },
              },
            ],
          },
        },
      ],
    })

    // Chunk 2: middle fragment
    const chunk2 = JSON.stringify({
      choices: [
        {
          delta: {
            tool_calls: [
              {
                index: 0,
                function: { arguments: '"hello","max' },
              },
            ],
          },
        },
      ],
    })

    // Chunk 3: final fragment
    const chunk3 = JSON.stringify({
      choices: [
        {
          delta: {
            tool_calls: [
              {
                index: 0,
                function: { arguments: 'Results":5}' },
              },
            ],
          },
        },
      ],
    })

    fetchMock.mockResolvedValueOnce({
      ok: true,
      body: {
        getReader: () => ({
          read: vi
            .fn()
            .mockResolvedValueOnce({ value: encoder.encode(`data: ${chunk1}\n\n`), done: false })
            .mockResolvedValueOnce({ value: encoder.encode(`data: ${chunk2}\n\n`), done: false })
            .mockResolvedValueOnce({ value: encoder.encode(`data: ${chunk3}\n\n`), done: false })
            .mockResolvedValueOnce({ value: encoder.encode('data: [DONE]\n\n'), done: false })
            .mockResolvedValueOnce({ value: null, done: true }),
        }),
      },
    } as unknown as Response)

    await getAIStreamResponse([], onChunk, onThinking, onReasoningDetails, {}, onToolCall)

    // Accumulated arguments: '{"query":' + '"hello","max' + 'Results":5}' = '{"query":"hello","maxResults":5}'
    expect(onToolCall).toHaveBeenCalledTimes(1)
    expect(onToolCall).toHaveBeenCalledWith({
      id: '',
      type: 'function',
      function: { name: 'web_search', arguments: '{"query":"hello","maxResults":5}' },
    })
    expect(onChunk).toHaveBeenCalledWith('[DONE]')
  })

  it('should handle multiple tool_calls with different indices in one stream', async () => {
    const encoder = new TextEncoder()
    const onChunk = vi.fn()
    const onToolCall = vi.fn()
    const onThinking = vi.fn()
    const onReasoningDetails = vi.fn()

    const chunk1 = JSON.stringify({
      choices: [
        {
          delta: {
            tool_calls: [
              { index: 0, id: 'call_a', function: { name: 'func_a', arguments: '{"a":1}' } },
            ],
          },
        },
      ],
    })

    const chunk2 = JSON.stringify({
      choices: [
        {
          delta: {
            tool_calls: [
              { index: 1, id: 'call_b', function: { name: 'func_b', arguments: '{"b":2}' } },
            ],
          },
        },
      ],
    })

    fetchMock.mockResolvedValueOnce({
      ok: true,
      body: {
        getReader: () => ({
          read: vi
            .fn()
            .mockResolvedValueOnce({ value: encoder.encode(`data: ${chunk1}\n\n`), done: false })
            .mockResolvedValueOnce({ value: encoder.encode(`data: ${chunk2}\n\n`), done: false })
            .mockResolvedValueOnce({ value: encoder.encode('data: [DONE]\n\n'), done: false })
            .mockResolvedValueOnce({ value: null, done: true }),
        }),
      },
    } as unknown as Response)

    await getAIStreamResponse([], onChunk, onThinking, onReasoningDetails, {}, onToolCall)

    expect(onToolCall).toHaveBeenCalledTimes(2)
    expect(onToolCall).toHaveBeenCalledWith({
      id: 'call_a',
      type: 'function',
      function: { name: 'func_a', arguments: '{"a":1}' },
    })
    expect(onToolCall).toHaveBeenCalledWith({
      id: 'call_b',
      type: 'function',
      function: { name: 'func_b', arguments: '{"b":2}' },
    })
    expect(onChunk).toHaveBeenCalledWith('[DONE]')
  })

  it('should suppress XML fallback when structured tool_calls exist', async () => {
    const encoder = new TextEncoder()
    const onChunk = vi.fn()
    const onToolCall = vi.fn()
    const onThinking = vi.fn()
    const onReasoningDetails = vi.fn()

    // Delta contains BOTH content (with <tool_call> XML) and structured tool_calls
    const chunkPayload = JSON.stringify({
      choices: [
        {
          delta: {
            content:
              '<tool_call>web_search<arg_key>query</arg_key><arg_value>should_not_fire</arg_value></tool_call>Some text',
            tool_calls: [
              {
                index: 0,
                id: 'call_1',
                function: { name: 'web_search', arguments: '{"query":"real"}' },
              },
            ],
          },
        },
      ],
    })

    fetchMock.mockResolvedValueOnce({
      ok: true,
      body: {
        getReader: () => ({
          read: vi
            .fn()
            .mockResolvedValueOnce({
              value: encoder.encode(`data: ${chunkPayload}\n\n`),
              done: false,
            })
            .mockResolvedValueOnce({ value: encoder.encode('data: [DONE]\n\n'), done: false })
            .mockResolvedValueOnce({ value: null, done: true }),
        }),
      },
    } as unknown as Response)

    await getAIStreamResponse([], onChunk, onThinking, onReasoningDetails, {}, onToolCall)

    // Clean text (XML stripped) should be delivered via onChunk
    expect(onChunk).toHaveBeenCalledWith('Some text')
    // Only the structured tool call should be fired
    expect(onToolCall).toHaveBeenCalledTimes(1)
    expect(onToolCall).toHaveBeenCalledWith({
      id: 'call_1',
      type: 'function',
      function: { name: 'web_search', arguments: '{"query":"real"}' },
    })
    // No XML fallback with "xml_fallback_" id
    expect(onToolCall).not.toHaveBeenCalledWith(
      expect.objectContaining({
        id: expect.stringContaining('xml_fallback'),
      }),
    )
    expect(onChunk).toHaveBeenCalledWith('[DONE]')
  })

  it('should guard non-string arguments with JSON.stringify', async () => {
    const encoder = new TextEncoder()
    const onChunk = vi.fn()
    const onToolCall = vi.fn()
    const onThinking = vi.fn()
    const onReasoningDetails = vi.fn()

    // arguments sent as an object (non-compliant proxy behavior)
    const chunkPayload = JSON.stringify({
      choices: [
        {
          delta: {
            tool_calls: [
              {
                index: 0,
                id: 'call_test',
                function: { name: 'test', arguments: { query: 'hello' } },
              },
            ],
          },
        },
      ],
    })

    fetchMock.mockResolvedValueOnce({
      ok: true,
      body: {
        getReader: () => ({
          read: vi
            .fn()
            .mockResolvedValueOnce({
              value: encoder.encode(`data: ${chunkPayload}\n\n`),
              done: false,
            })
            .mockResolvedValueOnce({ value: encoder.encode('data: [DONE]\n\n'), done: false })
            .mockResolvedValueOnce({ value: null, done: true }),
        }),
      },
    } as unknown as Response)

    await getAIStreamResponse([], onChunk, onThinking, onReasoningDetails, {}, onToolCall)

    expect(onToolCall).toHaveBeenCalledTimes(1)
    // The non-string arguments object should be JSON.stringify'd
    expect(onToolCall).toHaveBeenCalledWith({
      id: 'call_test',
      type: 'function',
      function: { name: 'test', arguments: '{"query":"hello"}' },
    })
    expect(onChunk).toHaveBeenCalledWith('[DONE]')
  })
})
