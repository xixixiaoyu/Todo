import { computed, onUnmounted, toValue } from 'vue'
import type { MaybeRefOrGetter, Ref } from 'vue'
import { useMediaQuery } from '@vueuse/core'

export function useHoverPopover(params: {
  open: Ref<boolean>
  openDelayMs?: number
  closeDelayMs?: number
  enabled?: MaybeRefOrGetter<boolean>
}) {
  const openDelayMs = params.openDelayMs ?? 0
  const closeDelayMs = params.closeDelayMs ?? 150
  const canHover = useMediaQuery('(hover: hover) and (pointer: fine)')
  const isEnabled = computed(() => {
    const enabled = params.enabled === undefined ? true : toValue(params.enabled)
    return enabled && canHover.value
  })
  let timer: ReturnType<typeof setTimeout> | null = null

  const clear = () => {
    if (!timer) return
    clearTimeout(timer)
    timer = null
  }

  const onMouseEnter = () => {
    if (!isEnabled.value) return
    clear()
    if (openDelayMs > 0) {
      timer = setTimeout(() => {
        params.open.value = true
      }, openDelayMs)
    } else {
      params.open.value = true
    }
  }

  const onMouseLeave = () => {
    if (!isEnabled.value) return
    clear()
    timer = setTimeout(() => {
      params.open.value = false
    }, closeDelayMs)
  }

  onUnmounted(() => {
    clear()
  })

  return { onMouseEnter, onMouseLeave, clear }
}
