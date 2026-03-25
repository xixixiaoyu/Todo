import { describe, it, expect, beforeEach, vi } from 'vitest'
import { shallowMount } from '@vue/test-utils'
import { defineComponent, h, reactive, ref } from 'vue'
import PomodoroTimer from '@/features/todo/components/PomodoroTimer.vue'

const pomodoroStoreMock = reactive({
  isMiniMode: true,
  status: 'focus',
  isEarthReady: false,
})

const isThemeDarkRef = ref(true)
const transitionPropsSpy = vi.fn()

vi.mock('@/features/todo/stores/pomodoro', () => ({
  usePomodoroStore: () => pomodoroStoreMock,
}))

vi.mock('@/composables/useGsap', () => ({
  useGsap: () => ({
    gsap: {
      fromTo: vi.fn(),
    },
    ctx: {
      add: (callback: () => void) => callback(),
    },
  }),
}))

vi.mock('@/composables/useTheme', () => ({
  useTheme: () => ({
    isDark: isThemeDarkRef,
  }),
}))

vi.mock('@/services/native', () => ({
  nativeService: {
    platform: 'web',
  },
}))

vi.mock('@vueuse/core', () => ({
  useWindowSize: () => ({
    width: ref(1440),
    height: ref(900),
  }),
}))

describe('PomodoroTimer', () => {
  beforeEach(() => {
    pomodoroStoreMock.isMiniMode = true
    pomodoroStoreMock.status = 'focus'
    pomodoroStoreMock.isEarthReady = false
    isThemeDarkRef.value = true
    transitionPropsSpy.mockClear()
  })

  it('退出迷你模式时应立即卸载卡片，不等待根节点过渡时长', () => {
    const TransitionStub = defineComponent({
      name: 'TransitionStub',
      props: {
        appear: {
          type: Boolean,
          default: false,
        },
        duration: {
          type: [Number, Object],
          default: undefined,
        },
      },
      setup(props, { slots, attrs }) {
        transitionPropsSpy({
          appear: props.appear,
          duration: props.duration,
        })

        return () => h('div', attrs, slots.default?.())
      },
    })

    shallowMount(PomodoroTimer, {
      global: {
        stubs: {
          transition: TransitionStub,
          PomodoroTimerDisplay: true,
          PomodoroMiniControls: true,
        },
      },
    })

    expect(transitionPropsSpy).toHaveBeenCalledWith({
      appear: true,
      duration: { enter: 500, leave: 0 },
    })
  })
})
