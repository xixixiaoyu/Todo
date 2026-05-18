import { ref } from 'vue'

const STORAGE_KEY_OPEN = 'lumina:todo-panel:isOpen'

/** 模块级单例状态（从 localStorage 恢复） */
const isOpen = ref(localStorage.getItem(STORAGE_KEY_OPEN) === 'true')

/** 聚焦计数器 — 每次请求聚焦 Todo 面板时递增，用于侧边栏联动 */
const focusPanel = ref(0)

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

  /** 请求聚焦 Todo 面板 — 侧边栏消费此信号，弹窗忽略 */
  const requestFocus = () => {
    if (focusPanel.value > Number.MAX_SAFE_INTEGER - 1) {
      focusPanel.value = 0
    } else {
      focusPanel.value++
    }
  }

  return {
    isOpen,
    /** 聚焦信号计数器 — 每次请求聚焦 +1 */
    focusPanel,
    openPanel,
    closePanel,
    /** 请求聚焦 Todo 面板（侧边栏 + 弹窗通用） */
    requestFocus,
  }
}
