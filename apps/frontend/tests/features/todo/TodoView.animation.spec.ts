import { beforeEach, describe, expect, it, vi } from 'vitest'
import { shallowMount } from '@vue/test-utils'
import { nextTick, reactive, ref } from 'vue'
import TodoView from '@/features/todo/TodoView.vue'

const fromSpy = vi.fn()
const toSpy = vi.fn()
const setSpy = vi.fn()
const killTweensOfSpy = vi.fn()
const toArraySpy = vi.fn(() => [document.createElement('div')])
const addSpy = vi.fn((callback: () => void) => callback())
const fetchTodosSpy = vi.fn()
const isDrawerOpenRef = ref(false)
const pomodoroStoreMock = reactive({
  isMiniMode: false,
  status: 'idle',
})

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
  usePomodoroStore: () => pomodoroStoreMock,
}))

vi.mock('@/features/todo/composables/useTodo', () => ({
  useTodo: () => ({
    newTodoTitle: ref(''),
    showSearch: ref(false),
    searchInput: ref(''),
    showFireworks: ref(false),
    isDrawerOpen: isDrawerOpenRef,
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
    isDrawerOpenRef.value = false
    pomodoroStoreMock.isMiniMode = false
    pomodoroStoreMock.status = 'idle'
  })

  it('does not run post-paint gsap entrance tweens on initial mount', () => {
    shallowMount(TodoView)

    expect(fetchTodosSpy).toHaveBeenCalledTimes(1)
    expect(fromSpy).not.toHaveBeenCalled()
  })

  it('re-applies input spacing after exiting mini mode', async () => {
    const wrapper = shallowMount(TodoView, {
      global: {
        renderStubDefaultSlot: true,
      },
    })

    await nextTick()
    setSpy.mockClear()

    pomodoroStoreMock.isMiniMode = true
    await nextTick()
    pomodoroStoreMock.isMiniMode = false
    await nextTick()
    await nextTick()

    const spacingSetCall = setSpy.mock.calls.find(([, vars]) => {
      if (!vars || typeof vars !== 'object') return false
      return (
        (vars as { marginBottom?: number }).marginBottom === 20 &&
        (vars as { height?: number }).height === 52
      )
    })

    expect(spacingSetCall).toBeDefined()
    wrapper.unmount()
  })

  it('mounts the ai drawer on the first render when persisted state is open', () => {
    isDrawerOpenRef.value = true

    const wrapper = shallowMount(TodoView)

    expect(wrapper.findComponent({ name: 'AiAssistantDrawer' }).exists()).toBe(true)
  })
})
