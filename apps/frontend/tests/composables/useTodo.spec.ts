import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useTodo } from '@/features/todo/composables/useTodo'
import { useTodoStore } from '@/features/todo/stores/todo'

// Mock todoStore
vi.mock('@/features/todo/stores/todo', () => ({
  useTodoStore: vi.fn(() => ({
    addTodo: vi.fn(),
    toggleTodo: vi.fn(),
    updateTodo: vi.fn(),
    clearSearch: vi.fn(),
    setSearchQuery: vi.fn(),
    clearError: vi.fn(),
    isDrawerOpen: false,
    setDrawerOpen: vi.fn(),
    toggleDrawer: vi.fn(),
  })),
}))

describe('useTodo', () => {
  let todoStore: ReturnType<typeof useTodoStore>

  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    vi.useFakeTimers()

    // 重新 mock todoStore
    todoStore = {
      addTodo: vi.fn(),
      toggleTodo: vi.fn(),
      updateTodo: vi.fn(),
      clearSearch: vi.fn(),
      setSearchQuery: vi.fn(),
      clearError: vi.fn(),
      isDrawerOpen: false,
      setDrawerOpen: vi.fn(),
      toggleDrawer: vi.fn(),
    } as unknown as ReturnType<typeof useTodoStore>

    vi.mocked(useTodoStore).mockReturnValue(todoStore)
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  describe('initial state', () => {
    it('should have correct default values', () => {
      const { newTodoTitle, showSearch, searchInput, showFireworks, editingId, isDrawerOpen } =
        useTodo()

      expect(newTodoTitle.value).toBe('')
      expect(showSearch.value).toBe(false)
      expect(searchInput.value).toBe('')
      expect(showFireworks.value).toBe(false)
      expect(editingId.value).toBeNull()
      expect(isDrawerOpen.value).toBe(false)
    })
  })

  describe('drawer state', () => {
    it('should sync isDrawerOpen with store', () => {
      const { isDrawerOpen } = useTodo()

      // Initial value from mock
      expect(isDrawerOpen.value).toBe(false)

      // Update value should call store.setDrawerOpen
      isDrawerOpen.value = true
      expect(todoStore.setDrawerOpen).toHaveBeenCalledWith(true)
    })
  })

  describe('handleAddTodo', () => {
    it('should not add todo when title is empty', async () => {
      const { newTodoTitle, handleAddTodo } = useTodo()
      newTodoTitle.value = ''

      await handleAddTodo()

      expect(todoStore.addTodo).not.toHaveBeenCalled()
    })

    it('should not add todo when title is only whitespace', async () => {
      const { newTodoTitle, handleAddTodo } = useTodo()
      newTodoTitle.value = '   '

      await handleAddTodo()

      expect(todoStore.addTodo).not.toHaveBeenCalled()
    })

    it('should add todo and clear input on success', async () => {
      vi.mocked(todoStore.addTodo).mockResolvedValue(true)

      const { newTodoTitle, handleAddTodo } = useTodo()
      newTodoTitle.value = 'New Todo'

      await handleAddTodo()

      expect(todoStore.addTodo).toHaveBeenCalledWith('New Todo')
      expect(newTodoTitle.value).toBe('')
    })

    it('should trigger tooltip feedback on failure', async () => {
      vi.mocked(todoStore.addTodo).mockResolvedValue(false)

      const { newTodoTitle, handleAddTodo, showTooltip } = useTodo()
      newTodoTitle.value = 'New Todo'

      await handleAddTodo()

      expect(showTooltip.value).toBe(true)

      // 测试 tooltip 在 2000ms 后隐藏
      vi.advanceTimersByTime(2000)
      expect(showTooltip.value).toBe(false)
    })
  })

  describe('handleKeydown', () => {
    it('should call handleAddTodo when Enter key is pressed', async () => {
      vi.mocked(todoStore.addTodo).mockResolvedValue(true)

      const { newTodoTitle, handleKeydown } = useTodo()
      newTodoTitle.value = 'Test Todo'

      const event = new KeyboardEvent('keydown', { key: 'Enter' })
      await handleKeydown(event)

      expect(todoStore.addTodo).toHaveBeenCalledWith('Test Todo')
    })

    it('should not call handleAddTodo when other keys are pressed', async () => {
      const { handleKeydown } = useTodo()

      const event = new KeyboardEvent('keydown', { key: 'Escape' })
      await handleKeydown(event)

      expect(todoStore.addTodo).not.toHaveBeenCalled()
    })
  })

  describe('handleToggleTodo', () => {
    it('should show fireworks when completing a todo', async () => {
      const { showFireworks, handleToggleTodo } = useTodo()

      // 当 currentCompleted 为 false 时，意味着正在完成 todo
      await handleToggleTodo('1', false)

      expect(showFireworks.value).toBe(true)
      expect(todoStore.toggleTodo).toHaveBeenCalledWith('1')
    })

    it('should not show fireworks when uncompleting a todo', async () => {
      const { showFireworks, handleToggleTodo } = useTodo()

      // 当 currentCompleted 为 true 时，意味着正在取消完成
      await handleToggleTodo('1', true)

      expect(showFireworks.value).toBe(false)
      expect(todoStore.toggleTodo).toHaveBeenCalledWith('1')
    })
  })

  describe('search functionality', () => {
    it('should update search input and call setSearchQuery', () => {
      const { searchInput, handleSearchInput } = useTodo()

      const event = { target: { value: 'test query' } } as unknown as Event
      handleSearchInput(event)

      expect(searchInput.value).toBe('test query')
      expect(todoStore.setSearchQuery).toHaveBeenCalledWith('test query')
    })

    it('should clear search correctly', () => {
      const { searchInput, clearSearch } = useTodo()
      searchInput.value = 'test query'

      clearSearch()

      expect(searchInput.value).toBe('')
      expect(todoStore.clearSearch).toHaveBeenCalled()
    })

    it('should toggle search visibility and clear when closing', () => {
      const { showSearch, searchInput, toggleSearch } = useTodo()

      // Open search
      toggleSearch()
      expect(showSearch.value).toBe(true)

      // Set some search input
      searchInput.value = 'test'

      // Close search
      toggleSearch()
      expect(showSearch.value).toBe(false)
      expect(searchInput.value).toBe('')
      expect(todoStore.clearSearch).toHaveBeenCalled()
    })
  })

  describe('editing functionality', () => {
    it('should start editing with correct values', () => {
      const { editingId, editingTitle, startEditing } = useTodo()

      startEditing('todo-1', 'Test Title')

      expect(editingId.value).toBe('todo-1')
      expect(editingTitle.value).toBe('Test Title')
    })

    it('should cancel editing correctly', () => {
      const { editingId, editingTitle, startEditing, cancelEditing } = useTodo()

      startEditing('todo-1', 'Test Title')
      cancelEditing()

      expect(editingId.value).toBeNull()
      expect(editingTitle.value).toBe('')
    })

    it('should save edit and call updateTodo', async () => {
      const { editingId, editingTitle, startEditing, saveEditing } = useTodo()

      startEditing('todo-1', 'Test Title')
      editingTitle.value = 'Updated Title'
      vi.mocked(todoStore.updateTodo).mockResolvedValue(true)

      await saveEditing()

      expect(todoStore.updateTodo).toHaveBeenCalledWith('todo-1', 'Updated Title')
      expect(editingId.value).toBeNull()
      expect(editingTitle.value).toBe('')
    })

    it('should stay in edit mode if updateTodo fails due to duplication', async () => {
      const { editingId, editingTitle, startEditing, saveEditing } = useTodo()

      startEditing('todo-1', 'Test Title')
      editingTitle.value = 'Duplicate Title'

      // Mock updateTodo to return false and set error
      vi.mocked(todoStore.updateTodo).mockResolvedValue(false)
      todoStore.error = 'todo.duplicate'

      await saveEditing()

      expect(todoStore.updateTodo).toHaveBeenCalledWith('todo-1', 'Duplicate Title')
      expect(editingId.value).toBe('todo-1') // Should NOT be null
      expect(editingTitle.value).toBe('Duplicate Title') // Should NOT be empty
    })

    it('should not save edit if editingId is null', async () => {
      const { saveEditing } = useTodo()

      await saveEditing()

      expect(todoStore.updateTodo).not.toHaveBeenCalled()
    })

    it('should not save edit if editingTitle is empty', async () => {
      const { editingId, editingTitle, saveEditing } = useTodo()

      editingId.value = 'todo-1'
      editingTitle.value = '   '

      await saveEditing()

      expect(todoStore.updateTodo).not.toHaveBeenCalled()
    })
  })

  describe('handleEditKeydown', () => {
    it('should save on Enter key', async () => {
      const { startEditing, editingTitle, handleEditKeydown } = useTodo()

      startEditing('todo-1', 'Test Title')
      editingTitle.value = 'Updated Title'

      const event = new KeyboardEvent('keydown', { key: 'Enter' })
      await handleEditKeydown(event)

      expect(todoStore.updateTodo).toHaveBeenCalledWith('todo-1', 'Updated Title')
    })

    it('should cancel on Escape key', async () => {
      const { editingId, startEditing, handleEditKeydown } = useTodo()

      startEditing('todo-1', 'Test Title')

      const event = new KeyboardEvent('keydown', { key: 'Escape' })
      await handleEditKeydown(event)

      expect(editingId.value).toBeNull()
    })

    it('should do nothing on other keys', async () => {
      const { startEditing, editingId, handleEditKeydown } = useTodo()

      startEditing('todo-1', 'Test Title')

      const event = new KeyboardEvent('keydown', { key: 'Space' })
      await handleEditKeydown(event)

      expect(editingId.value).toBe('todo-1')
      expect(todoStore.updateTodo).not.toHaveBeenCalled()
    })
  })
})
