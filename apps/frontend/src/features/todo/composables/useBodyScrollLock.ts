const BODY_SCROLL_LOCK_COUNT_KEY = 'todoSheetLockCount'
const BODY_SCROLL_LOCK_PREV_OVERFLOW_KEY = 'todoSheetPrevOverflow'
const BODY_SCROLL_LOCK_PREV_TOUCH_ACTION_KEY = 'todoSheetPrevTouchAction'

function getBodyLockCount(): number {
  if (typeof document === 'undefined') return 0
  return Number(document.body.dataset[BODY_SCROLL_LOCK_COUNT_KEY] ?? '0')
}

export function lockBodyScroll(): void {
  if (typeof document === 'undefined') return

  const body = document.body
  const currentCount = getBodyLockCount()

  if (currentCount === 0) {
    body.dataset[BODY_SCROLL_LOCK_PREV_OVERFLOW_KEY] = body.style.overflow
    body.dataset[BODY_SCROLL_LOCK_PREV_TOUCH_ACTION_KEY] = body.style.touchAction
    body.style.overflow = 'hidden'
    body.style.touchAction = 'none'
  }

  body.dataset[BODY_SCROLL_LOCK_COUNT_KEY] = String(currentCount + 1)
}

export function unlockBodyScroll(): void {
  if (typeof document === 'undefined') return

  const body = document.body
  const currentCount = getBodyLockCount()

  if (currentCount <= 1) {
    body.style.overflow = body.dataset[BODY_SCROLL_LOCK_PREV_OVERFLOW_KEY] ?? ''
    body.style.touchAction = body.dataset[BODY_SCROLL_LOCK_PREV_TOUCH_ACTION_KEY] ?? ''
    delete body.dataset[BODY_SCROLL_LOCK_COUNT_KEY]
    delete body.dataset[BODY_SCROLL_LOCK_PREV_OVERFLOW_KEY]
    delete body.dataset[BODY_SCROLL_LOCK_PREV_TOUCH_ACTION_KEY]
    return
  }

  body.dataset[BODY_SCROLL_LOCK_COUNT_KEY] = String(currentCount - 1)
}

export function useBodyScrollLock(): {
  lockBodyScroll: () => void
  unlockBodyScroll: () => void
} {
  return {
    lockBodyScroll,
    unlockBodyScroll,
  }
}
