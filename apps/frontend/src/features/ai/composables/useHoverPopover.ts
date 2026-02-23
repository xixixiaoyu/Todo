import { onUnmounted, type Ref } from 'vue'

export function useHoverPopover(params: { open: Ref<boolean>; delayMs?: number }) {
  const delayMs = params.delayMs ?? 150
  let timer: ReturnType<typeof setTimeout> | null = null

  const clear = () => {
    if (!timer) return
    clearTimeout(timer)
    timer = null
  }

  const onMouseEnter = () => {
    clear()
    params.open.value = true
  }

  const onMouseLeave = () => {
    clear()
    timer = setTimeout(() => {
      params.open.value = false
    }, delayMs)
  }

  onUnmounted(() => {
    clear()
  })

  return { onMouseEnter, onMouseLeave, clear }
}
