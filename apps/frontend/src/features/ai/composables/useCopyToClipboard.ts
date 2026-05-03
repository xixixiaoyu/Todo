import { ref, onBeforeUnmount } from 'vue'

/**
 * 剪贴板复制 composable
 *
 * 封装 navigator.clipboard.writeText + 复制状态反馈 + 定时器自动清理，
 * 避免各组件重复实现相同逻辑。
 */
export function useCopyToClipboard(resetDelay = 2000) {
  const isCopied = ref(false)
  let timer: ReturnType<typeof setTimeout> | null = null

  onBeforeUnmount(() => {
    if (timer) {
      clearTimeout(timer)
      timer = null
    }
  })

  async function copy(text: string): Promise<boolean> {
    try {
      await navigator.clipboard.writeText(text)
      isCopied.value = true
      if (timer) clearTimeout(timer)
      timer = setTimeout(() => {
        isCopied.value = false
        timer = null
      }, resetDelay)
      return true
    } catch {
      isCopied.value = false
      return false
    }
  }

  return { isCopied, copy }
}
