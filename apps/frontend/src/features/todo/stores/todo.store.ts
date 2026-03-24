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
import { applyProposedTodoChanges, buildBasePreviewTodos } from './todo.proposed'
import { createProposedChangeStateManager } from './todo.proposed-state'
import { normalizeTodoDatesInPlace, snapshotTodos } from './todo.dates'
import { isSameTodoList } from './todo.snapshot'
import { createTodoSourceManager } from './todo.source'

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

    const normalizeAllTodos = () => {
      todos.value.forEach(normalizeTodoDatesInPlace)
    }

    const sourceManager = createTodoSourceManager({
      todos,
      todoSource,
      localTodos,
      remoteTodos,
      syncConflicts,
      isTrashLoaded,
      snapshotTodos,
      isSameTodoList,
    })

    watch(
      todos,
      () => {
        normalizeAllTodos()
        if (sourceManager.isApplyingSourceSnapshot()) return
        sourceManager.persistActiveSourceTodos()
      },
      { immediate: true, deep: true },
    )

    watch(
      [todoSource, localTodos, remoteTodos],
      () => {
        const targetTodos = todoSource.value === 'local' ? localTodos.value : remoteTodos.value
        sourceManager.applyTodosSnapshot(targetTodos)
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

    const basePreviewTodos = computed(() =>
      buildBasePreviewTodos(todos.value, proposedChanges.value),
    )

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
        recurrenceRule: todo.recurrenceRule || null,
        recurrenceTz: todo.recurrenceTz || null,
        recurrenceSpawnedAt: todo.recurrenceSpawnedAt || null,
        createdAt: todo.createdAt,
        updatedAt: todo.updatedAt,
        completedAt: todo.completedAt || null,
        deferredAt: todo.deferredAt || null,
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
      remoteTodos,
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
        sourceManager.applyTodoSource('remote')
      }

      if (syncOwnerId.value !== null && syncOwnerId.value !== userId) {
        remoteTodos.value = []
        todos.value = []
        syncOwnerId.value = null
        lastSyncAt.value = null
        syncConflicts.value = []
        resetSyncStatus()
      }

      await mergeOnLogin(userId)
    }

    async function switchTodoSource(source: TodoDataSource): Promise<void> {
      if (source === todoSource.value) return
      if (source === 'local') {
        sourceManager.applyTodoSource('local')
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
        sourceManager.applyTodoSource('local')
      }
      remoteTodos.value = []
      syncOwnerId.value = null
      lastSyncAt.value = null
      syncConflicts.value = []
      resetSyncStatus()
    }

    const proposedChangeStateManager = createProposedChangeStateManager({
      proposedChangeSets,
      proposedChangeSetOrder,
      activeProposedChangeSetId,
    })

    async function applyProposedChanges(setId?: string): Promise<void> {
      const targetId = setId ?? activeProposedChangeSetId.value ?? undefined
      if (!targetId) return

      const changes = proposedChangeSets.value[targetId] ?? []
      if (changes.length === 0) return

      await applyProposedTodoChanges(changes, todos.value, actions)

      proposedChangeStateManager.clearProposedChanges(targetId)
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
      addProposedChanges: proposedChangeStateManager.addProposedChanges,
      setProposedChanges: proposedChangeStateManager.setProposedChanges,
      setActiveProposedChangeSet: proposedChangeStateManager.setActiveProposedChangeSet,
      clearProposedChanges: proposedChangeStateManager.clearProposedChanges,
      applyProposedChanges,
      discardProposedChanges: proposedChangeStateManager.discardProposedChanges,
      initSocketListener,
    }
  },
  {
    persist: {
      key: 'todos',
      storage: localStorage,
      pick: [
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
