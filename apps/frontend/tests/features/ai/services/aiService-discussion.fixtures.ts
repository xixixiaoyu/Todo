import { vi } from 'vitest'
import { _resetAIConfig } from '@/features/ai/composables/useAIConfig'
import type { AIPreset } from '@/features/ai/composables/useAIConfig'
import type { ChatMessage } from '@/features/ai/services/aiService'

// ---- Re-exports for test convenience ----
export { _resetAIConfig }
export type { AIPreset, ChatMessage }

// ---- URL helper ----
export function toUrlString(input: string | URL | Request): string {
  if (typeof input === 'string') return input
  if (input instanceof URL) return input.toString()
  return input.url
}

// ---- Preset factories ----
export function makePreset(overrides: Partial<AIPreset> = {}): AIPreset {
  return {
    id: 'p1',
    name: 'Model P1',
    baseUrl: 'https://api.p1.com',
    apiKey: 'key-p1',
    model: 'model-p1',
    systemPrompt: '',
    temperature: 0.7,
    todoAssistant: false,
    ...overrides,
  }
}

export function makeTwoPresets(): AIPreset[] {
  return [
    makePreset({
      id: 'p1',
      name: 'Model A',
      baseUrl: 'https://api.a.com',
      apiKey: 'key-a',
      model: 'model-a',
    }),
    makePreset({
      id: 'p2',
      name: 'Model B',
      baseUrl: 'https://api.b.com',
      apiKey: 'key-b',
      model: 'model-b',
    }),
  ]
}

// ---- localStorage config helper ----
export function setupDiscussionConfig(config: {
  discussionModelIds?: string[] | null
  discussionPrimaryModelId?: string | null
  discussionMode?: boolean
  thinkingMode?: string
  systemPrompt?: string
  baseUrl?: string
  apiKey?: string
  model?: string
  temperature?: number
}) {
  localStorage.setItem('ai-config', JSON.stringify(config))
  _resetAIConfig()
}

// ---- Response factories ----
export function makeStreamResponse(content: string): Response {
  return {
    ok: true,
    body: {
      getReader: () => ({
        read: vi
          .fn()
          .mockResolvedValueOnce({
            value: new TextEncoder().encode(
              `data: {"choices":[{"delta":{"content":"${content}"}}]}\n\n`,
            ),
            done: false,
          })
          .mockResolvedValueOnce({
            value: new TextEncoder().encode('data: [DONE]\n\n'),
            done: true,
          }),
      }),
    },
  } as unknown as Response
}

export function makeNonStreamResponse(content: string): Response {
  return {
    ok: true,
    json: async () => ({
      choices: [{ message: { content } }],
    }),
  } as unknown as Response
}

export function makeErrorResponse(status: number, text: string): Response {
  return {
    ok: false,
    status,
    text: async () => text,
  } as unknown as Response
}

// ---- Discussion step helpers ----
export function makeDoneStep(modelId: string, modelName: string, content: string) {
  return { modelId, modelName, content, status: 'done' as const }
}

export function makeUserMessage(content: string): ChatMessage {
  return { id: '1', role: 'user', content } as ChatMessage
}
