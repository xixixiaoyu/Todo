import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import { createPinia, setActivePinia } from 'pinia'
import { defineComponent, h, ref, nextTick } from 'vue'
import TodoVisualizer from '@/features/todo/components/TodoVisualizer.vue'
import { useTodoStore } from '@/features/todo/stores/todo'

let mockResizeRect = { width: 800, height: 600 }

vi.mock('@vueuse/core', () => ({
  useDark: () => ref(false),
  useResizeObserver: (_target: unknown, callback: (entries: unknown[]) => void) => {
    callback([{ contentRect: mockResizeRect }])
  },
}))

vi.mock('vue-echarts', () => ({
  default: defineComponent({
    name: 'VChart',
    props: { option: { type: Object, required: true } },
    setup() {
      return () => h('div', { 'data-test': 'vchart' })
    },
  }),
}))

vi.mock('lucide-vue-next', () => ({
  Snowflake: { template: '<span />' },
}))

vi.mock('@/composables/useTheme', () => ({
  useTheme: () => ({
    themeColor: ref<string | null>(null),
    theme: ref<'light' | 'dark' | 'auto'>('light'),
    setTheme: vi.fn(),
    setThemeColor: vi.fn(),
    resetThemeColor: vi.fn(),
  }),
}))

const i18n = createI18n({
  legacy: false,
  locale: 'zh-CN',
  messages: {
    'zh-CN': {
      todo: {
        emptyPending: '还没有待办事项',
        emptyCompleted: '还没有已完成的事项',
        pending: '待完成',
        completed: '已完成',
        trash: '回收站',
      },
      common: {
        loading: '加载中...',
        confirm: '确定',
        delete: '删除',
      },
    },
  },
})

describe('TodoVisualizer', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    mockResizeRect = { width: 800, height: 600 }
  })

  it('在 completed 过滤下应显示对应的空状态文案', () => {
    const store = useTodoStore()
    store.todos = []
    store.filter = 'completed'

    const wrapper = mount(TodoVisualizer, {
      props: {
        filter: 'completed',
      },
      global: {
        plugins: [i18n],
      },
    })

    expect(wrapper.text()).toContain('还没有已完成的事项')
  })

  it('容器尺寸为 0 时应显示加载状态并避免渲染图表', async () => {
    mockResizeRect = { width: 0, height: 0 }

    const store = useTodoStore()
    store.filter = 'pending'
    store.todos = [
      {
        id: '1',
        title: 'Test',
        completed: false,
        order: 0,
        isPinned: false,
        parentId: null,
        version: 0,
        pomodoroCount: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]

    const wrapper = mount(TodoVisualizer, {
      props: {
        filter: 'pending',
      },
      global: {
        plugins: [i18n],
      },
    })

    await nextTick()

    expect(wrapper.text()).toContain('加载中...')
    expect(wrapper.find('[data-test="vchart"]').exists()).toBe(false)
  })
})
