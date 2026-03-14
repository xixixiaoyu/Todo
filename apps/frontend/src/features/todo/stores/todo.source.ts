import type { Ref } from 'vue'
import type { Todo, TodoDataSource, TodoSyncConflict } from './todo.types'

export interface TodoSourceManagerDeps {
  todos: Ref<Todo[]>
  todoSource: Ref<TodoDataSource>
  localTodos: Ref<Todo[]>
  remoteTodos: Ref<Todo[]>
  syncConflicts: Ref<TodoSyncConflict[]>
  isTrashLoaded: Ref<boolean>
  snapshotTodos: (items: Todo[]) => Todo[]
  isSameTodoList: (left: Todo[], right: Todo[]) => boolean
}

export interface TodoSourceManager {
  isApplyingSourceSnapshot: () => boolean
  applyTodosSnapshot: (items: Todo[]) => void
  setSourceTodos: (source: TodoDataSource, items: Todo[]) => void
  persistActiveSourceTodos: () => void
  applyTodoSource: (source: TodoDataSource) => void
}

export function createTodoSourceManager(deps: TodoSourceManagerDeps): TodoSourceManager {
  let applyingSourceSnapshot = false

  const applyTodosSnapshot = (items: Todo[]) => {
    const next = deps.snapshotTodos(items)
    if (deps.isSameTodoList(deps.todos.value, next)) return
    applyingSourceSnapshot = true
    deps.todos.value = next
    applyingSourceSnapshot = false
  }

  const setSourceTodos = (source: TodoDataSource, items: Todo[]) => {
    const next = deps.snapshotTodos(items)
    if (source === 'local') {
      if (deps.isSameTodoList(deps.localTodos.value, next)) return
      deps.localTodos.value = next
      return
    }

    if (deps.isSameTodoList(deps.remoteTodos.value, next)) return
    deps.remoteTodos.value = next
  }

  const persistActiveSourceTodos = () => {
    setSourceTodos(deps.todoSource.value, deps.todos.value)
  }

  const applyTodoSource = (source: TodoDataSource) => {
    if (source === deps.todoSource.value) return
    persistActiveSourceTodos()
    deps.todoSource.value = source
    const targetTodos = source === 'local' ? deps.localTodos.value : deps.remoteTodos.value
    applyTodosSnapshot(targetTodos)
    deps.syncConflicts.value = []
    deps.isTrashLoaded.value = false
    if (source === 'remote') {
      deps.todos.value.forEach((item) => {
        if (!item.syncStatus) item.syncStatus = 'pending'
      })
    }
  }

  return {
    isApplyingSourceSnapshot: () => applyingSourceSnapshot,
    applyTodosSnapshot,
    setSourceTodos,
    persistActiveSourceTodos,
    applyTodoSource,
  }
}
