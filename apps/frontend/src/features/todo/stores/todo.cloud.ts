import type { Ref } from 'vue'
import type { Todo as SharedTodo } from '@lumina/shared'
import type { Todo, TodoSyncConflict } from './todo.types'
import { createTodoCloudData } from './todo.cloud.data'

export function createTodoCloud(deps: {
  todos: Ref<Todo[]>
  remoteTodos: Ref<Todo[]>
  loading: Ref<boolean>
  error: Ref<string | null>
  lastSyncAt: Ref<string | null>
  syncOwnerId: Ref<number | null>
  syncConflicts: Ref<TodoSyncConflict[]>
  toSharedTodo: (todo: Todo) => SharedTodo
  isTrashLoaded: Ref<boolean>
  isRemoteSource: Ref<boolean>
}): {
  sync: (retryCount?: number) => Promise<void>
  debouncedSync: () => void
  mergeOnLogin: (userId: number) => Promise<void>
  resetSyncStatus: () => void
  acceptSyncConflict: (id: string) => void
  retrySyncConflict: (id: string) => void
  clearSyncConflicts: () => void
  initSocketListener: () => Promise<void>
  deleteTodoPermanently: (id: string) => Promise<void>
  clearTrash: () => Promise<void>
} {
  const cloudData = createTodoCloudData(deps)

  return {
    sync: cloudData.sync,
    debouncedSync: cloudData.debouncedSync,
    mergeOnLogin: cloudData.mergeOnLogin,
    resetSyncStatus: cloudData.resetSyncStatus,
    acceptSyncConflict: cloudData.acceptSyncConflict,
    retrySyncConflict: cloudData.retrySyncConflict,
    clearSyncConflicts: cloudData.clearSyncConflicts,
    initSocketListener: cloudData.initSocketListener,
    deleteTodoPermanently: cloudData.deleteTodoPermanently,
    clearTrash: cloudData.clearTrash,
  }
}
