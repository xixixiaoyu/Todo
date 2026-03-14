import { describe, expect, it, vi } from 'vitest'
import type { Todo } from '@/features/todo/stores/todo.types'
import {
  applyProposedTodoChanges,
  buildBasePreviewTodos,
  type ProposedTodoActions,
} from '@/features/todo/stores/todo.proposed'

function createTodo(overrides: Partial<Todo> = {}): Todo {
  return {
    id: 'todo-1',
    title: 'Todo',
    completed: false,
    order: 0,
    isPinned: false,
    parentId: null,
    version: 1,
    pomodoroCount: 0,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    ...overrides,
  }
}

describe('todo.proposed', () => {
  it('buildBasePreviewTodos applies add/update/delete/toggle/pin changes', () => {
    const todos = [
      createTodo({ id: 'todo-a', title: 'A' }),
      createTodo({ id: 'todo-b', title: 'B', order: 1 }),
    ]

    const preview = buildBasePreviewTodos(todos, [
      { id: 'temp-1', type: 'add', data: { title: 'C', parentId: 'todo-a' } },
      { id: 'chg-1', type: 'update', data: { id: 'todo-a', title: 'A updated' } },
      { id: 'chg-2', type: 'toggle', data: { id: 'todo-a' } },
      { id: 'chg-3', type: 'pin', data: { id: 'todo-a' } },
      { id: 'chg-4', type: 'delete', data: { id: 'todo-b' } },
    ])

    const updated = preview.find((item) => item.id === 'todo-a')
    const deleted = preview.find((item) => item.id === 'todo-b')
    const added = preview.find((item) => item.id === 'temp-1')

    expect(updated?.title).toBe('A updated')
    expect(updated?.completed).toBe(true)
    expect(updated?.isPinned).toBe(true)
    expect(updated?.isProposed).toBe(true)

    expect(deleted?.isProposedDelete).toBe(true)

    expect(added).toBeTruthy()
    expect(added?.title).toBe('C')
    expect(added?.parentId).toBe('todo-a')
    expect(added?.isProposed).toBe(true)
  })

  it('applyProposedTodoChanges maps temp ids and executes actions in expected targets', async () => {
    const actions: ProposedTodoActions = {
      addTodo: vi.fn(async (title: string) => (title === 'Parent' ? 'todo-parent' : 'todo-child')),
      updateTodo: vi.fn(async () => true),
      deleteTodo: vi.fn(async () => {}),
      toggleTodo: vi.fn(async () => {}),
      togglePin: vi.fn(async () => {}),
    }

    await applyProposedTodoChanges(
      [
        { id: 'tmp-parent', type: 'add', data: { title: 'Parent' } },
        { id: 'tmp-child', type: 'add', data: { title: 'Child', parentId: 'tmp-parent' } },
        { id: 'u-1', type: 'update', data: { id: 'tmp-child', title: 'Child v2' } },
        { id: 't-1', type: 'toggle', data: { id: 'tmp-parent' } },
        { id: 'p-1', type: 'pin', data: { id: 'tmp-child' } },
        { id: 'd-1', type: 'delete', data: { id: 'tmp-child' } },
      ],
      [],
      actions,
    )

    expect(actions.addTodo).toHaveBeenNthCalledWith(1, 'Parent', null)
    expect(actions.addTodo).toHaveBeenNthCalledWith(2, 'Child', 'todo-parent')
    expect(actions.updateTodo).toHaveBeenCalledWith('todo-child', 'Child v2', undefined)
    expect(actions.toggleTodo).toHaveBeenCalledWith('todo-parent')
    expect(actions.togglePin).toHaveBeenCalledWith('todo-child')
    expect(actions.deleteTodo).toHaveBeenCalledWith('todo-child')
  })

  it('applyProposedTodoChanges skips add actions with blank title', async () => {
    const actions: ProposedTodoActions = {
      addTodo: vi.fn(async () => 'todo-1'),
      updateTodo: vi.fn(async () => true),
      deleteTodo: vi.fn(async () => {}),
      toggleTodo: vi.fn(async () => {}),
      togglePin: vi.fn(async () => {}),
    }

    await applyProposedTodoChanges(
      [{ id: 'tmp-blank', type: 'add', data: { title: '   ' } }],
      [],
      actions,
    )

    expect(actions.addTodo).not.toHaveBeenCalled()
  })
})
