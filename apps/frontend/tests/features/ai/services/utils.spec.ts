import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ref } from 'vue'
import { injectSystemPrompts } from '@/features/ai/services/utils'
import { safeJsonParse, stripTaggedBlocks } from '@/features/ai/services/aiService'
import { useTodoStore } from '@/features/todo/stores/todo'
import { useMemory } from '@/features/ai/composables/useMemory'
import { createPinia, setActivePinia } from 'pinia'
import type { ChatMessage, ToolCall } from '@/features/ai/services/aiService'
import { ai as zhAi } from '@/i18n/locales/zh-CN/ai'
import { ai as enAi } from '@/i18n/locales/en-US/ai'

// Mock dependencies
vi.mock('@/features/ai/composables/useAIConfig', () => ({
  getAIConfig: vi.fn(() => ({ apiKey: 'test-key' })),
}))

vi.mock('@/features/ai/composables/useMemory', () => ({
  useMemory: vi.fn(),
}))

vi.mock('@/i18n', () => ({
  default: {
    global: {
      t: vi.fn((key, params) => {
        if (key === 'ai.todoAssistantPrompt') {
          return `Context: ${params.count} tasks\n${params.todoList}`
        }
        return key
      }),
    },
  },
}))

describe('AI Utils - injectSystemPrompts', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()

    // Default mock for useMemory
    vi.mocked(useMemory).mockReturnValue({
      memories: ref<string[]>([]),
      isMemoryEnabled: ref(false),
      autoCompressThreshold: ref(30),
      isCompressing: ref(false),
      lastError: ref(null),
      addMemories: vi.fn(),
      addMemory: vi.fn(),
      updateMemory: vi.fn(),
      compressMemories: vi.fn(),
      removeMemory: vi.fn(),
      clearMemories: vi.fn(),
      toggleMemory: vi.fn(),
      updateAutoCompressThreshold: vi.fn(),
      getMemoryModelOptions: vi.fn(),
      exportMemories: vi.fn(() => '[]'),
      importMemories: vi.fn(),
    } as ReturnType<typeof useMemory>)
  })

  it('should inject base system prompt', () => {
    const result = injectSystemPrompts([], 'Base prompt', false, 'default')
    expect(result).toContainEqual({ role: 'system', content: 'Base prompt' })
  })

  it('should inject hierarchical and sorted todo list', () => {
    const todoStore = useTodoStore()
    todoStore.todos = [
      {
        id: '1',
        title: 'Task 1',
        completed: false,
        order: 1,
        version: 0,
        pomodoroCount: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
        isPinned: false,
      },
      {
        id: '2',
        title: 'Pinned Task',
        completed: false,
        isPinned: true,
        order: 0,
        version: 0,
        pomodoroCount: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: '3',
        title: 'Child Task',
        completed: false,
        parentId: '1',
        order: 0,
        version: 0,
        pomodoroCount: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
        isPinned: false,
      },
      {
        id: '4',
        title: 'Completed Task',
        completed: true,
        order: 2,
        version: 0,
        pomodoroCount: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
        isPinned: false,
      },
    ]

    const result = injectSystemPrompts([], '', true, 'default')
    const systemMessage = result.find(
      (m) =>
        m.role === 'system' &&
        typeof m.content === 'string' &&
        m.content.includes('Todo 助手上下文'),
    )

    expect(systemMessage?.content).toContain('用户当前有 3 个待完成的待办事项')
    // Check sorting and hierarchy
    // Pinned task should be first
    // Task 1 should be next
    // Child task should be indented under Task 1
    const content = systemMessage?.content as string
    expect(content).toContain('- 📌 Pinned Task (ID: 2)')
    expect(content).toContain('- Task 1 (ID: 1)')
    expect(content).toContain('  - Child Task (ID: 3)')
    // Completed task should not be present
    expect(systemMessage?.content).not.toContain('Completed Task')
  })

  it('should inject memories when enabled', () => {
    vi.mocked(useMemory).mockReturnValue({
      memories: ref<string[]>(['Memory 1', 'Memory 2']),
      isMemoryEnabled: ref(true),
      autoCompressThreshold: ref(30),
      isCompressing: ref(false),
      lastError: ref(null),
      addMemories: vi.fn(),
      addMemory: vi.fn(),
      updateMemory: vi.fn(),
      compressMemories: vi.fn(),
      removeMemory: vi.fn(),
      clearMemories: vi.fn(),
      toggleMemory: vi.fn(),
      updateAutoCompressThreshold: vi.fn(),
      getMemoryModelOptions: vi.fn(),
      exportMemories: vi.fn(() => '[]'),
      importMemories: vi.fn(),
    } as ReturnType<typeof useMemory>)

    const result = injectSystemPrompts([], '', false, 'default')
    const memoryMessage = result.find(
      (m) =>
        typeof m.content === 'string' &&
        (m.content.includes('ai.memoryContextLabel') || m.content.includes('用户已知信息记录')),
    )
    expect(memoryMessage).toBeDefined()
    expect(memoryMessage?.content).toContain('- Memory 1')
    expect(memoryMessage?.content).toContain('- Memory 2')
  })

  it('should preserve tool_calls and tool_call_id for tool protocol', () => {
    const toolCalls: ToolCall[] = [
      {
        id: 'tc1',
        type: 'function',
        function: { name: 'mcp_x_tool', arguments: '{"q":"x"}' },
      },
    ]

    const messages: ChatMessage[] = [
      {
        id: 'a1',
        role: 'assistant',
        content: 'calling tool',
        tool_calls: toolCalls,
      },
      {
        id: 't1',
        role: 'tool',
        tool_call_id: 'tc1',
        content: '{"ok":true}',
      },
    ]

    const result = injectSystemPrompts(messages, 'Base prompt', false, 'default')

    const assistant = result.find((m) => m.role === 'assistant') as
      | { tool_calls?: ToolCall[] }
      | undefined

    const tool = result.find((m) => m.role === 'tool') as { tool_call_id?: string } | undefined

    expect(assistant?.tool_calls?.[0]?.id).toBe('tc1')
    expect(tool?.tool_call_id).toBe('tc1')
  })
})

function extractTeachingQuizJson(prompt: string): string {
  const startTag = '[TEACHING_QUIZ_START]'
  const endTag = '[TEACHING_QUIZ_END]'
  let start = prompt.indexOf(startTag)
  while (start !== -1) {
    const end = prompt.indexOf(endTag, start + startTag.length)
    if (end === -1) break
    const candidate = prompt.slice(start + startTag.length, end).trim()
    const first = candidate[0]
    if (first === '{' || first === '[') return candidate
    start = prompt.indexOf(startTag, end + endTag.length)
  }
  throw new Error('Teaching quiz JSON block not found')
}

describe('AI i18n - teachingModeSystemPrompt', () => {
  it('zh-CN teaching prompt contains parseable quiz JSON', () => {
    expect(zhAi.teachingModeSystemPrompt).not.toContain("{'{'}")
    const jsonStr = extractTeachingQuizJson(zhAi.teachingModeSystemPrompt)
    const parsed = JSON.parse(jsonStr) as { version: number; quizzes: unknown[] }
    expect(parsed.version).toBe(1)
    expect(Array.isArray(parsed.quizzes)).toBe(true)
    expect(parsed.quizzes.length).toBeGreaterThan(0)
  })

  it('en-US teaching prompt contains parseable quiz JSON', () => {
    expect(enAi.teachingModeSystemPrompt).not.toContain("{'{'}")
    const jsonStr = extractTeachingQuizJson(enAi.teachingModeSystemPrompt)
    const parsed = JSON.parse(jsonStr) as { version: number; quizzes: unknown[] }
    expect(parsed.version).toBe(1)
    expect(Array.isArray(parsed.quizzes)).toBe(true)
    expect(parsed.quizzes.length).toBeGreaterThan(0)
  })
})

describe('AI Utils - tagged block protocol', () => {
  it('should keep content unchanged when no tags exist', () => {
    const res = stripTaggedBlocks(' hello ', '[X]', '[/X]')
    expect(res.text).toBe('hello')
    expect(res.inners).toEqual([])
    expect(res.hasPartialStart).toBe(false)
  })

  it('should hide content after partial start tag', () => {
    const res = stripTaggedBlocks('hi\n[X]\n{"a":1}', '[X]', '[/X]')
    expect(res.text).toBe('hi')
    expect(res.inners).toEqual([])
    expect(res.hasPartialStart).toBe(true)
  })

  it('should strip multiple blocks and keep last inner parseable', () => {
    const input = 'a\n[X]\n{"a":1}\n[/X]\nmid\n[X]\n{"b":2}\n[/X]\nend'
    const res = stripTaggedBlocks(input, '[X]', '[/X]')
    expect(res.text).toBe('a\n\nmid\n\nend')
    expect(res.inners).toHaveLength(2)
    expect(safeJsonParse(res.inners[1])).toEqual({ b: 2 })
  })
})
