import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useTodoStore } from '@/features/todo/stores/todo'
import * as aiService from '@/features/ai/services'

vi.mock('@/features/ai/services', () => ({
  getAIStaticResponse: vi.fn(),
}))

describe('useTodoStore - AI Actions', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  it('should breakdown task with AI using JSON', async () => {
    const store = useTodoStore()
    const todoId = await store.addTodo('Main Task')

    vi.mocked(aiService.getAIStaticResponse).mockResolvedValue({
      content: '["Subtask 1", "Subtask 2", "Subtask 3"]',
      role: 'assistant',
    } as unknown as { content: string; reasoning_details?: string })

    await store.breakdownTaskWithAI(todoId!)

    const subtasks = store.todos.filter((t) => t.parentId === todoId)
    expect(subtasks).toHaveLength(3)
    // Order is reversed because of unshift
    expect(subtasks[0].title).toBe('Subtask 3')
    expect(subtasks[1].title).toBe('Subtask 2')
    expect(subtasks[2].title).toBe('Subtask 1')
  })

  it('should fallback to line splitting if JSON fails', async () => {
    const store = useTodoStore()
    const todoId = await store.addTodo('Main Task')

    vi.mocked(aiService.getAIStaticResponse).mockResolvedValue({
      content: '1. Line 1\n2. Line 2\n3. Line 3',
      role: 'assistant',
    } as unknown as { content: string; reasoning_details?: string })

    await store.breakdownTaskWithAI(todoId!)

    const subtasks = store.todos.filter((t) => t.parentId === todoId)
    expect(subtasks).toHaveLength(3)
    expect(subtasks[0].title).toBe('Line 3')
  })
})
