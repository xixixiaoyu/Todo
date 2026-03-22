import type { TodoCloudDataDeps } from './todo.cloud.types'
import { createTodoCloudConflictActions } from './todo.cloud.conflicts'
import { createTodoCloudListenerActions } from './todo.cloud.listeners'
import { createTodoCloudSyncActions } from './todo.cloud.sync'
import { createTodoCloudTrashActions } from './todo.cloud.trash'

export function createTodoCloudData(deps: TodoCloudDataDeps): {
  sync: (retryCount?: number) => Promise<void>
  debouncedSync: () => void
  fetchTrash: () => Promise<void>
  mergeOnLogin: (userId: number) => Promise<void>
  resetSyncStatus: () => void
  acceptSyncConflict: (id: string) => void
  retrySyncConflict: (id: string) => void
  clearSyncConflicts: () => void
  initSocketListener: () => Promise<void>
  deleteTodoPermanently: (id: string) => Promise<void>
  clearTrash: () => Promise<void>
} {
  const syncActions = createTodoCloudSyncActions(deps)
  const conflictActions = createTodoCloudConflictActions(deps, syncActions.debouncedSync)
  const listenerActions = createTodoCloudListenerActions(
    deps,
    syncActions.debouncedSync,
    syncActions.getLastSyncCallAt,
  )
  const trashActions = createTodoCloudTrashActions(deps)

  return {
    sync: syncActions.sync,
    debouncedSync: syncActions.debouncedSync,
    fetchTrash: trashActions.fetchTrash,
    mergeOnLogin: syncActions.mergeOnLogin,
    resetSyncStatus: syncActions.resetSyncStatus,
    acceptSyncConflict: conflictActions.acceptSyncConflict,
    retrySyncConflict: conflictActions.retrySyncConflict,
    clearSyncConflicts: conflictActions.clearSyncConflicts,
    initSocketListener: listenerActions.initSocketListener,
    deleteTodoPermanently: trashActions.deleteTodoPermanently,
    clearTrash: trashActions.clearTrash,
  }
}
