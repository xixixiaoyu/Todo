import type { ComputedRef, Ref } from 'vue'
import { getAIStaticResponse } from '@/features/ai/services'
import type { FilterType, Todo, ViewMode } from './todo.types'

export function createTodoActions(deps: {
  todos: Ref<Todo[]>
  filter: Ref<FilterType>
  viewMode: Ref<ViewMode>
  searchQuery: Ref<string>
  loading: Ref<boolean>
  error: Ref<string | null>
  filteredTodos: ComputedRef<Todo[]>
  isAllExpanded: ComputedRef<boolean>
  debouncedSync: () => void
  sync: () => Promise<void>
  isDrawerOpen: Ref<boolean>
  isMaximized: Ref<boolean>
  isSilencingToast: Ref<boolean>
}): {
  isDuplicate: (title: string, parentId?: string | null, excludeId?: string) => boolean
  fetchTodos: () => Promise<void>
  addTodo: (title: string, parentId?: string | null, id?: string) => Promise<string | null>
  toggleTodo: (id: string) => Promise<void>
  togglePin: (id: string) => Promise<void>
  incrementPomodoro: (id: string) => void
  breakdownTaskWithAI: (id: string) => Promise<void>
  restoreTodo: (id: string) => Promise<void>
  deleteTodo: (id: string) => Promise<void>
  updateTodo: (id: string, title: string) => Promise<boolean>
  reorderTodos: (orderedIds: string[], parentId?: string | null) => void
  setDrawerOpen: (open: boolean) => void
  setMaximized: (maximized: boolean) => void
  toggleDrawer: () => void
  setFilter: (newFilter: FilterType) => void
  setSearchQuery: (query: string) => void
  clearSearch: () => void
  clearError: () => void
  setSilencingToast: (silence: boolean) => void
  toggleAllExpansion: () => void
  toggleTodoExpansion: (id: string) => void
  getTodoPath: (todoId: string) => string[]
} {
  function isDuplicate(title: string, parentId: string | null = null, excludeId?: string): boolean {
    const trimmedTitle = title.trim().toLowerCase()
    return deps.todos.value.some(
      (todo) =>
        todo.id !== excludeId &&
        (todo.parentId ?? null) === parentId &&
        !todo.completed &&
        !todo.deletedAt &&
        todo.title.toLowerCase() === trimmedTitle,
    )
  }

  async function fetchTodos(): Promise<void> {
    deps.todos.value.forEach((todo, index) => {
      if (todo.order === undefined) {
        todo.order = index
      }
    })

    const { useAuthStore } = await import('@/features/auth/stores/auth')
    const authStore = useAuthStore()
    if (authStore.isAuthenticated) {
      await deps.sync()
    }
  }

  function reorderTodos(orderedIds: string[], parentId: string | null = null): void {
    for (const id of orderedIds) {
      const todo = deps.todos.value.find((t) => t.id === id)
      if (todo && (todo.parentId ?? null) !== parentId) {
        if (isDuplicate(todo.title, parentId, id)) {
          deps.error.value = 'todo.duplicate'
          return
        }
      }
    }

    orderedIds.forEach((id, index) => {
      const todo = deps.todos.value.find((t) => t.id === id)
      if (todo) {
        const hasChanged =
          todo.order !== index || (parentId !== undefined && todo.parentId !== parentId)
        if (hasChanged) {
          todo.order = index
          if (parentId !== undefined) {
            todo.parentId = parentId
          }
          todo.updatedAt = new Date()
          todo.syncStatus = 'pending'
        }
      }
    })

    deps.debouncedSync()
  }

  function generateId(): string {
    const c =
      typeof window !== 'undefined' ? window.crypto : typeof crypto !== 'undefined' ? crypto : null
    if (c?.randomUUID) {
      return c.randomUUID()
    }
    if (c?.getRandomValues) {
      return Array.from(c.getRandomValues(new Uint8Array(16)))
        .map((b, i) =>
          (i === 6 ? (b & 0x0f) | 0x40 : i === 8 ? (b & 0x3f) | 0x80 : b)
            .toString(16)
            .padStart(2, '0'),
        )
        .join('')
        .replace(/(.{8})(.{4})(.{4})(.{4})(.{12})/, '$1-$2-$3-$4-$5')
    }
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0
      const v = c === 'x' ? r : (r & 0x3) | 0x8
      return v.toString(16)
    })
  }

  async function addTodo(
    title: string,
    parentId: string | null = null,
    id?: string,
  ): Promise<string | null> {
    const trimmedTitle = title.trim()
    if (!trimmedTitle) return null

    if (isDuplicate(trimmedTitle, parentId)) {
      deps.error.value = 'todo.duplicate'
      return null
    }

    if (parentId) {
      const parent = deps.todos.value.find((t) => t.id === parentId)
      if (parent?.completed) {
        deps.error.value = 'todo.parentCompleted'
        return null
      }
    }

    deps.loading.value = true
    try {
      const minOrder =
        deps.todos.value.length > 0 ? Math.min(...deps.todos.value.map((t) => t.order ?? 0)) : 0

      const newTodo: Todo = {
        id: id || generateId(),
        title: trimmedTitle,
        completed: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        isPinned: false,
        parentId,
        order: minOrder - 1,
        expanded: true,
        version: 0,
        syncStatus: 'pending',
        pomodoroCount: 0,
      }
      deps.todos.value.unshift(newTodo)

      deps.debouncedSync()

      return newTodo.id
    } catch (err) {
      console.error('Failed to add todo:', err)
      deps.error.value = 'todo.addError'
      return null
    } finally {
      deps.loading.value = false
    }
  }

  function updateParentStatus(parentId: string): void {
    const parent = deps.todos.value.find((t) => t.id === parentId)
    if (!parent) return

    const siblings = deps.todos.value.filter((t) => t.parentId === parentId && !t.deletedAt)
    const allCompleted = siblings.length > 0 && siblings.every((s) => s.completed)

    if (parent.completed !== allCompleted) {
      parent.completed = allCompleted
      if (allCompleted) {
        parent.completedAt = new Date()
      } else {
        delete parent.completedAt
      }
      parent.updatedAt = new Date()
      parent.syncStatus = 'pending'
      if (parent.parentId) {
        updateParentStatus(parent.parentId)
      }
    }
  }

  async function toggleTodo(id: string): Promise<void> {
    const todo = deps.todos.value.find((t) => t.id === id)
    if (!todo) return

    todo.completed = !todo.completed
    if (todo.completed) {
      todo.completedAt = new Date()
    } else {
      delete todo.completedAt
    }
    todo.updatedAt = new Date()
    todo.syncStatus = 'pending'

    const toggleChildren = (parentId: string, completed: boolean) => {
      const children = deps.todos.value.filter((t) => t.parentId === parentId)
      children.forEach((child) => {
        child.completed = completed
        if (completed) {
          child.completedAt = new Date()
        } else {
          delete child.completedAt
        }
        child.updatedAt = new Date()
        child.syncStatus = 'pending'
        toggleChildren(child.id, completed)
      })
    }

    toggleChildren(id, todo.completed)

    if (todo.parentId) {
      updateParentStatus(todo.parentId)
    }

    deps.debouncedSync()
  }

  async function togglePin(id: string): Promise<void> {
    const todo = deps.todos.value.find((t) => t.id === id)
    if (todo) {
      todo.isPinned = !todo.isPinned
      todo.updatedAt = new Date()
      todo.syncStatus = 'pending'
      deps.debouncedSync()
    }
  }

  function incrementPomodoro(id: string): void {
    const todo = deps.todos.value.find((t) => t.id === id)
    if (todo) {
      todo.pomodoroCount = (todo.pomodoroCount || 0) + 1
      todo.updatedAt = new Date()
      todo.syncStatus = 'pending'
      deps.debouncedSync()
    }
  }

  async function breakdownTaskWithAI(id: string): Promise<void> {
    const todo = deps.todos.value.find((t) => t.id === id)
    if (!todo) return

    deps.loading.value = true
    try {
      const prompt = `请将以下待办任务拆解为 3-5 个具体的子任务。只需返回子任务标题列表，每行一个。任务名称：${todo.title}`
      const response = await getAIStaticResponse([{ role: 'user', content: prompt }])

      const subtasks = response.content
        .split('\n')
        .map((s) => s.replace(/^\d+\.\s*|[-*]\s*/, '').trim())
        .filter((s) => s.length > 0)

      for (const subtask of subtasks) {
        await addTodo(subtask, id)
      }

      todo.expanded = true
    } catch (err) {
      console.error('AI breakdown failed:', err)
      deps.error.value = 'AI breakdown failed'
    } finally {
      deps.loading.value = false
    }
  }

  async function deleteTodo(id: string): Promise<void> {
    const todo = deps.todos.value.find((t) => t.id === id)
    if (!todo) return

    const parentId = todo.parentId

    const children = deps.todos.value.filter((t) => t.parentId === id)
    for (const child of children) {
      await deleteTodo(child.id)
    }

    todo.deletedAt = new Date()
    todo.updatedAt = new Date()
    todo.syncStatus = 'pending'

    if (parentId) {
      updateParentStatus(parentId)
    }

    deps.debouncedSync()
  }

  async function restoreTodo(id: string): Promise<void> {
    const todo = deps.todos.value.find((t) => t.id === id)
    if (!todo) return

    todo.deletedAt = undefined
    todo.updatedAt = new Date()
    todo.syncStatus = 'pending'

    if (todo.parentId) {
      const parent = deps.todos.value.find((t) => t.id === todo.parentId)
      if (parent && parent.deletedAt) {
        await restoreTodo(parent.id)
      }
    }

    deps.debouncedSync()
  }

  async function updateTodo(id: string, title: string): Promise<boolean> {
    const trimmedTitle = title.trim()
    if (!trimmedTitle) return false

    const todo = deps.todos.value.find((t) => t.id === id)
    if (!todo || todo.title === trimmedTitle) return !!todo

    if (isDuplicate(trimmedTitle, todo.parentId ?? null, id)) {
      deps.error.value = 'todo.duplicate'
      return false
    }

    todo.title = trimmedTitle
    todo.updatedAt = new Date()
    todo.syncStatus = 'pending'
    deps.debouncedSync()
    return true
  }

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

  function toggleAllExpansion(): void {
    const targetState = !deps.isAllExpanded.value
    deps.filteredTodos.value.forEach((todo) => {
      todo.expanded = targetState
    })
  }

  function toggleTodoExpansion(id: string): void {
    const todo = deps.todos.value.find((t) => t.id === id)
    if (todo) {
      todo.expanded = !(todo.expanded ?? true)
    }
  }

  function getTodoPath(todoId: string): string[] {
    const path: string[] = []
    let current = deps.todos.value.find((t) => t.id === todoId)
    while (current?.parentId) {
      const parent = deps.todos.value.find((t) => t.id === current!.parentId)
      if (parent) {
        path.unshift(parent.title)
        current = parent
      } else {
        break
      }
    }
    return path
  }

  return {
    isDuplicate,
    fetchTodos,
    addTodo,
    toggleTodo,
    togglePin,
    incrementPomodoro,
    breakdownTaskWithAI,
    restoreTodo,
    deleteTodo,
    updateTodo,
    reorderTodos,
    setDrawerOpen,
    setMaximized,
    toggleDrawer,
    setFilter,
    setSearchQuery,
    clearSearch,
    clearError,
    setSilencingToast,
    toggleAllExpansion,
    toggleTodoExpansion,
    getTodoPath,
  }
}
