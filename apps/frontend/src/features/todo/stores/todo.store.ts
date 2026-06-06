import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'
import type { ProposedTodoChange, FilterType, ViewMode, Todo } from './todo.types'
import { applyFilterAndSort, isEffectivelyCompleted } from './todo.filtering'
import { applyProposedTodoChanges, buildBasePreviewTodos } from './todo.proposed'
import { toDate } from '@lumina/shared'

function generateTodoId(): string {
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
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (char) => {
    const r = (Math.random() * 16) | 0
    const v = char === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

function isDuplicateTodo(
  todos: Todo[],
  title: string,
  parentId: string | null = null,
  excludeId?: string,
): boolean {
  const trimmedTitle = title.trim().toLowerCase()
  return todos.some(
    (todo) =>
      todo.id !== excludeId &&
      (todo.parentId ?? null) === parentId &&
      !todo.completed &&
      !todo.deletedAt &&
      todo.title.toLowerCase() === trimmedTitle,
  )
}

/** 标题最大字符数，与 @lumina/shared TodoSchema.title 保持一致 */
const MAX_TITLE_LENGTH = 1000

export const useTodoStore = defineStore(
  'todo',
  () => {
    // -- 状态 --
    const todos = ref<Todo[]>([])
    const filter = ref<FilterType>('pending')
    const viewMode = ref<ViewMode>('list')
    const searchQuery = ref('')
    const todoExpansionState = ref<Record<string, boolean>>({})
    const deferredSectionExpandedPreference = ref<boolean | null>(null)
    const loading = ref(false)
    const isDragging = ref(false)
    const error = ref<string | null>(null)
    const isDrawerOpen = ref(false)
    const isMaximized = ref(false)
    const isSilencingToast = ref(false)
    const proposedChangeSets = ref<Record<string, ProposedTodoChange[]>>({})
    const proposedChangeSetOrder = ref<string[]>([])
    const activeProposedChangeSetId = ref<string | null>(null)

    // -- 计算属性 --
    const filteredTodos = computed(() =>
      applyFilterAndSort(todos.value, filter.value, searchQuery.value),
    )

    const isAllExpanded = computed(() => {
      const currentParentTodos = filteredTodos.value.filter((t) =>
        todos.value.some((child) => (child.parentId ?? null) === t.id),
      )

      if (currentParentTodos.length === 0) return false
      return currentParentTodos.some((t) => (t.expanded ?? true) !== false)
    })

    const pendingCount = computed(
      () =>
        todos.value.filter((todo) => !isEffectivelyCompleted(todo, todos.value) && !todo.deletedAt)
          .length,
    )

    const completedCount = computed(
      () =>
        todos.value.filter((todo) => isEffectivelyCompleted(todo, todos.value) && !todo.deletedAt)
          .length,
    )

    const proposedChanges = computed<ProposedTodoChange[]>(() => {
      const activeId = activeProposedChangeSetId.value
      if (!activeId) return []
      return proposedChangeSets.value[activeId] ?? []
    })

    const hasProposedChanges = computed(() => proposedChanges.value.length > 0)

    const basePreviewTodos = computed(() =>
      buildBasePreviewTodos(todos.value, proposedChanges.value),
    )

    const previewTodos = computed(() =>
      applyFilterAndSort(basePreviewTodos.value, filter.value, searchQuery.value),
    )

    const visualTodos = computed(() =>
      applyFilterAndSort(basePreviewTodos.value, filter.value, searchQuery.value, false),
    )

    // -- 辅助函数 --
    const applyPersistedExpansionState = () => {
      let changed = false
      todos.value.forEach((todo) => {
        const persistedExpanded = todoExpansionState.value[todo.id]
        if (persistedExpanded !== undefined && todo.expanded !== persistedExpanded) {
          todo.expanded = persistedExpanded
          changed = true
        } else if (todo.expanded !== undefined && persistedExpanded === undefined) {
          todoExpansionState.value[todo.id] = todo.expanded
        }
      })
      return changed
    }

    // -- 监听：同步展开状态 --
    watch(
      todos,
      () => {
        // 1. 从持久化记录同步到 todos
        applyPersistedExpansionState()

        // 2. 从 todos 同步回持久化记录
        const nextExpansionState = { ...todoExpansionState.value }
        let expansionChanged = false
        todos.value.forEach((todo) => {
          if (todo.expanded !== undefined && nextExpansionState[todo.id] !== todo.expanded) {
            nextExpansionState[todo.id] = todo.expanded
            expansionChanged = true
          }
        })
        if (expansionChanged) {
          todoExpansionState.value = nextExpansionState
        }
      },
      { immediate: true, deep: true },
    )

    watch(
      todoExpansionState,
      () => {
        applyPersistedExpansionState()
      },
      { immediate: true, deep: true },
    )

    watch(searchQuery, (newQuery) => {
      if (newQuery.trim()) {
        const nextExpansionState = { ...todoExpansionState.value }
        todos.value.forEach((todo) => {
          todo.expanded = true
          nextExpansionState[todo.id] = true
        })
        todoExpansionState.value = nextExpansionState
      }
    })

    watch(viewMode, (newMode) => {
      if (newMode === 'visual' && filter.value === 'trash') {
        filter.value = 'pending'
      }
    })

    // -- 内部辅助函数 --
    function updateParentStatus(parentId: string): void {
      const parent = todos.value.find((todo) => todo.id === parentId)
      if (!parent) return

      const siblings = todos.value.filter((todo) => todo.parentId === parentId && !todo.deletedAt)
      const allCompleted = siblings.length > 0 && siblings.every((sibling) => sibling.completed)

      if (parent.completed !== allCompleted) {
        parent.completed = allCompleted
        if (allCompleted) {
          parent.completedAt = new Date()
        } else {
          delete parent.completedAt
        }
        parent.updatedAt = new Date()
        if (parent.parentId) {
          updateParentStatus(parent.parentId)
        }
      }
    }

    // -- Mutation 函数 --
    function isDuplicate(
      title: string,
      parentId: string | null = null,
      excludeId?: string,
    ): boolean {
      return isDuplicateTodo(todos.value, title, parentId, excludeId)
    }

    function reorderTodos(orderedIds: string[], parentId: string | null = null): void {
      for (const id of orderedIds) {
        const todo = todos.value.find((item) => item.id === id)
        if (todo && (todo.parentId ?? null) !== parentId) {
          if (isDuplicate(todo.title, parentId, id)) {
            error.value = 'todo.duplicate'
            return
          }
        }
      }

      orderedIds.forEach((id, index) => {
        const todo = todos.value.find((item) => item.id === id)
        if (todo) {
          const hasChanged =
            todo.order !== index || (parentId !== undefined && todo.parentId !== parentId)
          if (hasChanged) {
            todo.order = index
            if (parentId !== undefined) {
              todo.parentId = parentId
            }

            // If a todo becomes a subtask, it must not be deferred
            if (todo.parentId && todo.deferredAt) {
              todo.deferredAt = undefined
            }

            todo.updatedAt = new Date()
          }
        }
      })
    }

    async function addTodo(
      title: string,
      parentId: string | null = null,
      id?: string,
    ): Promise<string | null> {
      const trimmedTitle = title.trim()
      if (!trimmedTitle) return null

      // 防御性截断：确保标题不超过后端 schema 的 1000 字符限制
      const safeTitle = trimmedTitle.slice(0, MAX_TITLE_LENGTH)

      if (isDuplicate(safeTitle, parentId)) {
        error.value = 'todo.duplicate'
        return null
      }

      if (parentId) {
        const parent = todos.value.find((todo) => todo.id === parentId)
        if (parent?.completed) {
          error.value = 'todo.parentCompleted'
          return null
        }
      }

      loading.value = true
      try {
        const minOrder =
          todos.value.length > 0 ? Math.min(...todos.value.map((todo) => todo.order ?? 0)) : 0

        const newTodo: Todo = {
          id: id || generateTodoId(),
          title: safeTitle,
          completed: false,
          createdAt: new Date(),
          updatedAt: new Date(),
          isPinned: false,
          parentId,
          order: minOrder - 1,
          expanded: true,
          version: 0,
          pomodoroCount: 0,
        }
        todos.value.unshift(newTodo)

        return newTodo.id
      } catch (err) {
        console.error('Failed to add todo:', err)
        error.value = 'todo.addError'
        return null
      } finally {
        loading.value = false
      }
    }

    async function addTodos(titles: string[], parentId: string | null = null): Promise<string[]> {
      const addedIds: string[] = []

      if (parentId) {
        const parent = todos.value.find((todo) => todo.id === parentId)
        if (parent?.completed) {
          error.value = 'todo.parentCompleted'
          return []
        }
      }

      loading.value = true
      try {
        let minOrder =
          todos.value.length > 0 ? Math.min(...todos.value.map((todo) => todo.order ?? 0)) : 0

        const reversedTitles = [...titles].reverse()

        for (const title of reversedTitles) {
          const trimmedTitle = title.trim()
          if (!trimmedTitle || isDuplicate(trimmedTitle, parentId)) continue

          // 防御性截断
          const safeTitle = trimmedTitle.slice(0, MAX_TITLE_LENGTH)

          const newTodo: Todo = {
            id: generateTodoId(),
            title: safeTitle,
            completed: false,
            createdAt: new Date(),
            updatedAt: new Date(),
            isPinned: false,
            parentId,
            order: --minOrder,
            expanded: true,
            version: 0,
            pomodoroCount: 0,
          }
          todos.value.unshift(newTodo)
          addedIds.push(newTodo.id)
        }

        return addedIds
      } catch (err) {
        console.error('Failed to add todos:', err)
        error.value = 'todo.addError'
        return []
      } finally {
        loading.value = false
      }
    }

    async function removeTodos(ids: string[]): Promise<void> {
      if (ids.length === 0) return

      loading.value = true
      try {
        for (const id of ids) {
          await deleteTodo(id)
        }
      } catch (err) {
        console.error('Failed to remove todos:', err)
        error.value = 'todo.deleteError'
      } finally {
        loading.value = false
      }
    }

    async function toggleTodo(id: string): Promise<void> {
      const todo = todos.value.find((item) => item.id === id)
      if (!todo) return

      const toggledAt = new Date()
      todo.completed = !todo.completed
      if (todo.completed) {
        todo.completedAt = toggledAt
        todo.deferredAt = undefined
      } else {
        delete todo.completedAt
      }
      todo.updatedAt = toggledAt

      const toggleChildren = (parentId: string, completed: boolean) => {
        const children = todos.value.filter((item) => item.parentId === parentId)
        children.forEach((child) => {
          child.completed = completed
          if (completed) {
            child.completedAt = toggledAt
            child.deferredAt = undefined
          } else {
            delete child.completedAt
          }
          child.updatedAt = toggledAt
          toggleChildren(child.id, completed)
        })
      }

      toggleChildren(id, todo.completed)

      if (todo.parentId) {
        updateParentStatus(todo.parentId)
      }
    }

    async function togglePin(id: string): Promise<void> {
      const todo = todos.value.find((item) => item.id === id)
      if (todo) {
        todo.isPinned = !todo.isPinned
        todo.updatedAt = new Date()
      }
    }

    async function setTodoDeferred(id: string, deferred: boolean): Promise<boolean> {
      const todo = todos.value.find((item) => item.id === id)
      if (!todo || todo.completed || todo.deletedAt) return false

      if (deferred === !!todo.deferredAt) {
        return true
      }

      if (deferred) {
        todo.deferredAt = new Date()
        // If a subtask is deferred, it becomes a root task
        if (todo.parentId) {
          const oldParentId = todo.parentId
          todo.parentId = null
          updateParentStatus(oldParentId)
        }
      } else {
        todo.deferredAt = undefined
      }

      todo.updatedAt = new Date()
      return true
    }

    function incrementPomodoro(id: string): void {
      const todo = todos.value.find((item) => item.id === id)
      if (todo) {
        todo.pomodoroCount = (todo.pomodoroCount || 0) + 1
        todo.updatedAt = new Date()
      }
    }

    async function deleteTodo(id: string): Promise<void> {
      const todo = todos.value.find((item) => item.id === id)
      if (!todo) return

      const parentId = todo.parentId

      const children = todos.value.filter((item) => item.parentId === id)
      for (const child of children) {
        await deleteTodo(child.id)
      }

      todo.deletedAt = new Date()
      todo.updatedAt = new Date()

      if (parentId) {
        updateParentStatus(parentId)
      }
    }

    async function restoreTodo(id: string): Promise<void> {
      const todo = todos.value.find((item) => item.id === id)
      if (!todo) return

      todo.deletedAt = undefined
      todo.updatedAt = new Date()

      if (todo.parentId) {
        const parent = todos.value.find((item) => item.id === todo.parentId)
        if (parent && parent.deletedAt) {
          await restoreTodo(parent.id)
        }
      }
    }

    async function updateTodo(
      id: string,
      title?: string,
      parentId?: string | null,
    ): Promise<boolean> {
      const todo = todos.value.find((item) => item.id === id)
      if (!todo) return false

      const trimmedTitle = title?.trim()
      if (trimmedTitle === '') {
        error.value = 'todo.titleEmpty'
        return false
      }
      // 防御性截断：确保标题不超过后端 schema 的 1000 字符限制
      const targetTitle = (trimmedTitle || todo.title).slice(0, MAX_TITLE_LENGTH)
      const targetParentId = parentId !== undefined ? parentId : todo.parentId

      if (targetTitle === todo.title && targetParentId === todo.parentId) return true

      if (isDuplicate(targetTitle, targetParentId, id)) {
        error.value = 'todo.duplicate'
        return false
      }

      if (title !== undefined) {
        todo.title = targetTitle
      }
      if (parentId !== undefined) {
        todo.parentId = parentId
        if (parentId && todo.deferredAt) {
          todo.deferredAt = undefined
        }
      }

      todo.updatedAt = new Date()
      return true
    }

    function updateTodoSchedule(
      id: string,
      dueAt: Date | null,
      remindAt: Date | null,
      recurrenceRule: Todo['recurrenceRule'] | null = undefined,
    ): boolean {
      const todo = todos.value.find((item) => item.id === id)
      if (!todo) return false

      if (dueAt && Number.isNaN(dueAt.getTime())) return false
      if (remindAt && Number.isNaN(remindAt.getTime())) return false

      if (dueAt && remindAt && remindAt.getTime() > dueAt.getTime()) {
        error.value = 'todo.remindAfterDue'
        return false
      }

      if (recurrenceRule && !dueAt) {
        error.value = 'todo.recurrenceNeedsDue'
        return false
      }

      const nextDueAt = dueAt ? new Date(dueAt) : null
      const nextReminderAt = remindAt ? new Date(remindAt) : null
      const prevRemindAt = toDate(todo.remindAt)?.getTime() ?? null
      const nextRemindAt = nextReminderAt ? nextReminderAt.getTime() : null

      todo.dueAt = nextDueAt || undefined
      todo.remindAt = nextReminderAt || undefined
      if (recurrenceRule !== undefined) {
        todo.recurrenceRule = recurrenceRule || null
        if (todo.recurrenceRule) {
          todo.recurrenceTz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
        } else {
          todo.recurrenceTz = null
        }
      } else if (todo.recurrenceRule && !dueAt) {
        todo.recurrenceRule = null
        todo.recurrenceTz = null
      }

      if (prevRemindAt !== nextRemindAt) {
        todo.remindedAt = undefined
      }

      todo.updatedAt = new Date()
      return true
    }

    // -- UI 函数 --
    function setDrawerOpen(open: boolean): void {
      isDrawerOpen.value = open
    }

    function setMaximized(maximized: boolean): void {
      isMaximized.value = maximized
    }

    function toggleDrawer(): void {
      isDrawerOpen.value = !isDrawerOpen.value
    }

    function setFilter(newFilter: FilterType): void {
      filter.value = newFilter
    }

    function setSearchQuery(query: string): void {
      searchQuery.value = query
    }

    function clearSearch(): void {
      searchQuery.value = ''
    }

    function clearError(): void {
      error.value = null
    }

    function setSilencingToast(silence: boolean): void {
      isSilencingToast.value = silence
    }

    function setDeferredSectionExpandedPreference(expanded: boolean | null): void {
      deferredSectionExpandedPreference.value = expanded
    }

    function toggleAllExpansion(): void {
      const targetState = !isAllExpanded.value
      const nextExpansionState = { ...todoExpansionState.value }
      filteredTodos.value.forEach((todo) => {
        todo.expanded = targetState
        nextExpansionState[todo.id] = targetState
      })
      todoExpansionState.value = nextExpansionState
    }

    function toggleTodoExpansion(id: string): void {
      const todo = todos.value.find((item) => item.id === id)
      if (todo) {
        const nextState = !(todo.expanded ?? true)
        todo.expanded = nextState
        todoExpansionState.value = {
          ...todoExpansionState.value,
          [id]: nextState,
        }
      }
    }

    function getTodoPath(todoId: string): string[] {
      const path: string[] = []
      let current = todos.value.find((todo) => todo.id === todoId)
      while (current?.parentId) {
        const parent = todos.value.find((todo) => todo.id === current!.parentId)
        if (parent) {
          path.unshift(parent.title)
          current = parent
        } else {
          break
        }
      }
      return path
    }

    function setDragging(dragging: boolean): void {
      isDragging.value = dragging
    }

    // -- 建议变更管理 --
    function setActiveProposedChangeSet(setId: string | null): void {
      activeProposedChangeSetId.value = setId
    }

    function setProposedChanges(setId: string, changes: ProposedTodoChange[]): void {
      proposedChangeSets.value = {
        ...proposedChangeSets.value,
        [setId]: [...changes],
      }
      proposedChangeSetOrder.value = [
        ...proposedChangeSetOrder.value.filter((id) => id !== setId),
        setId,
      ]
      setActiveProposedChangeSet(setId)
    }

    function addProposedChanges(setId: string, changes: ProposedTodoChange[]): void {
      const prev = proposedChangeSets.value[setId] ?? []
      setProposedChanges(setId, [...prev, ...changes])
    }

    function clearProposedChanges(setId?: string): void {
      if (!setId) {
        proposedChangeSets.value = {}
        proposedChangeSetOrder.value = []
        setActiveProposedChangeSet(null)
        return
      }
      const rest = { ...proposedChangeSets.value }
      delete rest[setId]
      proposedChangeSets.value = rest
      proposedChangeSetOrder.value = proposedChangeSetOrder.value.filter((id) => id !== setId)
      if (activeProposedChangeSetId.value === setId) {
        const nextActiveId =
          proposedChangeSetOrder.value.length > 0
            ? proposedChangeSetOrder.value[proposedChangeSetOrder.value.length - 1]
            : null
        setActiveProposedChangeSet(nextActiveId)
      }
    }

    function discardProposedChanges(setId?: string): void {
      const targetId = setId ?? activeProposedChangeSetId.value ?? undefined
      if (!targetId) return
      clearProposedChanges(targetId)
    }

    async function applyProposedChanges(
      setId?: string,
      selectedActionIds?: Set<string>,
    ): Promise<void> {
      const targetId = setId ?? activeProposedChangeSetId.value ?? undefined
      if (!targetId) return

      let changes = proposedChangeSets.value[targetId] ?? []
      if (changes.length === 0) return

      if (selectedActionIds) {
        changes = changes.filter((c) => selectedActionIds.has(c.id))
        if (changes.length === 0) return
      }

      await applyProposedTodoChanges(changes, todos.value, {
        addTodo,
        updateTodo,
        deleteTodo,
        toggleTodo,
        togglePin,
      })

      clearProposedChanges(targetId)
    }

    return {
      // 状态
      todos,
      filter,
      viewMode,
      searchQuery,
      todoExpansionState,
      deferredSectionExpandedPreference,
      loading,
      isDragging,
      error,
      isDrawerOpen,
      isMaximized,
      isSilencingToast,
      isAllExpanded,
      proposedChanges,
      activeProposedChangeSetId,
      // 计算属性
      filteredTodos,
      pendingCount,
      completedCount,
      hasProposedChanges,
      previewTodos,
      visualTodos,
      // mutation
      isDuplicate,
      addTodo,
      addTodos,
      removeTodos,
      toggleTodo,
      togglePin,
      setTodoDeferred,
      incrementPomodoro,
      restoreTodo,
      deleteTodo,
      updateTodo,
      updateTodoSchedule,
      reorderTodos,
      // ui
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
      getTodoPath,
      setDragging,
      // 建议变更
      addProposedChanges,
      setProposedChanges,
      setActiveProposedChangeSet,
      clearProposedChanges,
      applyProposedChanges,
      discardProposedChanges,
    }
  },
  {
    persist: {
      key: 'todos',
      storage: localStorage,
      pick: [
        'todos',
        'filter',
        'viewMode',
        'todoExpansionState',
        'deferredSectionExpandedPreference',
        'isDrawerOpen',
        'isMaximized',
      ],
    },
  },
)
