import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'
import type { Todo as SharedTodo } from '@lumina/shared'
import type {
  ProposedTodoChange,
  FilterType,
  ViewMode,
  Todo,
  TodoSyncConflict,
  TodoDataSource,
} from './todo.types'
import { applyFilterAndSort, isEffectivelyCompleted } from './todo.filtering'
import { createTodoCloud } from './todo.cloud'
import { createTodoActions } from './todo.actions'
import { normalizeTodoDatesInPlace } from './todo.dates'

export const useTodoStore = defineStore(
  'todo',
  () => {
    const todos = ref<Todo[]>([])
    const filter = ref<FilterType>('pending')
    const viewMode = ref<ViewMode>('list')
    const searchQuery = ref('')
    const loading = ref(false)
    const isDragging = ref(false)
    const error = ref<string | null>(null)
    const isDrawerOpen = ref(false)
    const isMaximized = ref(false)
    const isSilencingToast = ref(false)
    const isTrashLoaded = ref(false)
    const proposedChangeSets = ref<Record<string, ProposedTodoChange[]>>({})
    const proposedChangeSetOrder = ref<string[]>([])
    const activeProposedChangeSetId = ref<string | null>(null)
    const lastSyncAt = ref<string | null>(null)
    const syncOwnerId = ref<number | null>(null)
    const syncConflicts = ref<TodoSyncConflict[]>([])
    const todoSource = ref<TodoDataSource>('local')
    const localTodos = ref<Todo[]>([])
    const remoteTodos = ref<Todo[]>([])

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

    const cloneTodo = (todo: Todo): Todo => ({
      ...todo,
      dueAt: todo.dueAt ? new Date(todo.dueAt) : undefined,
      remindAt: todo.remindAt ? new Date(todo.remindAt) : undefined,
      remindedAt: todo.remindedAt ? new Date(todo.remindedAt) : undefined,
      createdAt: new Date(todo.createdAt),
      updatedAt: new Date(todo.updatedAt),
      completedAt: todo.completedAt ? new Date(todo.completedAt) : undefined,
      deletedAt: todo.deletedAt ? new Date(todo.deletedAt) : undefined,
    })

    const snapshotTodos = (items: Todo[]): Todo[] => items.map(cloneTodo)

    const normalizeAllTodos = () => {
      todos.value.forEach(normalizeTodoDatesInPlace)
    }

    const persistActiveSourceTodos = () => {
      if (todoSource.value === 'local') {
        localTodos.value = snapshotTodos(todos.value)
        return
      }
      remoteTodos.value = snapshotTodos(todos.value)
    }

    const applyTodoSource = (source: TodoDataSource) => {
      if (source === todoSource.value) return
      persistActiveSourceTodos()
      todoSource.value = source
      const targetTodos = source === 'local' ? localTodos.value : remoteTodos.value
      todos.value = snapshotTodos(targetTodos)
      syncConflicts.value = []
      isTrashLoaded.value = false
      if (source === 'remote') {
        todos.value.forEach((item) => {
          if (!item.syncStatus) item.syncStatus = 'pending'
        })
      }
    }

    if (localTodos.value.length === 0 && remoteTodos.value.length === 0 && todos.value.length > 0) {
      localTodos.value = snapshotTodos(todos.value)
    }

    if (todoSource.value === 'remote') {
      if (remoteTodos.value.length === 0 && todos.value.length > 0) {
        remoteTodos.value = snapshotTodos(todos.value)
      }
      todos.value = snapshotTodos(remoteTodos.value)
    } else {
      todos.value = snapshotTodos(localTodos.value)
    }

    watch(
      todos,
      () => {
        normalizeAllTodos()
        persistActiveSourceTodos()
      },
      { immediate: true, deep: true },
    )

    watch(searchQuery, (newQuery) => {
      if (newQuery.trim()) {
        todos.value.forEach((todo) => {
          todo.expanded = true
        })
      }
    })

    watch(viewMode, (newMode) => {
      if (newMode === 'visual' && filter.value === 'trash') {
        filter.value = 'pending'
      }
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

    const basePreviewTodos = computed(() => {
      if (proposedChanges.value.length === 0) return [...todos.value]

      const result = todos.value.map((t) => ({ ...t }))

      for (const change of proposedChanges.value) {
        if (change.type === 'add') {
          result.push({
            id: change.id,
            title: change.data.title || '',
            completed: false,
            createdAt: new Date(),
            updatedAt: new Date(),
            isPinned: false,
            parentId: change.data.parentId,
            order: result.length,
            pomodoroCount: 0,
            isProposed: true,
            expanded: true,
            version: 0,
          })
        } else if (change.type === 'update') {
          const todo = result.find((t) => t.id === change.data.id)
          if (todo) {
            if (change.data.title) todo.title = change.data.title
            if (change.data.parentId !== undefined) todo.parentId = change.data.parentId
            todo.isProposed = true
          }
        } else if (change.type === 'delete') {
          const todo = result.find((t) => t.id === change.data.id)
          if (todo) {
            todo.isProposedDelete = true
          }
        } else if (change.type === 'toggle') {
          const todo = result.find((t) => t.id === change.data.id)
          if (todo) {
            todo.completed = !todo.completed
            if (todo.completed) {
              todo.completedAt = new Date()
            } else {
              delete todo.completedAt
            }
            todo.isProposed = true
          }
        } else if (change.type === 'pin') {
          const todo = result.find((t) => t.id === change.data.id)
          if (todo) {
            todo.isPinned = !todo.isPinned
            todo.isProposed = true
          }
        }
      }

      return result
    })

    const previewTodos = computed(() =>
      applyFilterAndSort(basePreviewTodos.value, filter.value, searchQuery.value),
    )

    const visualTodos = computed(() =>
      applyFilterAndSort(basePreviewTodos.value, filter.value, searchQuery.value, false),
    )
    const isRemoteSource = computed(() => todoSource.value === 'remote')

    function toSharedTodo(todo: Todo): SharedTodo {
      return {
        id: todo.id,
        title: todo.title,
        completed: todo.completed,
        order: todo.order,
        isPinned: !!todo.isPinned,
        parentId: todo.parentId || null,
        version: todo.version || 0,
        pomodoroCount: todo.pomodoroCount || 0,
        dueAt: todo.dueAt || null,
        remindAt: todo.remindAt || null,
        remindedAt: todo.remindedAt || null,
        createdAt: todo.createdAt,
        updatedAt: todo.updatedAt,
        completedAt: todo.completedAt || null,
        deletedAt: todo.deletedAt || null,
      }
    }

    const {
      sync,
      debouncedSync,
      mergeOnLogin,
      resetSyncStatus,
      acceptSyncConflict,
      retrySyncConflict,
      clearSyncConflicts,
      initSocketListener,
      deleteTodoPermanently,
      clearTrash,
    } = createTodoCloud({
      todos,
      loading,
      error,
      lastSyncAt,
      syncOwnerId,
      syncConflicts,
      toSharedTodo,
      isTrashLoaded,
      isRemoteSource,
    })

    const actions = createTodoActions({
      todos,
      filter,
      viewMode,
      searchQuery,
      loading,
      isDragging,
      error,
      filteredTodos,
      isAllExpanded,
      debouncedSync,
      sync,
      isDrawerOpen,
      isMaximized,
      isSilencingToast,
      isTrashLoaded,
      isRemoteSource,
    })

    async function mergeOnLoginWithRemote(userId: number): Promise<void> {
      if (todoSource.value !== 'remote') {
        applyTodoSource('remote')
      }
      await mergeOnLogin(userId)
    }

    async function switchTodoSource(source: TodoDataSource): Promise<void> {
      if (source === todoSource.value) return
      if (source === 'local') {
        applyTodoSource('local')
        return
      }

      const { useAuthStore } = await import('@/features/auth/stores/auth')
      const authStore = useAuthStore()
      authStore.hydrateFromStorage()

      if (!authStore.isAuthenticated || !authStore.user) {
        return
      }

      await mergeOnLoginWithRemote(authStore.user.id)
    }

    function clearRemoteOnLogout(): void {
      if (todoSource.value === 'remote') {
        applyTodoSource('local')
      }
      remoteTodos.value = []
      syncOwnerId.value = null
      lastSyncAt.value = null
      syncConflicts.value = []
      resetSyncStatus()
    }

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
        setActiveProposedChangeSet(
          proposedChangeSetOrder.value.length > 0
            ? proposedChangeSetOrder.value[proposedChangeSetOrder.value.length - 1]
            : null,
        )
      }
    }

    async function applyProposedChanges(setId?: string): Promise<void> {
      const targetId = setId ?? activeProposedChangeSetId.value ?? undefined
      if (!targetId) return

      const changes = proposedChangeSets.value[targetId] ?? []
      if (changes.length === 0) return

      const addActions = changes.filter((c) => c.type === 'add')
      const nonAddActions = changes.filter((c) => c.type !== 'add')

      const addById = new Map<string, ProposedTodoChange>()
      const addIds: string[] = []
      for (const a of addActions) {
        if (!a.id) continue
        addById.set(a.id, a)
        addIds.push(a.id)
      }

      const addIdSet = new Set(addIds)
      const incomingCount = new Map<string, number>()
      const outgoing = new Map<string, string[]>()

      for (const id of addIds) {
        incomingCount.set(id, 0)
        outgoing.set(id, [])
      }

      for (const id of addIds) {
        const action = addById.get(id)
        const parentId = action?.data.parentId
        if (parentId && addIdSet.has(parentId)) {
          outgoing.get(parentId)!.push(id)
          incomingCount.set(id, (incomingCount.get(id) ?? 0) + 1)
        }
      }

      const queue: string[] = addIds.filter((id) => (incomingCount.get(id) ?? 0) === 0)
      const orderedAddIds: string[] = []
      const queued = new Set(queue)

      while (queue.length > 0) {
        const id = queue.shift()!
        orderedAddIds.push(id)
        const outs = outgoing.get(id) ?? []
        for (const next of outs) {
          incomingCount.set(next, (incomingCount.get(next) ?? 0) - 1)
          if ((incomingCount.get(next) ?? 0) === 0 && !queued.has(next)) {
            queue.push(next)
            queued.add(next)
          }
        }
      }

      if (orderedAddIds.length < addIds.length) {
        for (const id of addIds) {
          if (!orderedAddIds.includes(id)) orderedAddIds.push(id)
        }
      }

      const idMap = new Map<string, string>()
      const existingTodoIds = new Set(todos.value.map((t) => t.id))

      for (const id of orderedAddIds) {
        const change = addById.get(id)
        if (!change) continue
        const rawTitle = change.data.title
        const title = typeof rawTitle === 'string' ? rawTitle.trim() : ''
        if (!title) continue

        const parentIdRaw = change.data.parentId
        const parentId =
          typeof parentIdRaw === 'string' && parentIdRaw
            ? (idMap.get(parentIdRaw) ?? (existingTodoIds.has(parentIdRaw) ? parentIdRaw : null))
            : null

        const newId = await actions.addTodo(title, parentId ?? null)
        if (newId) {
          idMap.set(id, newId)
          existingTodoIds.add(newId)
        }
      }

      for (const change of nonAddActions) {
        const rawId = change.data.id
        const targetTodoId = typeof rawId === 'string' && rawId ? (idMap.get(rawId) ?? rawId) : null

        switch (change.type) {
          case 'update': {
            const rawTitle = change.data.title
            const title = typeof rawTitle === 'string' ? rawTitle.trim() : undefined
            const rawParentId = change.data.parentId
            const parentId =
              rawParentId === null
                ? null
                : typeof rawParentId === 'string'
                  ? (idMap.get(rawParentId) ?? rawParentId)
                  : undefined

            if (targetTodoId) {
              await actions.updateTodo(targetTodoId, title, parentId)
            }
            break
          }
          case 'delete':
            if (targetTodoId) await actions.deleteTodo(targetTodoId)
            break
          case 'toggle':
            if (targetTodoId) await actions.toggleTodo(targetTodoId)
            break
          case 'pin':
            if (targetTodoId) await actions.togglePin(targetTodoId)
            break
        }
      }

      clearProposedChanges(targetId)
    }

    function discardProposedChanges(setId?: string): void {
      const targetId = setId ?? activeProposedChangeSetId.value ?? undefined
      if (!targetId) return
      clearProposedChanges(targetId)
    }

    return {
      todos,
      filter,
      viewMode,
      searchQuery,
      loading,
      isDragging,
      error,
      isDrawerOpen,
      isMaximized,
      isSilencingToast,
      isTrashLoaded,
      isAllExpanded,
      proposedChanges,
      activeProposedChangeSetId,
      lastSyncAt,
      syncOwnerId,
      syncConflicts,
      todoSource,
      localTodos,
      remoteTodos,
      isRemoteSource,
      filteredTodos,
      pendingCount,
      completedCount,
      hasProposedChanges,
      previewTodos,
      visualTodos,
      switchTodoSource,
      ...actions,
      deleteTodoPermanently,
      clearTrash,
      sync,
      mergeOnLogin: mergeOnLoginWithRemote,
      clearRemoteOnLogout,
      resetSyncStatus,
      acceptSyncConflict,
      retrySyncConflict,
      clearSyncConflicts,
      addProposedChanges,
      setProposedChanges,
      setActiveProposedChangeSet,
      clearProposedChanges,
      applyProposedChanges,
      discardProposedChanges,
      initSocketListener,
    }
  },
  {
    persist: {
      key: 'todos',
      storage: localStorage,
      pick: [
        'todos',
        'todoSource',
        'localTodos',
        'remoteTodos',
        'filter',
        'viewMode',
        'lastSyncAt',
        'syncOwnerId',
        'isDrawerOpen',
        'isMaximized',
      ],
    },
  },
)
