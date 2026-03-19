import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import TodoSchedulePopover from '@/features/todo/components/TodoSchedulePopover.vue'

const isMobileMock = ref(false)

vi.mock('@/composables/useWindowSize', () => ({
  useIsMobile: () => ({ isMobile: isMobileMock }),
}))

const i18n = createI18n({
  legacy: false,
  locale: 'zh-CN',
  messages: {
    'zh-CN': {
      todo: {
        dueAt: '截止时间',
        remindAt: '提醒时间',
        recurrence: '循环',
        recurrenceNone: '不循环',
        recurrenceDaily: '每天',
        recurrenceWeekdays: '工作日',
        recurrenceWeekly: '每周',
        recurrenceMonthly: '每月',
        recurrenceNeedsDue: '循环任务需要设置截止时间',
        clearDueAt: '清除截止',
        clearRemindAt: '清除提醒',
        quickDueTonight2359: '今晚 23:59',
        quickDueTomorrow0900: '明天 09:00',
        quickRemindIn15m: '15 分钟后',
        quickRemindIn1h: '1 小时后',
        quickRemindBeforeDue10m: '提前 10 分钟',
        quickRemindBeforeDue30m: '提前 30 分钟',
        remindAfterDue: '提醒时间不能晚于截止时间',
      },
      common: {
        cancel: '取消',
        confirm: '确定',
      },
    },
  },
})

const stubs = {
  TodoDateTimePicker: {
    props: ['modelValue', 'defaultExpanded'],
    emits: ['update:modelValue'],
    template: '<div class="todo-date-time-picker" :data-default-expanded="defaultExpanded"></div>',
  },
}

describe('TodoSchedulePopover', () => {
  beforeEach(() => {
    isMobileMock.value = false
  })

  it('shows single active editor on mobile and switches between due/remind', async () => {
    isMobileMock.value = true

    const wrapper = mount(TodoSchedulePopover, {
      props: {
        dueAt: null,
        remindAt: null,
      },
      global: {
        plugins: [i18n],
        stubs,
      },
    })

    expect(wrapper.findAll('.todo-date-time-picker')).toHaveLength(1)
    expect(wrapper.text()).toContain('清除截止')

    const remindTab = wrapper.findAll('button').find((button) => button.text().includes('提醒时间'))
    expect(remindTab).toBeTruthy()
    await remindTab!.trigger('click')

    expect(wrapper.findAll('.todo-date-time-picker')).toHaveLength(1)
    expect(wrapper.text()).toContain('清除提醒')
    expect(wrapper.text()).not.toContain('清除截止')
  })

  it('keeps dual-column editors on desktop', () => {
    const wrapper = mount(TodoSchedulePopover, {
      props: {
        dueAt: null,
        remindAt: null,
      },
      global: {
        plugins: [i18n],
        stubs,
      },
    })

    expect(wrapper.findAll('.todo-date-time-picker')).toHaveLength(2)
    expect(wrapper.text()).toContain('清除截止')
    expect(wrapper.text()).toContain('清除提醒')
  })

  it('emits recurrence rule when apply is clicked', async () => {
    const wrapper = mount(TodoSchedulePopover, {
      props: {
        dueAt: new Date('2026-03-17T09:00:00.000Z'),
        remindAt: null,
        recurrenceRule: null,
      },
      global: {
        plugins: [i18n],
        stubs,
      },
    })

    const dailyButton = wrapper.findAll('button').find((button) => button.text().includes('每天'))
    expect(dailyButton).toBeTruthy()
    await dailyButton!.trigger('click')

    const confirmButton = wrapper.findAll('button').find((button) => button.text().includes('确定'))
    expect(confirmButton).toBeTruthy()
    await confirmButton!.trigger('click')

    const emitted = wrapper.emitted('apply')
    expect(emitted).toBeTruthy()
    expect(emitted?.[0]).toHaveLength(3)
    expect(emitted?.[0]?.[2]).toBe('DAILY')
  })

  it('disables confirm when recurrence is set without dueAt', async () => {
    const wrapper = mount(TodoSchedulePopover, {
      props: {
        dueAt: null,
        remindAt: null,
        recurrenceRule: null,
      },
      global: {
        plugins: [i18n],
        stubs,
      },
    })

    const dailyButton = wrapper.findAll('button').find((button) => button.text().includes('每天'))
    expect(dailyButton).toBeTruthy()
    await dailyButton!.trigger('click')

    const confirmButton = wrapper.findAll('button').find((button) => button.text().includes('确定'))
    expect(confirmButton).toBeTruthy()
    expect(confirmButton?.attributes('disabled')).toBeDefined()
    expect(wrapper.text()).toContain('循环任务需要设置截止时间')
  })
})
