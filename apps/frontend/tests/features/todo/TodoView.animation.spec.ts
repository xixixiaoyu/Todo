import { beforeEach, describe, expect, it, vi } from 'vitest'
import { shallowMount } from '@vue/test-utils'
import { ref } from 'vue'
import TodoView from '@/features/todo/TodoView.vue'

const fromSpy = vi.fn()
const toSpy = vi.fn()
const setSpy = vi.fn()
const killTweensOfSpy = vi.fn()
const toArraySpy = vi.fn(() => [document.createElement('div')])
const addSpy = vi.fn((callback: () => void) => callback())
const fetchTodosSpy = vi.fn()

vi.mock('vue-i18n', async (importOriginal) => {
  const actual = await importOriginal<typeof import('vue-i18n')>()
  return {
    ...actual,
    useI18n: () => ({
      t: (key: string) => key,
    }),
  }
})

vi.mock('@/composables/useWindowSize', () => ({
  useIsMobile: () => ({
    isMobile: ref(false),
  }),
}))

vi.mock('@/composables/useGsap', () => ({
  useGsap: () => ({
    gsap: {
      from: fromSpy,
      to: toSpy,
      set: setSpy,
      killTweensOf: killTweensOfSpy,
      utils: {
        toArray: toArraySpy,
      },
    },
    ctx: {
      add: addSpy,
    },
  }),
}))

vi.mock('@/features/todo/stores/todo', () => ({
  useTodoStore: () => ({
    isDragging: false,
    viewMode: 'list',
    filter: 'pending',
    hasProposedChanges: false,
    previewTodos: [],
    filteredTodos: [],
    searchQuery: '',
    syncConflicts: [],
    todos: [],
    fetchTodos: fetchTodosSpy,
    deleteTodo: vi.fn(),
    reorderTodos: vi.fn(),
  }),
}))

vi.mock('@/features/todo/stores/pomodoro', () => ({
  usePomodoroStore: () => ({
    isMiniMode: false,
  }),
}))

vi.mock('@/features/todo/composables/useTodo', () => ({
  useTodo: () => ({
    newTodoTitle: ref(''),
    showSearch: ref(false),
    searchInput: ref(''),
    showFireworks: ref(false),
    isDrawerOpen: ref(false),
    editingId: ref<string | null>(null),
    editingTitle: ref(''),
    showTooltip: ref(false),
    handleAddTodo: vi.fn(),
    handleKeydown: vi.fn(),
    clearSearch: vi.fn(),
    handleToggleTodo: vi.fn(),
    startEditing: vi.fn(),
    cancelEditing: vi.fn(),
    saveEditing: vi.fn(),
    handleEditKeydown: vi.fn(),
  }),
}))

describe('TodoView animation timing', () => {
  beforeEach(() => {
    fromSpy.mockClear()
    toSpy.mockClear()
    setSpy.mockClear()
    killTweensOfSpy.mockClear()
    toArraySpy.mockClear()
    addSpy.mockClear()
    fetchTodosSpy.mockClear()
  })

  it('does not add positive delay to initial gsap.from tweens', () => {
    shallowMount(TodoView)

    expect(fetchTodosSpy).toHaveBeenCalledTimes(1)
    expect(fromSpy).toHaveBeenCalled()

    const containerTweenCall = fromSpy.mock.calls.find(([, vars]) => {
      if (!vars || typeof vars !== 'object') return false
      return (vars as { stagger?: number }).stagger === 0.03
    })

    expect(containerTweenCall).toBeDefined()

    const vars = containerTweenCall?.[1] as { delay?: number } | undefined
    if (!vars || !Object.prototype.hasOwnProperty.call(vars, 'delay')) return

    expect(vars.delay).not.toBeGreaterThan(0)
  })
})
