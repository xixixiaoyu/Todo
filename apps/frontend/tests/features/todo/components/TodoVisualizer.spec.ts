import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import { createPinia, setActivePinia } from 'pinia'
import { defineComponent, h, ref } from 'vue'
import TodoVisualizer from '@/features/todo/components/TodoVisualizer.vue'
import { useTodoStore } from '@/features/todo/stores/todo'

vi.mock('@vueuse/core', () => ({
  useDark: () => ref(false),
  useResizeObserver: () => undefined,
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
  Clover: { template: '<span />' },
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
  })

  it('在 completed 过滤下应显示对应的空状态文案', () => {
    const store = useTodoStore()
    store.todos = []
    store.filter = 'completed'

    const wrapper = mount(TodoVisualizer, {
      global: {
        plugins: [i18n],
      },
    })

    expect(wrapper.text()).toContain('还没有已完成的事项')
  })
})
