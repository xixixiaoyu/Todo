import type { Todo as SharedTodo, RecurrenceRule } from '@lumina/shared'

export interface Todo extends SharedTodo {
  completedAt?: Date
  deferredAt?: Date
  deletedAt?: Date
  dueAt?: Date
  remindAt?: Date
  remindedAt?: Date
  recurrenceRule?: RecurrenceRule | null
  recurrenceTz?: string | null
  recurrenceSpawnedAt?: Date
  parentId?: string | null
  expanded?: boolean
  isProposed?: boolean
  isProposedDelete?: boolean
  syncStatus?: 'synced' | 'pending' | 'error'
  pomodoroCount: number
}

export type SyncConflictReason = 'TOMBSTONED' | 'OWNER_MISMATCH' | 'VERSION_CONFLICT'

export interface TodoSyncConflict {
  id: string
  reason: SyncConflictReason
  serverVersion?: number
  localDraft?: Todo
  serverSnapshot?: Todo
  occurredAt: Date
}

export interface ProposedTodoChange {
  id: string
  type: 'add' | 'update' | 'delete' | 'toggle' | 'pin'
  data: Partial<Todo> & { title?: string; parentId?: string | null }
}

export type FilterType = 'pending' | 'completed' | 'trash'
export type ViewMode = 'list' | 'visual' | 'stats' | 'scratchpad'
export type TodoDataSource = 'local' | 'remote'

export interface TreeData {
  name: string
  id?: string
  completed?: boolean
  isProposed?: boolean
  isProposedDelete?: boolean
  children?: TreeData[]
  itemStyle?: {
    color?: string
    borderColor?: string
    borderWidth?: number
    shadowBlur?: number
    shadowColor?: string
    shadowOffsetX?: number
    shadowOffsetY?: number
  }
  lineStyle?: {
    color?: string
    width?: number
    type?: string
    curveness?: number
  }
  label?: {
    formatter?: string
    rich?: Record<string, unknown>
  }
}
