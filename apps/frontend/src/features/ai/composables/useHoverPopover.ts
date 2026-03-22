import { computed, onUnmounted, toValue, type MaybeRefOrGetter, type Ref } from 'vue'
import { useMediaQuery } from '@vueuse/core'

export function useHoverPopover(params: {
  open: Ref<boolean>
  delayMs?: number
  enabled?: MaybeRefOrGetter<boolean>
}) {
  const delayMs = params.delayMs ?? 150
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
    params.open.value = true
  }

  const onMouseLeave = () => {
    if (!isEnabled.value) return
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
