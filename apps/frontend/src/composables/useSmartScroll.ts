import { nextTick, onMounted, onUnmounted, ref, watch, type Ref } from 'vue'
import gsap from 'gsap'

import {
  computeSmartScrollDecision,
  createRafBatcher,
  createRafThrottle,
  getScrollSnapshotEl,
  isAtBottomEl,
  type ScrollBehaviorOption,
  type ScrollTriggerContext,
} from './useSmartScroll.internals'

interface UseSmartScrollOptions {
  /** 滚动容器引用 */
  scrollContainer: Ref<HTMLElement | null>
  /** 初始是否粘附底部 */
  stickToBottom?: boolean
  /** 初始是否启用自动滚动 */
  autoScroll?: boolean
  /** 默认滚动行为 */
  scrollBehavior?: ScrollBehaviorOption
  /** 判定为"在底部"的阈值（像素） */
  atBottomThreshold?: number
  /** 流式更新时使用瞬时滚动 */
  streamingInstant?: boolean
  /** 用户滚动检测灵敏度（像素） */
  userScrollSensitivity?: number
  /** 启用 ResizeObserver 监听容器尺寸变化 */
  watchResize?: boolean
}

export function useSmartScroll(options: UseSmartScrollOptions) {
  const {
    scrollContainer,
    stickToBottom: initialStickToBottom = true,
    autoScroll: initialAutoScroll = true,
    scrollBehavior = 'smooth',
    atBottomThreshold = 32,
    streamingInstant = true,
    userScrollSensitivity = 5,
    watchResize = true,
  } = options

  // === 响应式状态 ===
  /** 是否粘附在底部 */
  const isSticking = ref(initialStickToBottom)
  /** 是否启用自动滚动 */
  const isAutoScrollEnabled = ref(initialAutoScroll)
  /** 用户是否主动向上滚动（可用于显示"返回底部"按钮） */
  const isUserScrolledUp = ref(false)
  /** 内容是否可滚动 */
  const isScrollable = ref(false)
  /** 当前是否处于流式更新模式 */
  const isStreamingMode = ref(false)

  // === 内部状态 ===
  let lastScrollTop = 0
  let lastScrollHeight = 0
  let isProgrammaticScroll = false
  let programmaticScrollTimer: ReturnType<typeof setTimeout> | null = null
  let resizeObserver: ResizeObserver | null = null
  let mutationObserver: MutationObserver | null = null

  // === 核心计算方法 ===

  /**
   * 检测是否在底部（支持自定义阈值）
   */
  const isAtBottom = (threshold = atBottomThreshold): boolean => {
    return isAtBottomEl(scrollContainer.value, threshold)
  }

  /**
   * 获取当前滚动状态快照
   */
  const getScrollSnapshot = () => {
    return getScrollSnapshotEl(scrollContainer.value)
  }

  // === 滚动执行方法 ===

  /**
   * 设置程序化滚动标记（带自动清除）
   */
  const setProgrammaticScroll = (duration = 150) => {
    isProgrammaticScroll = true
    if (programmaticScrollTimer) {
      clearTimeout(programmaticScrollTimer)
    }
    programmaticScrollTimer = setTimeout(() => {
      isProgrammaticScroll = false
      programmaticScrollTimer = null
    }, duration)
  }

  /**
   * 执行滚动到底部（瞬时模式）
   */
  const scrollToBottomInstant = () => {
    const el = scrollContainer.value
    if (!el) return
    // 停止任何正在进行的平滑滚动动画
    gsap.killTweensOf(el)
    setProgrammaticScroll(50)
    el.scrollTop = el.scrollHeight
    lastScrollTop = el.scrollTop
    lastScrollHeight = el.scrollHeight
  }

  /**
   * 滚动到底部（平滑模式 - 优化版）
   */
  const scrollToBottomSmooth = () => {
    const el = scrollContainer.value
    if (!el) return

    const { scrollTop, scrollHeight, clientHeight } = el
    const targetTop = scrollHeight - clientHeight
    const distance = targetTop - scrollTop

    // 如果距离很近，直接瞬间滚动
    if (Math.abs(distance) < 2) {
      scrollToBottomInstant()
      return
    }

    // 设置程序化滚动锁定，防止滚动过程中触发用户滚动检测
    // 使用 GSAP 动画，时间更短、更丝滑
    const duration = 0.4
    setProgrammaticScroll(duration * 1000 + 50)

    gsap.to(el, {
      scrollTop: targetTop,
      duration,
      ease: 'power2.out',
      overwrite: true,
      onUpdate: () => {
        lastScrollTop = el.scrollTop
      },
    })
  }

  /**
   * 滚动到底部（统一入口）
   */
  const scrollToBottom = (behavior: ScrollBehaviorOption = scrollBehavior) => {
    const el = scrollContainer.value
    if (!el) return

    if (behavior === 'instant' || behavior === 'auto') {
      scrollToBottomInstant()
    } else {
      scrollToBottomSmooth()
    }
    // 恢复自动滚动状态
    isSticking.value = true
    isAutoScrollEnabled.value = true
    isUserScrolledUp.value = false
  }

  // === 智能滚动决策 ===

  const scrollBatcher = createRafBatcher(
    (req: { context: ScrollTriggerContext; instant: boolean }) => {
      void req.context
      if (req.instant) {
        scrollToBottomInstant()
      } else {
        scrollToBottomSmooth()
      }
    },
    (prev, next) => ({
      context: next.context,
      instant: prev.instant || next.instant,
    }),
  )

  /**
   * 执行智能滚动检查（节流版本）
   */
  const checkAndScroll = (context: ScrollTriggerContext = 'content-change') => {
    const el = scrollContainer.value
    if (!el) return

    const decision = computeSmartScrollDecision({
      context,
      atBottom: isAtBottom(),
      sticking: isSticking.value,
      autoEnabled: isAutoScrollEnabled.value,
      streamingInstant,
    })
    if (!decision.shouldScroll) return
    scrollBatcher.schedule({ context, instant: decision.instant })
  }

  /**
   * 流式更新专用滚动（高频调用优化）
   */
  const streamingScroll = () => {
    checkAndScroll('streaming')
  }

  // === 事件处理 ===

  /**
   * 处理用户滚动事件
   */
  const handleUserScroll = () => {
    const el = scrollContainer.value
    if (!el) return

    const currentScrollTop = el.scrollTop
    const scrollDelta = currentScrollTop - lastScrollTop
    const atBottom = isAtBottom()

    // 关键修复：即使在程序化滚动期间，如果检测到明显的向上滚动（负 delta），
    // 也判定为用户交互，从而中断自动滚动。
    const isUpwardIntent = scrollDelta < -userScrollSensitivity

    if (isProgrammaticScroll && !isUpwardIntent) {
      lastScrollTop = currentScrollTop
      return
    }

    // 检测用户是否主动向上滚动
    if (isUpwardIntent && !atBottom) {
      // 用户向上滚动：立即禁用自动滚动和粘附模式
      isAutoScrollEnabled.value = false
      isSticking.value = false
      isUserScrolledUp.value = true
    } else if (atBottom) {
      // 用户滚动到底部：恢复自动滚动
      isAutoScrollEnabled.value = true
      isSticking.value = true
      isUserScrolledUp.value = false
    }

    lastScrollTop = currentScrollTop
  }

  /**
   * 更新滚动状态信息（如是否可滚动、是否在底部等）
   */
  const updateScrollMetrics = () => {
    const el = scrollContainer.value
    if (!el) return

    isScrollable.value = el.scrollHeight > el.clientHeight + 1

    if (isAtBottom()) {
      isUserScrolledUp.value = false
    }
  }

  const { run: throttledScrollHandler } = createRafThrottle(() => {
    handleUserScroll()
    updateScrollMetrics()
  })

  /**
   * 处理容器尺寸变化
   */
  const handleResize = () => {
    updateScrollMetrics()
    if (isSticking.value) {
      // 如果之前在底部，尺寸变化后保持在底部
      requestAnimationFrame(() => {
        scrollToBottomInstant()
      })
    }
  }

  /**
   * 处理内容高度变化（带节流优化）
   */
  let heightChangeRafId: number | null = null
  const handleContentHeightChange = () => {
    if (heightChangeRafId !== null) return

    heightChangeRafId = requestAnimationFrame(() => {
      heightChangeRafId = null
      const el = scrollContainer.value
      if (!el) return

      const currentHeight = el.scrollHeight
      updateScrollMetrics()

      if (Math.abs(currentHeight - lastScrollHeight) > 1) {
        // 内容高度发生显著变化
        if (isSticking.value && isAutoScrollEnabled.value) {
          checkAndScroll('content-change')
        }
        lastScrollHeight = currentHeight
      }
    })
  }

  // === 生命周期管理 ===

  /**
   * 初始化滚动监听
   */
  const initScrollListeners = () => {
    const el = scrollContainer.value
    if (!el) return

    // 滚动事件监听
    el.addEventListener('scroll', throttledScrollHandler, { passive: true })

    // 初始化状态
    lastScrollTop = el.scrollTop
    lastScrollHeight = el.scrollHeight
    updateScrollMetrics()

    // ResizeObserver 监听容器尺寸变化
    if (watchResize && typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(() => {
        requestAnimationFrame(() => {
          handleResize()
        })
      })
      resizeObserver.observe(el)
    }

    // MutationObserver 监听内容变化
    if (typeof MutationObserver !== 'undefined') {
      mutationObserver = new MutationObserver(handleContentHeightChange)
      mutationObserver.observe(el, {
        childList: true,
        subtree: true,
        characterData: true,
      })
    }

    // 初始滚动到底部
    if (isSticking.value) {
      void nextTick(() => {
        scrollToBottomInstant()
      })
    }
  }

  /**
   * 清理滚动监听
   */
  const cleanupScrollListeners = () => {
    const el = scrollContainer.value
    if (el) {
      el.removeEventListener('scroll', throttledScrollHandler)
      gsap.killTweensOf(el)
    }

    if (resizeObserver) {
      resizeObserver.disconnect()
      resizeObserver = null
    }

    if (mutationObserver) {
      mutationObserver.disconnect()
      mutationObserver = null
    }

    scrollBatcher.cancel()

    if (programmaticScrollTimer) {
      clearTimeout(programmaticScrollTimer)
      programmaticScrollTimer = null
    }
  }

  // === 公共 API ===

  /**
   * 设置流式模式状态
   */
  const setStreamingMode = (streaming: boolean) => {
    isStreamingMode.value = streaming
    if (streaming && isSticking.value) {
      // 进入流式模式时，确保在底部
      scrollToBottomInstant()
    }
  }

  /**
   * 强制启用自动滚动
   */
  const enableAutoScroll = () => {
    isAutoScrollEnabled.value = true
    isSticking.value = true
    isUserScrolledUp.value = false
    scrollToBottom('smooth')
  }

  /**
   * 禁用自动滚动
   */
  const disableAutoScroll = () => {
    isAutoScrollEnabled.value = false
  }

  // === 监听容器变化 ===
  watch(scrollContainer, (newEl, oldEl) => {
    if (oldEl) {
      cleanupScrollListeners()
    }
    if (newEl) {
      initScrollListeners()
    }
  })

  // === 生命周期钩子 ===
  onMounted(() => {
    initScrollListeners()
  })

  onUnmounted(() => {
    cleanupScrollListeners()
  })

  return {
    // 状态
    isSticking,
    isAutoScrollEnabled,
    isUserScrolledUp,
    isScrollable,
    isStreamingMode,

    // 方法
    scrollToBottom,
    checkAndScroll,
    streamingScroll,
    setStreamingMode,
    enableAutoScroll,
    disableAutoScroll,

    // 工具方法
    isAtBottom,
    getScrollSnapshot,
  }
}
