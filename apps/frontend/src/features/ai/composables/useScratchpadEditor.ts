import { ref } from 'vue'

const STORAGE_KEY_OPEN = 'lumina:scratchpad-editor:isOpen'

// 模块级单例状态（从 localStorage 恢复）
const isOpen = ref(localStorage.getItem(STORAGE_KEY_OPEN) === 'true')

/** 将 isOpen 持久化到 localStorage */
const persistOpen = (val: boolean) => localStorage.setItem(STORAGE_KEY_OPEN, String(val))

/**
 * Scratchpad 编辑器核心 Composable
 */
export function useScratchpadEditor() {
  const openEditor = () => {
    isOpen.value = true
    persistOpen(true)
  }

  const closeEditor = () => {
    isOpen.value = false
    persistOpen(false)
  }

  return {
    isOpen,
    openEditor,
    closeEditor,
  }
}
