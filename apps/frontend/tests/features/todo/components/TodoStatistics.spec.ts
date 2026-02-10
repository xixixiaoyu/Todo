import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import { createPinia, setActivePinia } from 'pinia'
import { defineComponent, h, nextTick, ref } from 'vue'
import TodoStatistics from '@/features/todo/components/TodoStatistics.vue'
import { useTodoStore } from '@/features/todo/stores/todo'
import { usePomodoroStore } from '@/features/todo/stores/pomodoro'
import type { Todo } from '@/features/todo/stores/todo'

vi.mock('@vueuse/core', () => ({
  useDark: () => ref(false),
  useResizeObserver: (_target: unknown, callback: (entries: unknown[]) => void) => {
    callback([{ contentRect: { width: 800, height: 600 } }])
  },
}))

vi.mock('vue-echarts', () => ({
  default: defineComponent({
    name: 'VChart',
    props: {
      option: { type: Object, required: true },
      autoresize: { type: Boolean, default: false },
      theme: { type: String, default: undefined },
    },
    setup(_props, { expose }) {
      expose({ resize: () => undefined })
      return () => h('div', { 'data-test': 'vchart' })
    },
  }),
}))

vi.mock('lucide-vue-next', () => ({
  CheckCircle2: { template: '<span />' },
  Circle: { template: '<span />' },
  ListTodo: { template: '<span />' },
  Timer: { template: '<span />' },
  TrendingUp: { template: '<span />' },
  PieChart: { template: '<span />' },
}))

vi.mock('echarts/core', () => ({
  use: () => undefined,
}))

vi.mock('echarts/renderers', () => ({
  CanvasRenderer: {},
}))

vi.mock('echarts/charts', () => ({
  PieChart: {},
  LineChart: {},
  BarChart: {},
}))

vi.mock('echarts/components', () => ({
  TitleComponent: {},
  TooltipComponent: {},
  LegendComponent: {},
  GridComponent: {},
}))

vi.mock('echarts/features', () => ({
  LegacyGridContainLabel: {},
}))

const i18n = createI18n({
  legacy: false,
  locale: 'zh-CN',
  messages: {
    'zh-CN': {
      common: { minutes: '分钟' },
      statistics: {
        totalTasks: '总任务',
        completedTasks: '已完成',
        pendingTasks: '待完成',
        pomodoroSessions: '番茄数',
        completionRate: '完成率',
        weeklyActivity: '每周活跃度',
        createdTasks: '新增任务',
        focusTime: '专注时长',
      },
      todo: {
        completed: '已完成',
        pending: '待完成',
      },
    },
  },
})

function buildTodo(overrides: Partial<Todo>): Todo {
  return {
    id: overrides.id ?? String(Date.now()),
    title: overrides.title ?? 'Todo',
    completed: overrides.completed ?? false,
    createdAt: overrides.createdAt ?? new Date(),
    updatedAt: overrides.updatedAt ?? new Date(),
    isPinned: overrides.isPinned ?? false,
    order: overrides.order ?? 0,
    version: overrides.version ?? 0,
    pomodoroCount: overrides.pomodoroCount ?? 0,
    parentId: overrides.parentId,
    completedAt: overrides.completedAt,
    deletedAt: overrides.deletedAt,
    expanded: overrides.expanded,
  }
}

type ChartSeries = {
  type?: string
  data?: unknown
}

type ChartOption = {
  series?: ChartSeries[]
}

describe('TodoStatistics', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 1, 10, 12, 0, 0))
    setActivePinia(createPinia())
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('应在概览与图表统计中排除已删除任务', async () => {
    const todoStore = useTodoStore()
    const pomodoroStore = usePomodoroStore()

    pomodoroStore.history = []
    pomodoroStore.completedSessions = 3

    const today9 = new Date(2026, 1, 10, 9, 0, 0)
    const yesterday9 = new Date(2026, 1, 9, 9, 0, 0)

    const activePending = buildTodo({
      id: 'active-pending',
      createdAt: today9,
      updatedAt: today9,
      completed: false,
    })

    const activeCompleted = buildTodo({
      id: 'active-completed',
      createdAt: yesterday9,
      updatedAt: today9,
      completed: true,
      completedAt: today9,
    })

    const deletedPending = buildTodo({
      id: 'deleted-pending',
      createdAt: today9,
      updatedAt: today9,
      completed: false,
      deletedAt: today9,
    })

    const deletedCompleted = buildTodo({
      id: 'deleted-completed',
      createdAt: yesterday9,
      updatedAt: yesterday9,
      completed: true,
      completedAt: yesterday9,
      deletedAt: today9,
    })

    todoStore.todos = [activePending, activeCompleted, deletedPending, deletedCompleted]

    const wrapper = mount(TodoStatistics, {
      global: {
        plugins: [i18n],
        stubs: {
          Card: { template: '<div><slot /></div>' },
          CardContent: { template: '<div><slot /></div>' },
          CardHeader: { template: '<div><slot /></div>' },
          CardTitle: { template: '<div><slot /></div>' },
        },
      },
    })

    await nextTick()

    const metrics = wrapper.findAll('h3').map((n) => n.text())
    expect(metrics[0]).toBe('2')
    expect(metrics[1]).toBe('1')
    expect(metrics[2]).toBe('1')
    expect(metrics[3]).toBe('3')

    const charts = wrapper.findAllComponents({ name: 'VChart' })
    expect(charts.length).toBe(3)

    const weekly = charts.find((c) => {
      const option = c.props('option') as ChartOption
      return option.series?.[0]?.type === 'bar'
    })
    expect(weekly).toBeTruthy()

    const weeklyOption = weekly!.props('option') as ChartOption
    const createdData = weeklyOption.series?.[0]?.data
    const completedData = weeklyOption.series?.[1]?.data

    expect(Array.isArray(createdData)).toBe(true)
    expect(Array.isArray(completedData)).toBe(true)

    const created = createdData as number[]
    const completed = completedData as number[]

    expect(created).toHaveLength(7)
    expect(completed).toHaveLength(7)
    expect(created[6]).toBe(1)
    expect(created[5]).toBe(1)
    expect(completed[6]).toBe(1)
  })
})
