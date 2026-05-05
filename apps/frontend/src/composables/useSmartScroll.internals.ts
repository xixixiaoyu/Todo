export type ScrollBehaviorOption = 'auto' | 'smooth' | 'instant'

export type ScrollTriggerContext =
  | 'streaming'
  | 'new-message'
  | 'content-change'
  | 'manual'
  | 'resize'

export function isAtBottomEl(el: HTMLElement | null, threshold: number): boolean {
  if (!el) return true
  const { scrollTop, scrollHeight, clientHeight } = el
  if (scrollHeight <= clientHeight + 1) return true
  const offsetFromBottom = Math.ceil(scrollHeight - scrollTop - clientHeight)
  return offsetFromBottom <= threshold + 2
}

export function getScrollSnapshotEl(el: HTMLElement | null) {
  if (!el) return null
  return {
    scrollTop: el.scrollTop,
    scrollHeight: el.scrollHeight,
    clientHeight: el.clientHeight,
    offsetFromBottom: el.scrollHeight - el.scrollTop - el.clientHeight,
  }
}

export function computeSmartScrollDecision(input: {
  context: ScrollTriggerContext
  atBottom: boolean
  sticking: boolean
  autoEnabled: boolean
  streamingInstant: boolean
}): { shouldScroll: boolean; instant: boolean } {
  switch (input.context) {
    case 'streaming':
      return {
        shouldScroll: (input.atBottom || input.sticking) && input.autoEnabled,
        instant: input.streamingInstant,
      }
    case 'new-message':
      return {
        shouldScroll: input.atBottom || (input.sticking && input.autoEnabled),
        instant: false,
      }
    case 'content-change':
      return {
        shouldScroll: (input.atBottom || input.sticking) && input.autoEnabled,
        instant: true,
      }
    case 'resize':
      return {
        shouldScroll: input.sticking,
        instant: true,
      }
    case 'manual':
      return {
        shouldScroll: true,
        instant: false,
      }
    default:
      return { shouldScroll: false, instant: false }
  }
}

export function createRafBatcher<T>(
  run: (value: T) => void,
  merge?: (prev: T, next: T) => T,
): { schedule: (value: T) => void; cancel: () => void } {
  let rafId: number | null = null
  let pending: T | null = null

  const schedule = (value: T) => {
    pending = pending === null ? value : merge ? merge(pending, value) : value
    if (rafId !== null) return
    rafId = requestAnimationFrame(() => {
      rafId = null
      const next = pending
      pending = null
      if (next === null) return
      run(next)
    })
  }

  const cancel = () => {
    if (rafId !== null) {
      cancelAnimationFrame(rafId)
      rafId = null
    }
    pending = null
  }

  return { schedule, cancel }
}

export function createRafThrottle(fn: () => void): { run: () => void } {
  let scheduled = false
  return {
    run: () => {
      if (scheduled) return
      scheduled = true
      requestAnimationFrame(() => {
        scheduled = false
        fn()
      })
    },
  }
}
