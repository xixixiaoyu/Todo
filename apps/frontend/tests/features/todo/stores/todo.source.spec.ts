import { describe, expect, it } from 'vitest'
import { ref } from 'vue'
import type { Todo, TodoSyncConflict } from '@/features/todo/stores/todo.types'
import { snapshotTodos } from '@/features/todo/stores/todo.dates'
import { isSameTodoList } from '@/features/todo/stores/todo.snapshot'
import { createTodoSourceManager } from '@/features/todo/stores/todo.source'

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

describe('todo.source', () => {
  it('persistActiveSourceTodos stores current todos to the active source snapshot', () => {
    const todos = ref<Todo[]>([createTodo({ id: 'active-local' })])
    const todoSource = ref<'local' | 'remote'>('local')
    const localTodos = ref<Todo[]>([])
    const remoteTodos = ref<Todo[]>([])
    const syncConflicts = ref<TodoSyncConflict[]>([])
    const isTrashLoaded = ref(false)

    const manager = createTodoSourceManager({
      todos,
      todoSource,
      localTodos,
      remoteTodos,
      syncConflicts,
      isTrashLoaded,
      snapshotTodos,
      isSameTodoList,
    })

    manager.persistActiveSourceTodos()
    expect(localTodos.value).toHaveLength(1)
    expect(localTodos.value[0].id).toBe('active-local')

    todoSource.value = 'remote'
    todos.value = [createTodo({ id: 'active-remote' })]
    manager.persistActiveSourceTodos()
    expect(remoteTodos.value).toHaveLength(1)
    expect(remoteTodos.value[0].id).toBe('active-remote')
  })

  it('applyTodoSource switches source, resets flags, and marks remote todos pending', () => {
    const localState = [createTodo({ id: 'local-1', syncStatus: 'synced' })]
    const remoteState = [createTodo({ id: 'remote-1' }), createTodo({ id: 'remote-2', order: 1 })]
    const todos = ref<Todo[]>(snapshotTodos(localState))
    const todoSource = ref<'local' | 'remote'>('local')
    const localTodos = ref<Todo[]>(snapshotTodos(localState))
    const remoteTodos = ref<Todo[]>(snapshotTodos(remoteState))
    const syncConflicts = ref<TodoSyncConflict[]>([
      { id: 'remote-1', reason: 'VERSION_CONFLICT', occurredAt: new Date() },
    ])
    const isTrashLoaded = ref(true)

    const manager = createTodoSourceManager({
      todos,
      todoSource,
      localTodos,
      remoteTodos,
      syncConflicts,
      isTrashLoaded,
      snapshotTodos,
      isSameTodoList,
    })

    manager.applyTodoSource('remote')

    expect(todoSource.value).toBe('remote')
    expect(todos.value.map((item) => item.id)).toEqual(['remote-1', 'remote-2'])
    expect(todos.value.every((item) => item.syncStatus === 'pending')).toBe(true)
    expect(syncConflicts.value).toEqual([])
    expect(isTrashLoaded.value).toBe(false)
  })
})
