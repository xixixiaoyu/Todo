import type { ComputedRef, Ref } from 'vue'
import type { FilterType, Todo, ViewMode } from './todo.types'
import { createTodoMutations } from './todo.actions.mutations'
import { createTodoUiActions } from './todo.actions.ui'
import { createTodoAiActions } from './todo.actions.ai'

export function createTodoActions(deps: {
  todos: Ref<Todo[]>
  filter: Ref<FilterType>
  viewMode: Ref<ViewMode>
  searchQuery: Ref<string>
  todoExpansionState: Ref<Record<string, boolean>>
  deferredSectionExpandedPreference: Ref<boolean | null>
  loading: Ref<boolean>
  isDragging: Ref<boolean>
  error: Ref<string | null>
  filteredTodos: ComputedRef<Todo[]>
  isAllExpanded: ComputedRef<boolean>
  isDrawerOpen: Ref<boolean>
  isMaximized: Ref<boolean>
  isAppFullscreen: Ref<boolean>
  isSilencingToast: Ref<boolean>
}): {
  isDuplicate: (title: string, parentId?: string | null, excludeId?: string) => boolean
  addTodo: (title: string, parentId?: string | null, id?: string) => Promise<string | null>
  addTodos: (titles: string[], parentId?: string | null) => Promise<string[]>
  removeTodos: (ids: string[]) => Promise<void>
  toggleTodo: (id: string) => Promise<void>
  togglePin: (id: string) => Promise<void>
  setTodoDeferred: (id: string, deferred: boolean) => Promise<boolean>
  incrementPomodoro: (id: string) => void
  breakdownTaskWithAI: (id: string) => Promise<string[]>
  restoreTodo: (id: string) => Promise<void>
  deleteTodo: (id: string) => Promise<void>
  updateTodo: (id: string, title?: string, parentId?: string | null) => Promise<boolean>
  updateTodoSchedule: (
    id: string,
    dueAt: Date | null,
    remindAt: Date | null,
    recurrenceRule?: Todo['recurrenceRule'] | null,
  ) => boolean
  reorderTodos: (orderedIds: string[], parentId?: string | null) => void
  setDrawerOpen: (open: boolean) => void
  setMaximized: (maximized: boolean) => void
  setAppFullscreen: (fullscreen: boolean) => void
  toggleDrawer: () => void
  setFilter: (newFilter: FilterType) => void
  setSearchQuery: (query: string) => void
  clearSearch: () => void
  clearError: () => void
  setSilencingToast: (silence: boolean) => void
  setDeferredSectionExpandedPreference: (expanded: boolean | null) => void
  toggleAllExpansion: () => void
  toggleTodoExpansion: (id: string) => void
  getTodoPath: (todoId: string) => string[]
  setDragging: (dragging: boolean) => void
} {
  const mutationActions = createTodoMutations({
    todos: deps.todos,
    loading: deps.loading,
    error: deps.error,
  })

  const uiActions = createTodoUiActions({
    filter: deps.filter,
    viewMode: deps.viewMode,
    searchQuery: deps.searchQuery,
    todoExpansionState: deps.todoExpansionState,
    deferredSectionExpandedPreference: deps.deferredSectionExpandedPreference,
    isDrawerOpen: deps.isDrawerOpen,
    isMaximized: deps.isMaximized,
    isAppFullscreen: deps.isAppFullscreen,
    isSilencingToast: deps.isSilencingToast,
    error: deps.error,
    filteredTodos: deps.filteredTodos,
    isAllExpanded: deps.isAllExpanded,
    todos: deps.todos,
  })

  const aiActions = createTodoAiActions({
    todos: deps.todos,
    loading: deps.loading,
    error: deps.error,
    addTodos: mutationActions.addTodos,
    getTodoPath: uiActions.getTodoPath,
  })

  return {
    ...mutationActions,
    ...aiActions,
    ...uiActions,
    setAppFullscreen: uiActions.setAppFullscreen,
    setDragging: (dragging: boolean) => (deps.isDragging.value = dragging),
  }
}
