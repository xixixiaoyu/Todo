import type { ComputedRef, Ref } from 'vue'
import { getAIStaticResponse } from '@/features/ai/services'
import type { FilterType, Todo, ViewMode } from './todo.types'
import { toDate } from './todo.dates'
import { todoApi } from '../api'

export function createTodoActions(deps: {
  todos: Ref<Todo[]>
  filter: Ref<FilterType>
  viewMode: Ref<ViewMode>
  searchQuery: Ref<string>
  loading: Ref<boolean>
  isDragging: Ref<boolean>
  error: Ref<string | null>
  filteredTodos: ComputedRef<Todo[]>
  isAllExpanded: ComputedRef<boolean>
  debouncedSync: () => void
  sync: () => Promise<void>
  isDrawerOpen: Ref<boolean>
  isMaximized: Ref<boolean>
  isSilencingToast: Ref<boolean>
  isTrashLoaded: Ref<boolean>
}): {
  isDuplicate: (title: string, parentId?: string | null, excludeId?: string) => boolean
  fetchTodos: () => Promise<void>
  fetchTrash: () => Promise<void>
  addTodo: (title: string, parentId?: string | null, id?: string) => Promise<string | null>
  addTodos: (titles: string[], parentId?: string | null) => Promise<string[]>
  removeTodos: (ids: string[]) => Promise<void>
  toggleTodo: (id: string) => Promise<void>
  togglePin: (id: string) => Promise<void>
  incrementPomodoro: (id: string) => void
  breakdownTaskWithAI: (id: string) => Promise<string[]>
  restoreTodo: (id: string) => Promise<void>
  deleteTodo: (id: string) => Promise<void>
  updateTodo: (id: string, title?: string, parentId?: string | null) => Promise<boolean>
  updateTodoSchedule: (id: string, dueAt: Date | null, remindAt: Date | null) => boolean
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
  setDragging: (dragging: boolean) => void
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

  async function fetchTrash(): Promise<void> {
    if (deps.isTrashLoaded.value) return

    const { useAuthStore } = await import('@/features/auth/stores/auth')
    const authStore = useAuthStore()
    if (!authStore.isAuthenticated) return

    deps.loading.value = true
    try {
      const response = await todoApi.findTrash()
      if (response.success && Array.isArray(response.data)) {
        response.data.forEach((serverTodo) => {
          const index = deps.todos.value.findIndex((t) => t.id === serverTodo.id)
          const todoData: Todo = {
            id: serverTodo.id,
            title: serverTodo.title,
            completed: serverTodo.completed,
            order: serverTodo.order,
            isPinned: serverTodo.isPinned,
            parentId: serverTodo.parentId,
            version: serverTodo.version,
            pomodoroCount: serverTodo.pomodoroCount,
            dueAt: serverTodo.dueAt ? new Date(serverTodo.dueAt) : undefined,
            remindAt: serverTodo.remindAt ? new Date(serverTodo.remindAt) : undefined,
            remindedAt: serverTodo.remindedAt ? new Date(serverTodo.remindedAt) : undefined,
            createdAt: new Date(serverTodo.createdAt),
            updatedAt: new Date(serverTodo.updatedAt),
            completedAt: serverTodo.completedAt ? new Date(serverTodo.completedAt) : undefined,
            deletedAt: serverTodo.deletedAt ? new Date(serverTodo.deletedAt) : undefined,
            syncStatus: 'synced' as const,
          }

          if (index !== -1) {
            deps.todos.value[index] = { ...deps.todos.value[index], ...todoData }
          } else {
            deps.todos.value.push(todoData)
          }
        })
        deps.isTrashLoaded.value = true
      }
    } catch (err) {
      console.error('Failed to fetch trash:', err)
      deps.error.value = 'todo.syncFailed'
    } finally {
      deps.loading.value = false
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

  async function addTodos(titles: string[], parentId: string | null = null): Promise<string[]> {
    const addedIds: string[] = []

    if (parentId) {
      const parent = deps.todos.value.find((t) => t.id === parentId)
      if (parent?.completed) {
        deps.error.value = 'todo.parentCompleted'
        return []
      }
    }

    deps.loading.value = true
    try {
      let minOrder =
        deps.todos.value.length > 0 ? Math.min(...deps.todos.value.map((t) => t.order ?? 0)) : 0

      // 倒序处理以确保 unshift 后在 UI 上保持 AI 返回的原始顺序
      const reversedTitles = [...titles].reverse()

      for (const title of reversedTitles) {
        const trimmedTitle = title.trim()
        if (!trimmedTitle || isDuplicate(trimmedTitle, parentId)) continue

        const newTodo: Todo = {
          id: generateId(),
          title: trimmedTitle,
          completed: false,
          createdAt: new Date(),
          updatedAt: new Date(),
          isPinned: false,
          parentId,
          order: --minOrder,
          expanded: true,
          version: 0,
          syncStatus: 'pending',
          pomodoroCount: 0,
        }
        deps.todos.value.unshift(newTodo)
        addedIds.push(newTodo.id)
      }

      if (addedIds.length > 0) {
        deps.debouncedSync()
      }

      return addedIds
    } catch (err) {
      console.error('Failed to add todos:', err)
      deps.error.value = 'todo.addError'
      return []
    } finally {
      deps.loading.value = false
    }
  }

  async function removeTodos(ids: string[]): Promise<void> {
    if (ids.length === 0) return

    deps.loading.value = true
    try {
      for (const id of ids) {
        await deleteTodo(id)
      }
    } catch (err) {
      console.error('Failed to remove todos:', err)
      deps.error.value = 'todo.deleteError'
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

  async function breakdownTaskWithAI(id: string): Promise<string[]> {
    const todo = deps.todos.value.find((t) => t.id === id)
    if (!todo) return []

    const path = getTodoPath(id)
    const contextStr = path.length > 0 ? `[上下文路径：${path.join(' > ')}]` : ''

    deps.loading.value = true
    try {
      const prompt = `
# Role
你是一个奉行“奥卡姆剃刀”原则的资深工程效率专家。你不仅拆解任务，更是在通过任务结构重塑用户的执行思维。

# Task
请将以下任务拆解为 3-7 个可立即执行的“原子动作”。

# Rules
1. **SMART 原则**：每个子任务必须具体、可衡量、具备明确的行动动词（如：编写、调研、配置、部署）。
2. **拒绝冗余**：剔除“开始...”、“进行...”、“思考...”等模糊表述。
3. **逻辑完备**：确保这组原子动作能覆盖主任务的核心路径。
4. **上下文敏感**：结合任务所在的层级路径进行拆解。
5. **极简输出**：严格返回 JSON 数组格式，不要包含任何 Markdown 代码块标签或其他解释性文字。

# Target Task
${contextStr}
任务名称：${todo.title}

# Output Example
["编写数据库迁移脚本", "配置 Redis 缓存实例", "执行压力测试并记录瓶颈"]
`.trim()

      const response = await getAIStaticResponse([{ role: 'user', content: prompt }])

      let subtasks: string[] = []
      try {
        // 尝试解析 JSON
        const content = response.content.trim()
        // 移除可能存在的 Markdown 代码块标记
        const jsonStr = content.replace(/^```json\n?|```$/g, '').trim()
        subtasks = JSON.parse(jsonStr)
      } catch (e) {
        // 降级：如果 JSON 解析失败，尝试按行分割
        console.warn('AI breakdown JSON parse failed, falling back to line splitting', e)
        subtasks = response.content
          .split('\n')
          .map((s) => s.replace(/^\d+\.\s*|[-*]\s*/, '').trim())
          .filter((s) => s.length > 0 && s.length < 100)
      }

      if (subtasks.length > 0) {
        const addedIds = await addTodos(subtasks, id)
        todo.expanded = true
        return addedIds
      }

      return []
    } catch (err) {
      console.error('AI breakdown failed:', err)
      deps.error.value = 'AI breakdown failed'
      return []
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

  async function updateTodo(
    id: string,
    title?: string,
    parentId?: string | null,
  ): Promise<boolean> {
    const todo = deps.todos.value.find((t) => t.id === id)
    if (!todo) return false

    const trimmedTitle = title?.trim()
    if (trimmedTitle === '') {
      deps.error.value = 'todo.titleEmpty'
      return false
    }
    const targetTitle = trimmedTitle || todo.title
    const targetParentId = parentId !== undefined ? parentId : todo.parentId

    // 如果没有实质性变更且标题不为空，直接返回 true
    if (targetTitle === todo.title && targetParentId === todo.parentId) return true

    // 检查在目标层级下是否有同名任务
    if (isDuplicate(targetTitle, targetParentId, id)) {
      deps.error.value = 'todo.duplicate'
      return false
    }

    if (title !== undefined) {
      todo.title = targetTitle
    }
    if (parentId !== undefined) {
      todo.parentId = parentId
    }

    todo.updatedAt = new Date()
    todo.syncStatus = 'pending'
    deps.debouncedSync()
    return true
  }

  function updateTodoSchedule(id: string, dueAt: Date | null, remindAt: Date | null): boolean {
    const todo = deps.todos.value.find((t) => t.id === id)
    if (!todo) return false

    if (dueAt && Number.isNaN(dueAt.getTime())) return false
    if (remindAt && Number.isNaN(remindAt.getTime())) return false

    if (dueAt && remindAt && remindAt.getTime() > dueAt.getTime()) {
      deps.error.value = 'todo.remindAfterDue'
      return false
    }

    const prevRemindAt = toDate(todo.remindAt)?.getTime() ?? null
    const nextRemindAt = remindAt ? remindAt.getTime() : null

    todo.dueAt = dueAt || undefined
    todo.remindAt = remindAt || undefined

    if (prevRemindAt !== nextRemindAt) {
      todo.remindedAt = undefined
    }

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
    if (newFilter === 'trash') {
      void fetchTrash()
    }
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
    fetchTrash,
    addTodo,
    addTodos,
    removeTodos,
    toggleTodo,
    togglePin,
    incrementPomodoro,
    breakdownTaskWithAI,
    restoreTodo,
    deleteTodo,
    updateTodo,
    updateTodoSchedule,
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
    setDragging: (dragging: boolean) => (deps.isDragging.value = dragging),
  }
}
