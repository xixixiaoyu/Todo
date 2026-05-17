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
        if (key === 'ai.todoAssistantRolePrompt') {
          return 'ai.todoAssistantRolePrompt'
        }
        if (key === 'ai.todoAssistantContextPrompt') {
          return `ai.todoAssistantContextPrompt\n${params.count} tasks\n${params.todoList}`
        }
        if (key === 'ai.todoListTruncatedHint') {
          return `…（还有 ${params.remaining} 项未列出，如需完整列表请告知）`
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

  it('should output three sections in correct order: pinned, recent, other', () => {
    const todoStore = useTodoStore()
    const now = new Date()
    const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000)

    const todos: Array<{
      id: string
      title: string
      completed: boolean
      order: number
      version: number
      pomodoroCount: number
      isPinned: boolean
      createdAt: Date
      updatedAt: Date
    }> = [
      {
        id: 'p1',
        title: 'Pinned Task',
        completed: false,
        order: 0,
        version: 0,
        pomodoroCount: 0,
        isPinned: true,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 'r1',
        title: 'Recent Task',
        completed: false,
        order: 1,
        version: 0,
        pomodoroCount: 0,
        isPinned: false,
        createdAt: now,
        updatedAt: threeDaysAgo,
      },
      {
        id: 'o1',
        title: 'Old Task',
        completed: false,
        order: 2,
        version: 0,
        pomodoroCount: 0,
        isPinned: false,
        createdAt: new Date('2025-01-01'),
        updatedAt: new Date('2025-01-01'),
      },
    ]

    todoStore.todos = todos as unknown as typeof todoStore.todos
    const result = injectSystemPrompts([], '', true, 'default')
    const systemMessage = result.find((m) => m.role === 'system' && typeof m.content === 'string')
    const content = systemMessage?.content as string

    // 三个区段标题
    expect(content).toContain('━━ 置顶 ━━')
    expect(content).toContain('━━ 近期活跃 (最近 7 天) ━━')
    expect(content).toContain('━━ 其他待办 ━━')

    // 顺序：置顶 → 近期活跃 → 其他
    const pinnedIdx = content.indexOf('━━ 置顶 ━━')
    const recentIdx = content.indexOf('━━ 近期活跃 (最近 7 天) ━━')
    const otherIdx = content.indexOf('━━ 其他待办 ━━')
    expect(pinnedIdx).toBeLessThan(recentIdx)
    expect(recentIdx).toBeLessThan(otherIdx)

    // 总览摘要
    expect(content).toContain('[待办总览: 3 项，1 个置顶，1 个最近活跃]')
  })

  it('should not trigger soft cap when other section has 50 or fewer roots', () => {
    const todoStore = useTodoStore()
    const todos: Array<{
      id: string
      title: string
      completed: boolean
      order: number
      version: number
      pomodoroCount: number
      isPinned: boolean
      createdAt: Date
      updatedAt: Date
    }> = []

    for (let i = 1; i <= 50; i++) {
      todos.push({
        id: String(i),
        title: `Task ${i}`,
        completed: false,
        order: i,
        version: 0,
        pomodoroCount: 0,
        isPinned: false,
        createdAt: new Date('2025-01-01'),
        updatedAt: new Date('2025-01-01'),
      })
    }

    todoStore.todos = todos as unknown as typeof todoStore.todos
    const result = injectSystemPrompts([], '', true, 'default')
    const systemMessage = result.find((m) => m.role === 'system' && typeof m.content === 'string')
    const content = systemMessage?.content as string

    // 50 条全部出现，无截断提示
    expect(content).toContain('Task 1')
    expect(content).toContain('Task 50')
    expect(content).not.toContain('还有')
    expect(content).not.toContain('more items')
  })

  it('should truncate other section at 50 roots and show hint', () => {
    const todoStore = useTodoStore()
    const todos: Array<{
      id: string
      title: string
      completed: boolean
      order: number
      version: number
      pomodoroCount: number
      isPinned: boolean
      createdAt: Date
      updatedAt: Date
    }> = []

    for (let i = 1; i <= 55; i++) {
      todos.push({
        id: String(i),
        title: `Task ${i}`,
        completed: false,
        order: i,
        version: 0,
        pomodoroCount: 0,
        isPinned: false,
        createdAt: new Date('2025-01-01'),
        updatedAt: new Date('2025-01-01'),
      })
    }

    todoStore.todos = todos as unknown as typeof todoStore.todos
    const result = injectSystemPrompts([], '', true, 'default')
    const systemMessage = result.find((m) => m.role === 'system' && typeof m.content === 'string')
    const content = systemMessage?.content as string

    // 前 50 个出现
    expect(content).toContain('Task 1')
    expect(content).toContain('Task 50')
    // 第 51-55 不出现
    expect(content).not.toContain('Task 51')
    expect(content).not.toContain('Task 55')
    // 截断提示
    expect(content).toContain('还有 5 项未列出')
  })

  it('should preserve subtree integrity: child nodes stay with parent', () => {
    const todoStore = useTodoStore()
    const todos: Array<{
      id: string
      title: string
      completed: boolean
      order: number
      version: number
      pomodoroCount: number
      isPinned: boolean
      parentId?: string
      createdAt: Date
      updatedAt: Date
    }> = []

    // 49 old roots + 1 old root with children
    for (let i = 1; i <= 49; i++) {
      todos.push({
        id: `old-${i}`,
        title: `Old ${i}`,
        completed: false,
        order: i,
        version: 0,
        pomodoroCount: 0,
        isPinned: false,
        createdAt: new Date('2025-01-01'),
        updatedAt: new Date('2025-01-01'),
      })
    }

    // 第 50 个 root 有一个子节点（都在"其他"区段）
    todos.push({
      id: 'old-50',
      title: 'Old 50 with child',
      completed: false,
      order: 50,
      version: 0,
      pomodoroCount: 0,
      isPinned: false,
      createdAt: new Date('2025-01-01'),
      updatedAt: new Date('2025-01-01'),
    })
    todos.push({
      id: 'child-of-50',
      title: 'Child of 50',
      completed: false,
      order: 0,
      version: 0,
      pomodoroCount: 0,
      isPinned: false,
      parentId: 'old-50',
      createdAt: new Date('2025-01-01'),
      updatedAt: new Date('2025-01-01'),
    })

    // 第 51 个 root（会被截断）
    todos.push({
      id: 'old-51',
      title: 'Old 51 truncated',
      completed: false,
      order: 51,
      version: 0,
      pomodoroCount: 0,
      isPinned: false,
      createdAt: new Date('2025-01-01'),
      updatedAt: new Date('2025-01-01'),
    })

    todoStore.todos = todos as unknown as typeof todoStore.todos
    const result = injectSystemPrompts([], '', true, 'default')
    const systemMessage = result.find((m) => m.role === 'system' && typeof m.content === 'string')
    const content = systemMessage?.content as string

    // 第 50 个 root 及其子节点都在（子树完整）
    expect(content).toContain('Old 50 with child')
    expect(content).toContain('Child of 50')
    // 第 51 个 root 不在
    expect(content).not.toContain('Old 51 truncated')
    // 截断提示
    expect(content).toContain('还有 1 项未列出')
  })

  it('should inject two separate prompt blocks when todoAssistant is enabled', () => {
    const todoStore = useTodoStore()
    todoStore.todos = [
      {
        id: '1',
        title: 'Test Task',
        completed: false,
        order: 1,
        version: 0,
        pomodoroCount: 0,
        isPinned: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]

    const result = injectSystemPrompts([], '', true, 'default')
    const systemMessage = result.find((m) => m.role === 'system' && typeof m.content === 'string')
    const content = systemMessage?.content as string

    // 应该包含 role prompt 和 context prompt 两块内容
    expect(content).toContain('ai.todoAssistantRolePrompt')
    expect(content).toContain('ai.todoAssistantContextPrompt')
  })

  it('should not inject todo blocks when todoAssistant is false', () => {
    const todoStore = useTodoStore()
    todoStore.todos = [
      {
        id: '1',
        title: 'Test Task',
        completed: false,
        order: 1,
        version: 0,
        pomodoroCount: 0,
        isPinned: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]

    const result = injectSystemPrompts([], 'Base prompt', false, 'default')
    const systemMessage = result.find((m) => m.role === 'system' && typeof m.content === 'string')
    const content = systemMessage?.content as string

    // 不应包含任何待办助手相关 prompt
    expect(content).toBeDefined()
    expect(content).not.toContain('ai.todoAssistantRolePrompt')
    expect(content).not.toContain('ai.todoAssistantContextPrompt')
    expect(content).not.toContain('ai.todoAssistantPrompt')
  })

  it('should handle empty todo list without error', () => {
    const todoStore = useTodoStore()
    todoStore.todos = []

    const result = injectSystemPrompts([], '', true, 'default')
    const systemMessage = result.find((m) => m.role === 'system' && typeof m.content === 'string')
    const content = systemMessage?.content as string

    expect(content).toContain('ai.todoAssistantRolePrompt')
    expect(content).toContain('ai.todoAssistantContextPrompt')
    expect(content).toContain('0')
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
