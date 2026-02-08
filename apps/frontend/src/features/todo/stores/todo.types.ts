import type { Todo as SharedTodo } from '@my-app/shared'

export interface Todo extends SharedTodo {
  completedAt?: Date
  deletedAt?: Date
  parentId?: string | null
  expanded?: boolean
  isProposed?: boolean
  isProposedDelete?: boolean
  syncStatus?: 'synced' | 'pending' | 'error'
  pomodoroCount: number
}

export interface ProposedTodoChange {
  id: string
  type: 'add' | 'update' | 'delete' | 'toggle' | 'pin'
  data: Partial<Todo> & { title?: string; parentId?: string | null }
}

export type FilterType = 'pending' | 'completed' | 'trash'
export type ViewMode = 'list' | 'visual' | 'stats'
