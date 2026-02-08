import { ref } from 'vue'

interface UseResizableOptions {
  initialWidth?: number
  minWidth?: number
  maxWidth?: number | (() => number)
  onResize?: (width: number) => void
  onResizeEnd?: (width: number) => void
  direction?: 'horizontal' | 'vertical'
}

export function useResizable(options: UseResizableOptions = {}) {
  const {
    initialWidth = 320,
    minWidth = 240,
    maxWidth = Infinity,
    onResize,
    onResizeEnd,
    direction = 'horizontal',
  } = options

  const width = ref(initialWidth)
  const isResizing = ref(false)
  const startPos = ref(0)
  const startSize = ref(0)

  const stopResize = () => {
    isResizing.value = false
    document.body.style.cursor = ''
    document.body.style.userSelect = ''
    window.removeEventListener('mousemove', onMove)
    window.removeEventListener('mouseup', stopResize)
    onResizeEnd?.(width.value)
  }

  const onMove = (e: MouseEvent) => {
    if (!isResizing.value) return

    const delta =
      direction === 'horizontal' ? e.clientX - startPos.value : e.clientY - startPos.value
    const newSize = startSize.value + delta

    const currentMaxWidth = typeof maxWidth === 'function' ? maxWidth() : maxWidth
    const clampedSize = Math.max(minWidth, Math.min(newSize, currentMaxWidth))

    width.value = clampedSize
    onResize?.(clampedSize)
  }

  const startResize = (e: MouseEvent) => {
    e.preventDefault()
    isResizing.value = true
    startPos.value = direction === 'horizontal' ? e.clientX : e.clientY
    startSize.value = width.value

    document.body.style.cursor = direction === 'horizontal' ? 'ew-resize' : 'ns-resize'
    document.body.style.userSelect = 'none'

    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', stopResize)
  }

  return {
    width,
    isResizing,
    startResize,
    stopResize,
  }
}
