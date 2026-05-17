import type { ComputedRef, Ref } from 'vue'
import { getTodoPath } from './todo.actions.common'
import type { FilterType, Todo, ViewMode } from './todo.types'

type TodoUiDeps = {
  filter: Ref<FilterType>
  viewMode: Ref<ViewMode>
  searchQuery: Ref<string>
  todoExpansionState: Ref<Record<string, boolean>>
  deferredSectionExpandedPreference: Ref<boolean | null>
  isDrawerOpen: Ref<boolean>
  isMaximized: Ref<boolean>
  isSilencingToast: Ref<boolean>
  error: Ref<string | null>
  filteredTodos: ComputedRef<Todo[]>
  isAllExpanded: ComputedRef<boolean>
  todos: Ref<Todo[]>
}

export function createTodoUiActions(deps: TodoUiDeps): {
  setDrawerOpen: (open: boolean) => void
  setMaximized: (maximized: boolean) => void
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
} {
  function setDrawerOpen(open: boolean): void {
    deps.isDrawerOpen.value = open
  }

  function setMaximized(maximized: boolean): void {
    deps.isMaximized.value = maximized
  }

  function toggleDrawer(): void {
    deps.isDrawerOpen.value = !deps.isDrawerOpen.value
  }

  function setFilter(newFilter: FilterType): void {
    deps.filter.value = newFilter
  }

  function setSearchQuery(query: string): void {
    deps.searchQuery.value = query
  }

  function clearSearch(): void {
    deps.searchQuery.value = ''
  }

  function clearError(): void {
    deps.error.value = null
  }

  function setSilencingToast(silence: boolean): void {
    deps.isSilencingToast.value = silence
  }

  function setDeferredSectionExpandedPreference(expanded: boolean | null): void {
    deps.deferredSectionExpandedPreference.value = expanded
  }

  function toggleAllExpansion(): void {
    const targetState = !deps.isAllExpanded.value
    const nextExpansionState = { ...deps.todoExpansionState.value }
    deps.filteredTodos.value.forEach((todo) => {
      todo.expanded = targetState
      nextExpansionState[todo.id] = targetState
    })
    deps.todoExpansionState.value = nextExpansionState
  }

  function toggleTodoExpansion(id: string): void {
    const todo = deps.todos.value.find((item) => item.id === id)
    if (todo) {
      const nextState = !(todo.expanded ?? true)
      todo.expanded = nextState
      deps.todoExpansionState.value = {
        ...deps.todoExpansionState.value,
        [id]: nextState,
      }
    }
  }

  return {
    setDrawerOpen,
    setMaximized,
    toggleDrawer,
    setFilter,
    setSearchQuery,
    clearSearch,
    clearError,
    setSilencingToast,
    setDeferredSectionExpandedPreference,
    toggleAllExpansion,
    toggleTodoExpansion,
    getTodoPath: (todoId: string) => getTodoPath(deps.todos.value, todoId),
  }
}
