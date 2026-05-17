import { ref } from 'vue'

const STORAGE_KEY_OPEN = 'lumina:todo-panel:isOpen'

/** 模块级单例状态（从 localStorage 恢复） */
const isOpen = ref(localStorage.getItem(STORAGE_KEY_OPEN) === 'true')

const persistOpen = (val: boolean) => localStorage.setItem(STORAGE_KEY_OPEN, String(val))

/**
 * Todo 面板核心 Composable
 * 与 useMermaidEditor / useScratchpadEditor 保持一致的交互模式
 */
export function useTodoPanel() {
  const openPanel = () => {
    isOpen.value = true
    persistOpen(true)
  }

  const closePanel = () => {
    isOpen.value = false
    persistOpen(false)
  }

  const togglePanel = () => {
    if (isOpen.value) {
      closePanel()
    } else {
      openPanel()
    }
  }

  return {
    isOpen,
    openPanel,
    closePanel,
    togglePanel,
  }
}
