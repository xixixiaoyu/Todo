import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import { nextTick } from 'vue'
import TodoSchedulePopover from '@/features/todo/components/TodoSchedulePopover.vue'

const i18n = createI18n({
  legacy: false,
  locale: 'zh-CN',
  messages: {
    'zh-CN': {
      todo: {
        dueAt: '截止时间',
        remindAt: '提醒时间',
        remindAtAuto: '提醒将默认在截止时间触发',
        remindAtDue: '到点提醒',
        customReminder: '自定义提醒',
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
    name: 'TodoDateTimePicker',
    props: ['modelValue', 'defaultExpanded'],
    emits: ['update:modelValue'],
    template: '<div class="todo-date-time-picker" :data-default-expanded="defaultExpanded"></div>',
  },
}

describe('TodoSchedulePopover', () => {
  it('keeps a single due editor and hides manual reminder controls', () => {
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
    expect(wrapper.text()).toContain('提醒将默认在截止时间触发')
    expect(wrapper.text()).toContain('清除截止')
    expect(wrapper.text()).not.toContain('清除提醒')
  })

  it('keeps legacy reminder-only tasks in reminder mode until the user switches modes', async () => {
    const wrapper = mount(TodoSchedulePopover, {
      props: {
        dueAt: null,
        remindAt: new Date('2026-03-18T08:30:00.000Z'),
      },
      global: {
        plugins: [i18n],
        stubs,
      },
    })

    expect(wrapper.text()).toContain('提醒时间')
    expect(wrapper.text()).toContain('清除提醒')
    expect(wrapper.text()).not.toContain('提醒将默认在截止时间触发')
    expect(wrapper.get('[data-test="schedule-kind-reminder"]').classes()).toContain('bg-background')

    const confirmButton = wrapper.findAll('button').find((button) => button.text().includes('确定'))
    expect(confirmButton).toBeTruthy()
    await confirmButton!.trigger('click')

    const emitted = wrapper.emitted('apply')
    expect(emitted).toBeTruthy()
    expect(emitted?.[0]?.[0]).toBeNull()
    expect(emitted?.[0]?.[1]).toStrictEqual(new Date('2026-03-18T08:30:00.000Z'))
  })

  it('promotes legacy reminder-only tasks to due schedules after switching to due mode', async () => {
    const wrapper = mount(TodoSchedulePopover, {
      props: {
        dueAt: null,
        remindAt: new Date('2026-03-18T08:30:00.000Z'),
      },
      global: {
        plugins: [i18n],
        stubs,
      },
    })

    await wrapper.get('[data-test="schedule-kind-due"]').trigger('click')

    expect(wrapper.text()).toContain('提醒将默认在截止时间触发')
    expect(wrapper.text()).toContain('清除截止')

    const confirmButton = wrapper.findAll('button').find((button) => button.text().includes('确定'))
    expect(confirmButton).toBeTruthy()
    await confirmButton!.trigger('click')

    const emitted = wrapper.emitted('apply')
    expect(emitted).toBeTruthy()
    expect(emitted?.[0]?.[0]).toStrictEqual(new Date('2026-03-18T08:30:00.000Z'))
    expect(emitted?.[0]?.[1]).toStrictEqual(new Date('2026-03-18T08:30:00.000Z'))
  })

  it('preserves legacy custom reminders when applying without changing the due time', async () => {
    const wrapper = mount(TodoSchedulePopover, {
      props: {
        dueAt: new Date('2026-03-17T09:00:00.000Z'),
        remindAt: new Date('2026-03-17T08:30:00.000Z'),
        recurrenceRule: null,
      },
      global: {
        plugins: [i18n],
        stubs,
      },
    })

    expect(wrapper.text()).toContain('自定义提醒')
    expect(wrapper.text()).toContain('到点提醒')

    const dailyButton = wrapper.findAll('button').find((button) => button.text().includes('每天'))
    expect(dailyButton).toBeTruthy()
    await dailyButton!.trigger('click')

    const confirmButton = wrapper.findAll('button').find((button) => button.text().includes('确定'))
    expect(confirmButton).toBeTruthy()
    await confirmButton!.trigger('click')

    const emitted = wrapper.emitted('apply')
    expect(emitted).toBeTruthy()
    expect(emitted?.[0]).toHaveLength(3)
    expect(emitted?.[0]?.[0]).toStrictEqual(new Date('2026-03-17T09:00:00.000Z'))
    expect(emitted?.[0]?.[1]).toStrictEqual(new Date('2026-03-17T08:30:00.000Z'))
    expect(emitted?.[0]?.[2]).toBe('DAILY')
  })

  it('shifts legacy custom reminders when the due time changes', async () => {
    const wrapper = mount(TodoSchedulePopover, {
      props: {
        dueAt: new Date('2026-03-17T09:00:00.000Z'),
        remindAt: new Date('2026-03-17T08:30:00.000Z'),
        recurrenceRule: null,
      },
      global: {
        plugins: [i18n],
        stubs,
      },
    })

    wrapper
      .getComponent({ name: 'TodoDateTimePicker' })
      .vm.$emit('update:modelValue', new Date('2026-03-17T10:15:00.000Z'))
    await nextTick()

    const confirmButton = wrapper.findAll('button').find((button) => button.text().includes('确定'))
    expect(confirmButton).toBeTruthy()
    await confirmButton!.trigger('click')

    const emitted = wrapper.emitted('apply')
    expect(emitted).toBeTruthy()
    expect(emitted?.[0]?.[0]).toStrictEqual(new Date('2026-03-17T10:15:00.000Z'))
    expect(emitted?.[0]?.[1]).toStrictEqual(new Date('2026-03-17T09:45:00.000Z'))
  })

  it('lets legacy custom reminders fall back to the due time', async () => {
    const wrapper = mount(TodoSchedulePopover, {
      props: {
        dueAt: new Date('2026-03-17T09:00:00.000Z'),
        remindAt: new Date('2026-03-17T08:30:00.000Z'),
        recurrenceRule: null,
      },
      global: {
        plugins: [i18n],
        stubs,
      },
    })

    await wrapper.get('[data-test="legacy-reminder-toggle"]').trigger('click')

    expect(wrapper.text()).toContain('提醒将默认在截止时间触发')
    expect(wrapper.text()).toContain('自定义提醒')

    const confirmButton = wrapper.findAll('button').find((button) => button.text().includes('确定'))
    expect(confirmButton).toBeTruthy()
    await confirmButton!.trigger('click')

    const emitted = wrapper.emitted('apply')
    expect(emitted).toBeTruthy()
    expect(emitted?.[0]?.[0]).toStrictEqual(new Date('2026-03-17T09:00:00.000Z'))
    expect(emitted?.[0]?.[1]).toStrictEqual(new Date('2026-03-17T09:00:00.000Z'))
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
