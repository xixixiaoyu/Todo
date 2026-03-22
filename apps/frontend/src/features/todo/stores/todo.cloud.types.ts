import type { Ref } from 'vue'
import type { Todo as SharedTodo } from '@lumina/shared'
import type { Todo, TodoSyncConflict } from './todo.types'

export interface TodoCloudDataDeps {
  todos: Ref<Todo[]>
  remoteTodos: Ref<Todo[]>
  loading: Ref<boolean>
  error: Ref<string | null>
  lastSyncAt: Ref<string | null>
  syncOwnerId: Ref<number | null>
  syncConflicts: Ref<TodoSyncConflict[]>
  isTrashLoaded: Ref<boolean>
  isRemoteSource: Ref<boolean>
  toSharedTodo: (todo: Todo) => SharedTodo
}
