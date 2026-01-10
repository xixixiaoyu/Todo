import { ref } from 'vue'
import { useTodoStore } from '../stores/todo'

export function useTodo() {
  const todoStore = useTodoStore()

  const newTodoTitle = ref('')
  const showSearch = ref(false)
  const searchInput = ref('')
  const showFireworks = ref(false)
  const isDrawerOpen = ref(false)
  const editingId = ref<string | null>(null)
  const editingTitle = ref('')
  const isShaking = ref(false)
  const showTooltip = ref(false)

  async function handleAddTodo() {
    if (!newTodoTitle.value.trim()) return

    const success = await todoStore.addTodo(newTodoTitle.value)
    if (success) {
      newTodoTitle.value = ''
    } else {
      isShaking.value = true
      showTooltip.value = true
      setTimeout(() => {
        isShaking.value = false
      }, 600)
      setTimeout(() => {
        showTooltip.value = false
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

  function handleSearchInput(e: Event) {
    const target = e.target as HTMLInputElement
    searchInput.value = target.value
    todoStore.setSearchQuery(target.value)
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
      await todoStore.updateTodo(editingId.value, editingTitle.value)
    }
    cancelEditing()
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
    isShaking,
    showTooltip,
    // 方法
    handleAddTodo,
    handleKeydown,
    toggleSearch,
    handleSearchInput,
    clearSearch,
    handleToggleTodo,
    startEditing,
    cancelEditing,
    saveEditing,
    handleEditKeydown,
  }
}
