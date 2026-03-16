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
        clearDueAt: '清除截止',
        clearRemindAt: '清除提醒',
        quickDueTonight2359: '今晚 23:59',
        quickDueTomorrow0900: '明天 09:00',
        quickRemindIn15m: '15 分钟后',
        quickRemindIn1h: '1 小时后',
        quickRemindBeforeDue10m: '提前 10 分钟',
        quickRemindBeforeDue30m: '提前 30 分钟',
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
})
