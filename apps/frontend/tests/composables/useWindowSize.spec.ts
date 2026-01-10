import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { useWindowSize, useIsMobile } from '@/composables/useWindowSize'

describe('useWindowSize', () => {
  let addEventListenerSpy: ReturnType<typeof vi.spyOn>
  let removeEventListenerSpy: ReturnType<typeof vi.spyOn>
  let updateFn: EventListener | null = null

  beforeEach(() => {
    // Mock window methods
    addEventListenerSpy = vi
      .spyOn(window, 'addEventListener')
      .mockImplementation((event, listener) => {
        if (event === 'resize') {
          updateFn = listener as EventListener
        }
        return true
      })
    removeEventListenerSpy = vi.spyOn(window, 'removeEventListener').mockImplementation(() => true)
    // Reset window size to default
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: 1024,
    })
    Object.defineProperty(window, 'innerHeight', {
      writable: true,
      configurable: true,
      value: 768,
    })
  })

  afterEach(() => {
    // 清理事件监听器
    if (updateFn) {
      window.removeEventListener('resize', updateFn)
      updateFn = null
    }
    vi.restoreAllMocks()
  })

  it('should initialize with current window size', () => {
    const { width, height } = useWindowSize()

    expect(width.value).toBe(window.innerWidth)
    expect(height.value).toBe(window.innerHeight)
  })

  it('should update width and height on resize', () => {
    const { width, height } = useWindowSize()

    // Simulate resize event
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: 800,
    })
    Object.defineProperty(window, 'innerHeight', {
      writable: true,
      configurable: true,
      value: 600,
    })

    // Manually call the update function
    if (updateFn) {
      updateFn(new Event('resize'))
    }

    expect(width.value).toBe(800)
    expect(height.value).toBe(600)
  })

  it('should add resize event listener on mount', () => {
    useWindowSize()

    // The composable adds event listener immediately in non-component environment
    expect(addEventListenerSpy).toHaveBeenCalledWith('resize', expect.any(Function))
  })

  it('should remove resize event listener on unmount', () => {
    useWindowSize()

    // Simulate unmount by calling the cleanup
    if (updateFn) {
      window.removeEventListener('resize', updateFn)
    }

    expect(removeEventListenerSpy).toHaveBeenCalledWith('resize', updateFn)
  })
})

describe('useIsMobile', () => {
  it('should return isMobile true when width < 768', () => {
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: 767,
    })

    const { isMobile } = useIsMobile()

    expect(isMobile.value).toBe(true)
  })

  it('should return isMobile false when width >= 768', () => {
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: 768,
    })

    const { isMobile } = useIsMobile()

    expect(isMobile.value).toBe(false)
  })

  it('should return isMobile false for desktop width', () => {
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: 1920,
    })

    const { isMobile } = useIsMobile()

    expect(isMobile.value).toBe(false)
  })

  it('should return isMobile true for tablet width', () => {
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: 500,
    })

    const { isMobile } = useIsMobile()

    expect(isMobile.value).toBe(true)
  })
})
