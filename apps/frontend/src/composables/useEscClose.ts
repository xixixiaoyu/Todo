import { onUnmounted, watch, type Ref } from 'vue'

// 全局栈，存储所有活跃的关闭回调
const escStack: (() => void)[] = []

// 全局监听器处理函数
const globalHandleEsc = (e: KeyboardEvent) => {
  if (e.key === 'Escape' && escStack.length > 0) {
    // 仅执行栈顶（最后加入）的回调
    const topHandler = escStack[escStack.length - 1]
    topHandler()
  }
}

// 确保全局监听器只注册一次
let isGlobalListenerRegistered = false
function ensureGlobalListener() {
  if (typeof window !== 'undefined' && !isGlobalListenerRegistered) {
    window.addEventListener('keydown', globalHandleEsc)
    isGlobalListenerRegistered = true
  }
}

/**
 * 监听 ESC 键关闭逻辑的公共 Composable
 * 支持多层级堆叠：只有最上层的组件会响应 ESC 键
 * @param isOpen 弹窗/抽屉是否打开的响应式引用
 * @param onClose 关闭时的回调函数
 */
export function useEscClose(isOpen: Ref<boolean>, onClose: () => void) {
  ensureGlobalListener()

  const addToStack = () => {
    if (!escStack.includes(onClose)) {
      escStack.push(onClose)
    }
  }

  const removeFromStack = () => {
    const index = escStack.indexOf(onClose)
    if (index !== -1) {
      escStack.splice(index, 1)
    }
  }

  watch(
    isOpen,
    (value) => {
      if (value) {
        addToStack()
      } else {
        removeFromStack()
      }
    },
    { immediate: true },
  )

  onUnmounted(() => {
    removeFromStack()
  })
}
