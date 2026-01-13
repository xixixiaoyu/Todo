import { ref, computed, watch } from 'vue'
import { useTodoStore } from '../stores/todo'
import { useToast } from '@/composables/useToast'
import { useI18n } from 'vue-i18n'
import { useDebounceFn } from '@vueuse/core'

export function useTodo() {
  const todoStore = useTodoStore()
  const { error: showToastError } = useToast()
  const { t } = useI18n()

  const newTodoTitle = ref('')
  const showSearch = ref(false)
  const searchInput = ref('')
  const showFireworks = ref(false)

  // 监听搜索输入，使用防抖更新 store
  const debouncedSearch = useDebounceFn((value: string) => {
    todoStore.setSearchQuery(value)
  }, 300)

  watch(searchInput, (newValue) => {
    void debouncedSearch(newValue)
  })

  // 监听全局错误，用于处理拖拽等非直接交互产生的错误
  watch(
    () => todoStore.error,
    (newError) => {
      if (newError && !todoStore.isSilencingToast) {
        // 如果不是在执行直接操作（添加或编辑），则弹出 toast
        const message = newError.includes('.') ? t(newError) : newError
        showToastError(message)
        // 弹出后清除错误，避免重复触发
        setTimeout(() => {
          todoStore.clearError()
        }, 3000)
      }
    },
  )

  // 使用 store 中的状态
  const isDrawerOpen = computed({
    get: () => todoStore.isDrawerOpen,
    set: (value) => todoStore.setDrawerOpen(value),
  })

  const editingId = ref<string | null>(null)
  const editingTitle = ref('')
  const showTooltip = ref(false)

  async function handleAddTodo() {
    if (!newTodoTitle.value.trim()) return

    todoStore.setSilencingToast(true)
    todoStore.clearError()
    const success = await todoStore.addTodo(newTodoTitle.value)
    if (success) {
      newTodoTitle.value = ''
      todoStore.setSilencingToast(false)
    } else {
      showTooltip.value = true
      setTimeout(() => {
        showTooltip.value = false
        todoStore.setSilencingToast(false)
      }, 2000)
    }
  }

  async function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter') {
      await handleAddTodo()
    }
  }

  function toggleSearch() {
    showSearch.value = !showSearch.value
    if (!showSearch.value) {
      searchInput.value = ''
      todoStore.clearSearch()
    }
  }

  function clearSearch() {
    searchInput.value = ''
    todoStore.clearSearch()
  }

  async function handleToggleTodo(id: string, currentCompleted: boolean) {
    if (!currentCompleted) {
      showFireworks.value = true
    }
    await todoStore.toggleTodo(id)
  }

  function startEditing(id: string, title: string) {
    editingId.value = id
    editingTitle.value = title
  }

  function cancelEditing() {
    editingId.value = null
    editingTitle.value = ''
  }

  async function saveEditing() {
    if (editingId.value && editingTitle.value.trim()) {
      todoStore.setSilencingToast(true)
      todoStore.clearError()
      const success = await todoStore.updateTodo(editingId.value, editingTitle.value)
      if (!success && todoStore.error === 'todo.duplicate') {
        // 如果是重复项，可以保持编辑状态并显示错误（如果有 UI 支持的话）
        // 目前简单的处理是继续保持编辑状态
        setTimeout(() => {
          todoStore.setSilencingToast(false)
        }, 2000)
        return
      }
    }
    cancelEditing()
    todoStore.setSilencingToast(false)
  }

  async function handleEditKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter') {
      await saveEditing()
    } else if (e.key === 'Escape') {
      cancelEditing()
    }
  }

  return {
    // 状态
    newTodoTitle,
    showSearch,
    searchInput,
    showFireworks,
    isDrawerOpen,
    editingId,
    editingTitle,
    showTooltip,
    // 方法
    handleAddTodo,
    handleKeydown,
    toggleSearch,
    clearSearch,
    handleToggleTodo,
    startEditing,
    cancelEditing,
    saveEditing,
    handleEditKeydown,
  }
}
