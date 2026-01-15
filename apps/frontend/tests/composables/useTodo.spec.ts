import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { defineComponent, h } from 'vue'
import { mount } from '@vue/test-utils'
import { useTodo } from '@/features/todo/composables/useTodo'
import { useTodoStore } from '@/features/todo/stores/todo'

// Mock useToast
vi.mock('@/composables/useToast', () => ({
  useToast: vi.fn(() => ({
    error: vi.fn(),
    success: vi.fn(),
  })),
}))

/**
 * Helper to test composables with lifecycle hooks
 */
function withSetup<T>(hook: () => T) {
  let result: T
  const setup = defineComponent({
    setup() {
      result = hook()
      return () => h('div')
    },
  })
  mount(setup)
  return result!
}

// Mock vue-i18n
vi.mock('vue-i18n', () => ({
  useI18n: vi.fn(() => ({
    t: vi.fn((key: string) => key),
  })),
}))

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
    setSilencingToast: vi.fn(),
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
      error: null,
      setDrawerOpen: vi.fn(),
      toggleDrawer: vi.fn(),
      setSilencingToast: vi.fn(),
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
        withSetup(useTodo)

      expect(newTodoTitle.value).toBe('')
      expect(showSearch.value).toBe(false)
      expect(searchInput.value).toBe('')
      expect(showFireworks.value).toBe(false)
      expect(editingId.value).toBeNull()
      expect(isDrawerOpen.value).toBe(false)
    })
  })

  describe('search state', () => {
    it('should toggle search state', () => {
      const { showSearch, searchInput, toggleSearch } = withSetup(useTodo)

      expect(showSearch.value).toBe(false)

      toggleSearch()
      expect(showSearch.value).toBe(true)

      searchInput.value = 'test'
      toggleSearch()
      expect(showSearch.value).toBe(false)
      expect(searchInput.value).toBe('')
      expect(todoStore.clearSearch).toHaveBeenCalled()
    })

    it('should update store with debounced search query', async () => {
      const { searchInput } = withSetup(useTodo)

      searchInput.value = 'hello'
      await vi.runAllTimersAsync()

      expect(todoStore.setSearchQuery).toHaveBeenCalledWith('hello')
    })

    it('should clear search query', () => {
      const { searchInput, clearSearch } = withSetup(useTodo)

      searchInput.value = 'hello'
      clearSearch()

      expect(searchInput.value).toBe('')
      expect(todoStore.clearSearch).toHaveBeenCalled()
    })
  })

  describe('handleAddTodo', () => {
    it('should not add todo when title is empty', async () => {
      const { newTodoTitle, handleAddTodo } = withSetup(useTodo)

      newTodoTitle.value = ''
      await handleAddTodo()

      expect(todoStore.addTodo).not.toHaveBeenCalled()
    })

    it('should not add todo when title is only whitespace', async () => {
      const { newTodoTitle, handleAddTodo } = withSetup(useTodo)

      newTodoTitle.value = '   '
      await handleAddTodo()

      expect(todoStore.addTodo).not.toHaveBeenCalled()
    })

    it('should add todo and clear input on success', async () => {
      const { newTodoTitle, handleAddTodo } = withSetup(useTodo)
      vi.mocked(todoStore.addTodo).mockResolvedValue(true)

      newTodoTitle.value = 'New Todo'
      await handleAddTodo()

      expect(todoStore.addTodo).toHaveBeenCalledWith('New Todo')
      expect(newTodoTitle.value).toBe('')
    })

    it('should trigger tooltip feedback on failure', async () => {
      const { newTodoTitle, handleAddTodo, showTooltip } = withSetup(useTodo)
      vi.mocked(todoStore.addTodo).mockResolvedValue(false)

      newTodoTitle.value = 'Failed Todo'
      await handleAddTodo()

      expect(showTooltip.value).toBe(true)
      await vi.runAllTimersAsync()
      expect(showTooltip.value).toBe(false)
    })
  })

  describe('handleKeydown', () => {
    it('should call handleAddTodo when Enter key is pressed', async () => {
      const { newTodoTitle, handleKeydown } = withSetup(useTodo)
      vi.mocked(todoStore.addTodo).mockResolvedValue(true)

      newTodoTitle.value = 'Enter Todo'
      await handleKeydown(new KeyboardEvent('keydown', { key: 'Enter' }))

      expect(todoStore.addTodo).toHaveBeenCalledWith('Enter Todo')
    })

    it('should not call handleAddTodo when other keys are pressed', async () => {
      const { newTodoTitle, handleKeydown } = withSetup(useTodo)

      newTodoTitle.value = 'Other Key'
      await handleKeydown(new KeyboardEvent('keydown', { key: 'a' }))

      expect(todoStore.addTodo).not.toHaveBeenCalled()
    })
  })

  describe('handleToggleTodo', () => {
    it('should show fireworks when completing a todo', async () => {
      const { showFireworks, handleToggleTodo } = withSetup(useTodo)

      await handleToggleTodo('1', false)

      expect(showFireworks.value).toBe(true)
      expect(todoStore.toggleTodo).toHaveBeenCalledWith('1')
    })

    it('should not show fireworks when uncompleting a todo', async () => {
      const { showFireworks, handleToggleTodo } = withSetup(useTodo)

      await handleToggleTodo('1', true)

      expect(showFireworks.value).toBe(false)
      expect(todoStore.toggleTodo).toHaveBeenCalledWith('1')
    })
  })

  describe('editing functionality', () => {
    it('should start editing with correct values', () => {
      const { startEditing, editingId, editingTitle } = withSetup(useTodo)

      startEditing('1', 'Title')

      expect(editingId.value).toBe('1')
      expect(editingTitle.value).toBe('Title')
    })

    it('should cancel editing correctly', () => {
      const { startEditing, cancelEditing, editingId, editingTitle } = withSetup(useTodo)

      startEditing('1', 'Title')
      cancelEditing()

      expect(editingId.value).toBeNull()
      expect(editingTitle.value).toBe('')
    })

    it('should save edit and call updateTodo', async () => {
      const { startEditing, saveEditing, editingId } = withSetup(useTodo)
      vi.mocked(todoStore.updateTodo).mockResolvedValue(true)

      startEditing('1', 'Updated Title')
      await saveEditing()

      expect(todoStore.updateTodo).toHaveBeenCalledWith('1', 'Updated Title')
      expect(editingId.value).toBeNull()
    })

    it('should stay in edit mode if updateTodo fails due to duplication', async () => {
      const { startEditing, saveEditing, editingId } = withSetup(useTodo)
      vi.mocked(todoStore.updateTodo).mockResolvedValue(false)
      todoStore.error = 'todo.duplicate'

      startEditing('1', 'Duplicate Title')
      await saveEditing()

      expect(editingId.value).toBe('1')
    })

    it('should not save edit if editingId is null', async () => {
      const { saveEditing } = withSetup(useTodo)
      await saveEditing()
      expect(todoStore.updateTodo).not.toHaveBeenCalled()
    })

    it('should not save edit if editingTitle is empty', async () => {
      const { startEditing, saveEditing } = withSetup(useTodo)
      startEditing('1', '')
      await saveEditing()
      expect(todoStore.updateTodo).not.toHaveBeenCalled()
    })
  })

  describe('handleEditKeydown', () => {
    it('should save on Enter key', async () => {
      const { startEditing, handleEditKeydown } = withSetup(useTodo)
      vi.mocked(todoStore.updateTodo).mockResolvedValue(true)

      startEditing('1', 'Title')
      await handleEditKeydown(new KeyboardEvent('keydown', { key: 'Enter' }))

      expect(todoStore.updateTodo).toHaveBeenCalled()
    })

    it('should cancel on Escape key', async () => {
      const { startEditing, handleEditKeydown, editingId } = withSetup(useTodo)
      startEditing('1', 'Title')
      await handleEditKeydown(new KeyboardEvent('keydown', { key: 'Escape' }))
      expect(editingId.value).toBeNull()
    })

    it('should do nothing on other keys', async () => {
      const { startEditing, handleEditKeydown, editingId } = withSetup(useTodo)
      startEditing('1', 'Title')
      await handleEditKeydown(new KeyboardEvent('keydown', { key: 'a' }))
      expect(editingId.value).toBe('1')
      expect(todoStore.updateTodo).not.toHaveBeenCalled()
    })
  })

  describe('global shortcuts', () => {
    let originalUserAgent: string

    beforeEach(() => {
      originalUserAgent = navigator.userAgent
    })

    afterEach(() => {
      vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue(originalUserAgent)
    })

    it('should toggle drawer on Command+E (Mac)', () => {
      vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue('Macintosh')
      withSetup(useTodo)

      const event = new KeyboardEvent('keydown', {
        key: 'e',
        metaKey: true,
        bubbles: true,
        cancelable: true,
      })
      window.dispatchEvent(event)

      expect(todoStore.setDrawerOpen).toHaveBeenCalledWith(true)
    })

    it('should toggle drawer on Alt+E', () => {
      withSetup(useTodo)

      const event = new KeyboardEvent('keydown', {
        key: 'e',
        altKey: true,
        bubbles: true,
        cancelable: true,
      })
      window.dispatchEvent(event)

      expect(todoStore.setDrawerOpen).toHaveBeenCalledWith(true)
    })

    it('should not toggle drawer on other keys', () => {
      withSetup(useTodo)

      const event = new KeyboardEvent('keydown', {
        key: 'a',
        metaKey: true,
        bubbles: true,
      })
      window.dispatchEvent(event)

      expect(todoStore.setDrawerOpen).not.toHaveBeenCalled()
    })

    it('should toggle drawer even when focus is in a normal input', () => {
      withSetup(useTodo)

      const input = document.createElement('input')
      document.body.appendChild(input)
      input.focus()

      const event = new KeyboardEvent('keydown', {
        key: 'e',
        altKey: true,
        bubbles: true,
        cancelable: true,
      })
      window.dispatchEvent(event)

      expect(todoStore.setDrawerOpen).toHaveBeenCalledWith(true)

      document.body.removeChild(input)
    })

    it('should not toggle drawer when focus is in AI input', () => {
      withSetup(useTodo)

      const input = document.createElement('input')
      input.setAttribute('data-ai-input', 'true')
      document.body.appendChild(input)
      input.focus()

      const event = new KeyboardEvent('keydown', {
        key: 'e',
        altKey: true,
        bubbles: true,
        cancelable: true,
      })
      window.dispatchEvent(event)

      expect(todoStore.setDrawerOpen).not.toHaveBeenCalled()

      document.body.removeChild(input)
    })
  })
})
