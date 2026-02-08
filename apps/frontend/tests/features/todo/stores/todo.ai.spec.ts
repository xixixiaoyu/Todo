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

  it('should breakdown task with AI', async () => {
    const store = useTodoStore()
    const todoId = await store.addTodo('Main Task')

    vi.mocked(aiService.getAIStaticResponse).mockResolvedValue({
      content: 'Subtask 1\nSubtask 2\nSubtask 3',
      role: 'assistant',
    } as unknown as { content: string; reasoning_details?: string })

    await store.breakdownTaskWithAI(todoId!)

    const subtasks = store.todos.filter((t) => t.parentId === todoId)
    expect(subtasks).toHaveLength(3)
    expect(subtasks[0].title).toBe('Subtask 3') // unshift adds to front, so reverse order of insertion if we care, but here we just check count and content
    expect(store.todos.some((t) => t.title === 'Subtask 1')).toBe(true)
  })
})
