import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ref } from 'vue'
import { injectSystemPrompts } from '@/features/ai/services/utils'
import { useTodoStore } from '@/features/todo/stores/todo'
import { useMemory } from '@/features/ai/composables/useMemory'
import { createPinia, setActivePinia } from 'pinia'

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
    const result = injectSystemPrompts([], 'Base prompt', false)
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

    const result = injectSystemPrompts([], '', true)
    const systemMessage = result.find((m) => m.role === 'system')

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

    const result = injectSystemPrompts([], '', false)
    const memoryMessage = result.find(
      (m) =>
        typeof m.content === 'string' &&
        (m.content.includes('ai.memoryContextLabel') || m.content.includes('用户已知信息记录')),
    )
    expect(memoryMessage).toBeDefined()
    expect(memoryMessage?.content).toContain('- Memory 1')
    expect(memoryMessage?.content).toContain('- Memory 2')
  })
})
