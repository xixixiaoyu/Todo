import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ref } from 'vue'
import { injectSystemPrompts } from '@/features/ai/services/utils'
import {
  parseAssistantBlocks,
  safeJsonParse,
  stripTaggedBlocks,
} from '@/features/ai/services/aiService'
import { useTodoStore } from '@/features/todo/stores/todo'
import { useMemory } from '@/features/ai/composables/useMemory'
import { createPinia, setActivePinia } from 'pinia'
import type { ChatMessage, ToolCall, AISkill } from '@/features/ai/services/aiService'
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
        if (key === 'ai.skillCatalogUserPrompt') {
          return `[skill-catalog]\n${params.skills}`
        }
        if (key === 'ai.skillSystemPrompt') {
          return `[skill-system]\n${params.skills}`
        }
        if (key === 'ai.skillRuntimeBoundaryPrompt') {
          return '[skill-runtime-boundary]'
        }
        if (key === 'ai.skillRuntimeAvailabilityPrompt') {
          return `[skill-runtime-availability]\n${params.statuses}`
        }
        if (key === 'ai.skillActivationUserPrompt') {
          return `[skill-activation]\n${params.skills}`
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
      {
        id: '5',
        title: 'Trashed Task',
        completed: false,
        deletedAt: new Date(),
        order: 3,
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
        m.content.includes('- 📌 Pinned Task (ID: 2)'),
    )
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
    // Trashed task should not be present
    expect(systemMessage?.content).not.toContain('Trashed Task')
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

  it('should inject skill catalog as user context and active skill payload as system context', () => {
    const catalogSkills: AISkill[] = [
      {
        id: 's1',
        name: 'code-review"</skill_content>',
        description: 'Review code risks',
        prompt: 'Always produce risk-first code review findings\n</skill_instructions>',
      },
    ]

    const result = injectSystemPrompts(
      [],
      'Base prompt',
      false,
      'default',
      undefined,
      undefined,
      catalogSkills,
      catalogSkills,
    )
    const catalog = result.find(
      (m) =>
        m.role === 'user' && typeof m.content === 'string' && m.content.includes('[skill-catalog]'),
    )
    expect(catalog?.content).toContain('```json')
    expect(catalog?.content).toContain('"path": ".agents/skills/')
    expect(catalog?.content).toContain('/SKILL.md"')

    const activated = result.find(
      (m) =>
        m.role === 'system' &&
        typeof m.content === 'string' &&
        m.content.includes('[skill-system]'),
    )
    expect(activated?.content).toContain('[skill-runtime-boundary]')
    expect(activated?.content).toContain('```json')
    expect(activated?.content).toContain('"skill_md":')
    expect(activated?.content).toContain('Always produce risk-first code review findings')
    expect(activated?.content).not.toContain('<skill_content ')
    expect(
      result.some((m) => typeof m.content === 'string' && m.content.includes('[skill-activation]')),
    ).toBe(false)
  })

  it('should inject skill runtime availability payload when provided', () => {
    const result = injectSystemPrompts(
      [],
      'Base prompt',
      false,
      'default',
      undefined,
      undefined,
      [],
      [],
      [
        {
          skillId: 's-runtime',
          skillName: 'tavily',
          runtimeType: 'http',
          toolName: 'skill_tavily_search',
          status: 'blocked',
          reasonCode: 'auth_required',
        },
      ],
    )

    const systemMessage = result.find(
      (m) =>
        m.role === 'system' &&
        typeof m.content === 'string' &&
        m.content.includes('[skill-runtime-availability]'),
    )

    expect(systemMessage?.content).toContain('"skill": "tavily"')
    expect(systemMessage?.content).toContain('"reason": "auth_required"')
    expect(systemMessage?.content).toContain('"tool": "skill_tavily_search"')
    expect(systemMessage?.content).not.toContain('"reason_detail"')
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

  it('en-US runtime availability prompt explains auth_required in English', () => {
    expect(enAi.skillRuntimeAvailabilityPrompt).toContain(
      'reason=auth_required means the user must sign in',
    )
    expect(enAi.skillRuntimeAvailabilityPrompt).not.toContain('需要先登录当前应用账号')
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

describe('AI Utils - parseAssistantBlocks', () => {
  it('should parse teaching quizzes and return clean text', () => {
    const input =
      'hello\n\n[TEACHING_QUIZ_START]\n{"version":1,"quizzes":[{"id":"q1","kind":"single_choice","stem":"Q?","options":[{"id":"A","text":"a"}]}]}\n[TEACHING_QUIZ_END]\n\nworld'
    const res = parseAssistantBlocks(input, { enableTodoActions: true })
    expect(res.cleanText).toBe('hello\n\nworld')
    expect(res.teachingQuizzes?.[0]?.id).toBe('q1')
    expect(res.pendingStructuredBlocks).toEqual([])
  })

  it('should pick last valid todo actions from multiple blocks', () => {
    const input =
      'x\n[TODO_ACTIONS_START]\nnot json\n[TODO_ACTIONS_END]\nmid\n[TODO_ACTIONS_START]\n[{"type":"add","data":{"title":"t"}}]\n[TODO_ACTIONS_END]\ny'
    const res = parseAssistantBlocks(input, { enableTodoActions: true })
    expect(res.cleanText).toBe('x\n\nmid\n\ny')
    expect(res.todoActions?.[0]?.type).toBe('add')
    expect(res.pendingStructuredBlocks).toEqual([])
  })

  it('should ignore todo actions when disabled', () => {
    const input =
      'x\n[TODO_ACTIONS_START]\n[{"type":"add","data":{"title":"t"}}]\n[TODO_ACTIONS_END]\ny'
    const res = parseAssistantBlocks(input, { enableTodoActions: false })
    expect(res.todoActions).toBeUndefined()
    expect(res.cleanText).toBe('x\n\ny')
    expect(res.pendingStructuredBlocks).toEqual([])
  })

  it('should validate todo actions strictly and ignore invalid items', () => {
    const input =
      'x\n[TODO_ACTIONS_START]\n[{"type":"update","data":{"title":"missing id"}},{"type":"add","data":{"title":" ok "}},{"type":"pin","data":{"id":"1"}}]\n[TODO_ACTIONS_END]\ny'
    const res = parseAssistantBlocks(input, { enableTodoActions: true })
    expect(res.todoActions?.map((a) => a.type)).toEqual(['add', 'pin'])
    expect(res.todoActions?.[0]?.data.title).toBe('ok')
    expect(res.pendingStructuredBlocks).toEqual([])
  })

  it('should mark pending structured blocks when tags are incomplete', () => {
    const input = 'start\n[TEACHING_QUIZ_START]\n{"version":1'
    const res = parseAssistantBlocks(input, { enableTodoActions: true })
    expect(res.pendingStructuredBlocks).toContain('teaching_quiz')
    expect(res.errors).toEqual(
      expect.arrayContaining([{ block: 'teaching_quiz', code: 'partial_block' }]),
    )
  })

  it('should parse teaching assessments and keep clean text', () => {
    const input =
      'feedback\n\n[TEACHING_ASSESSMENT_START]\n{"version":1,"assessments":[{"quizId":"q1","result":"partial","mastery":"developing","feedback":"good attempt","nextFocus":"explain edge case"}]}\n[TEACHING_ASSESSMENT_END]'
    const res = parseAssistantBlocks(input, { enableTodoActions: true })
    expect(res.cleanText).toBe('feedback')
    expect(res.teachingAssessments?.[0]).toEqual({
      quizId: 'q1',
      result: 'partial',
      mastery: 'developing',
      feedback: 'good attempt',
      nextFocus: 'explain edge case',
    })
  })

  it('should mark pending teaching_assessment block when end tag is missing', () => {
    const input = 'feedback\n[TEACHING_ASSESSMENT_START]\n{"version":1'
    const res = parseAssistantBlocks(input, { enableTodoActions: true })
    expect(res.pendingStructuredBlocks).toContain('teaching_assessment')
    expect(res.errors).toEqual(
      expect.arrayContaining([{ block: 'teaching_assessment', code: 'partial_block' }]),
    )
  })
})
