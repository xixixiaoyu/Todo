import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'
import type { ProposedTodoChange, FilterType, ViewMode, Todo } from './todo.types'
import { applyFilterAndSort, isEffectivelyCompleted } from './todo.filtering'
import { createTodoActions } from './todo.actions'
import { applyProposedTodoChanges, buildBasePreviewTodos } from './todo.proposed'

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

    // -- 创建 actions --
    const actions = createTodoActions({
      todos,
      filter,
      viewMode,
      searchQuery,
      todoExpansionState,
      deferredSectionExpandedPreference,
      loading,
      isDragging,
      error,
      filteredTodos,
      isAllExpanded,
      isDrawerOpen,
      isMaximized,
      isSilencingToast,
    })

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

      await applyProposedTodoChanges(changes, todos.value, actions)

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
      // actions
      ...actions,
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
