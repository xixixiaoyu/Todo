import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from 'vitest'
import { ref, defineComponent, nextTick } from 'vue'
import { mount } from '@vue/test-utils'
import { useSmartScroll } from '@/composables/useSmartScroll'

describe('useSmartScroll', () => {
  let scrollContainer: {
    scrollTop: number
    scrollHeight: number
    clientHeight: number
    scrollTo: Mock
    addEventListener: Mock
    removeEventListener: Mock
  }

  beforeEach(() => {
    vi.useFakeTimers()
    scrollContainer = {
      scrollTop: 0,
      scrollHeight: 1000,
      clientHeight: 500,
      scrollTo: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }

    // Mock ResizeObserver
    global.ResizeObserver = class {
      observe = vi.fn()
      unobserve = vi.fn()
      disconnect = vi.fn()
    } as unknown as typeof ResizeObserver

    // Mock MutationObserver
    global.MutationObserver = vi.fn().mockImplementation(function (_cb) {
      return {
        observe: vi.fn(),
        disconnect: vi.fn(),
        takeRecords: vi.fn(),
      }
    }) as unknown as typeof MutationObserver

    // Mock requestAnimationFrame
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => setTimeout(cb, 0))
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.clearAllMocks()
    vi.unstubAllGlobals()
  })

  const createTestComponent = (options: Partial<Parameters<typeof useSmartScroll>[0]> = {}) => {
    return defineComponent({
      setup() {
        const containerRef = ref(scrollContainer as unknown as HTMLElement)
        const scroll = useSmartScroll({
          scrollContainer: containerRef,
          ...options,
        })
        return { ...scroll, containerRef }
      },
      template: '<div></div>',
    })
  }

  type UnwrappedSmartScroll = {
    [K in keyof ReturnType<typeof useSmartScroll>]: ReturnType<typeof useSmartScroll>[K] extends {
      value: infer T
    }
      ? T
      : ReturnType<typeof useSmartScroll>[K]
  } & { containerRef: HTMLElement }

  it('should initialize with default values', () => {
    const wrapper = mount(createTestComponent())
    const vm = wrapper.vm as unknown as UnwrappedSmartScroll

    expect(vm.isSticking).toBe(true)
    expect(vm.isAutoScrollEnabled).toBe(true)
    expect(vm.isUserScrolledUp).toBe(false)
    expect(vm.isScrollable).toBe(true) // Initial mock: 1000 > 500
  })

  it('should detect scrollability correctly', async () => {
    const wrapper = mount(createTestComponent())
    const vm = wrapper.vm as unknown as UnwrappedSmartScroll

    await nextTick()
    vi.runAllTimers()

    // Scrollable
    scrollContainer.scrollHeight = 1000
    scrollContainer.clientHeight = 500
    // Manually trigger handleResize logic via MutationObserver mock if needed
    // In this test, we can just call the internal updateScrollMetrics if exposed,
    // or simulate the event that triggers it.
    // Since we are testing the state, let's trigger a scroll.
    const scrollHandler = (scrollContainer.addEventListener as Mock).mock.calls.find(
      (call: unknown[]) => call[0] === 'scroll',
    )?.[1] as EventListener
    scrollHandler({} as Event)
    vi.runAllTimers()
    expect(vm.isScrollable).toBe(true)

    // Not scrollable
    scrollContainer.scrollHeight = 500
    scrollContainer.clientHeight = 500
    scrollHandler({} as Event)
    vi.runAllTimers()
    expect(vm.isScrollable).toBe(false)
  })

  it('should reset isUserScrolledUp when content shrinks and becomes at bottom', async () => {
    const wrapper = mount(createTestComponent())
    const vm = wrapper.vm as unknown as UnwrappedSmartScroll

    await nextTick()
    vi.runAllTimers()

    // 1. User scrolls up
    vm.isUserScrolledUp = true

    // 2. Content shrinks so it fits
    scrollContainer.scrollHeight = 500
    scrollContainer.clientHeight = 500
    scrollContainer.scrollTop = 0

    // Simulate MutationObserver callback
    const MutationObserverMock = global.MutationObserver as unknown as Mock
    const mutationCallback = MutationObserverMock.mock.calls[0][0]
    mutationCallback()

    vi.runAllTimers()

    expect(vm.isUserScrolledUp).toBe(false)
  })

  it('should detect when at bottom correctly', async () => {
    const wrapper = mount(createTestComponent())
    const vm = wrapper.vm as unknown as UnwrappedSmartScroll

    await nextTick()
    vi.runAllTimers()

    // Mock at bottom
    scrollContainer.scrollTop = 500
    expect(vm.isAtBottom()).toBe(true)

    // Mock not at bottom
    scrollContainer.scrollTop = 400
    expect(vm.isAtBottom()).toBe(false)
  })

  it('should handle manual scroll to bottom', async () => {
    const wrapper = mount(createTestComponent())
    const vm = wrapper.vm as unknown as UnwrappedSmartScroll

    await nextTick()
    vi.runAllTimers()

    const el = vm.containerRef

    // Test instant scroll
    vm.scrollToBottom('instant')
    vi.runAllTimers()
    expect(el.scrollTop).toBe(1000)

    // Test smooth scroll
    vm.scrollToBottom('smooth')
    vi.runAllTimers()
    expect(el.scrollTo).toHaveBeenCalledWith(
      expect.objectContaining({
        behavior: 'smooth',
      }),
    )
  })

  it('should disable auto-scroll when user scrolls up', async () => {
    const wrapper = mount(createTestComponent({ userScrollSensitivity: 5 }))
    const vm = wrapper.vm as unknown as UnwrappedSmartScroll

    await nextTick()
    vi.runAllTimers()

    // Simulate scroll listener setup
    const scrollHandler = (scrollContainer.addEventListener as Mock).mock.calls.find(
      (call: unknown[]) => call[0] === 'scroll',
    )?.[1] as EventListener

    // 1. 设置初始位置并触发一次滚动以更新 lastScrollTop
    scrollContainer.scrollTop = 500
    scrollHandler({} as Event)
    vi.runAllTimers()

    // 2. 模拟用户向上滚动 (delta = -100)
    scrollContainer.scrollTop = 400
    scrollHandler({} as Event)
    vi.runAllTimers()

    expect(vm.isAutoScrollEnabled).toBe(false)
    expect(vm.isUserScrolledUp).toBe(true)
  })

  it('should re-enable auto-scroll when user scrolls to bottom', async () => {
    const wrapper = mount(createTestComponent())
    const vm = wrapper.vm as unknown as UnwrappedSmartScroll

    await nextTick()
    vi.runAllTimers()

    // Simulate scroll listener setup
    const scrollHandler = (scrollContainer.addEventListener as Mock).mock.calls.find(
      (call: unknown[]) => call[0] === 'scroll',
    )?.[1] as EventListener

    // 1. 先禁用自动滚动
    vm.isAutoScrollEnabled = false
    vm.isUserScrolledUp = true

    // 2. 模拟用户滚动到底部
    scrollContainer.scrollTop = 500
    scrollHandler({} as Event)
    vi.runAllTimers()

    expect(vm.isAutoScrollEnabled).toBe(true)
    expect(vm.isUserScrolledUp).toBe(false)
  })

  it('should allow user to override programmatic scroll by scrolling up', async () => {
    const wrapper = mount(createTestComponent({ userScrollSensitivity: 5, atBottomThreshold: 10 }))
    const vm = wrapper.vm as unknown as UnwrappedSmartScroll

    await nextTick()
    vi.runAllTimers()

    const scrollHandler = (scrollContainer.addEventListener as Mock).mock.calls.find(
      (call: unknown[]) => call[0] === 'scroll',
    )?.[1] as EventListener

    // 1. 设置初始状态：在底部
    scrollContainer.scrollHeight = 1000
    scrollContainer.clientHeight = 500
    scrollContainer.scrollTop = 500 // 底部
    vm.scrollToBottom('instant') // lastScrollTop = 500, isProgrammaticScroll = true

    // 2. 模拟用户强行向上滚动
    scrollContainer.scrollTop = 400 // 向上移动了 100
    // 此时 scrollDelta = 400 - 500 = -100
    // atBottom: offset = 1000 - 400 - 500 = 100. 100 > 10 + 2, 所以 atBottom = false

    scrollHandler({} as Event)
    vi.runAllTimers()

    // 验证自动滚动被中断
    expect(vm.isAutoScrollEnabled).toBe(false)
    expect(vm.isUserScrolledUp).toBe(true)
  })

  it('should handle streaming mode transition', async () => {
    const wrapper = mount(createTestComponent())
    const vm = wrapper.vm as unknown as UnwrappedSmartScroll

    await nextTick()
    vi.runAllTimers()

    // When streaming starts
    vm.setStreamingMode(true)
    await nextTick()
    vi.runAllTimers()

    // When sticking, it should scroll to bottom
    expect(scrollContainer.scrollTop).toBe(1000)
  })
})
