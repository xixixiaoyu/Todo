import { onMounted, onUnmounted } from 'vue'

export interface KeyboardShortcut {
  /** 按键（不区分大小写），如 's', 'm', 't' */
  key: string
  /** 是否需要 Meta（Mac 的 ⌘）/ Ctrl 修饰键 */
  mod?: boolean
  /** 是否需要 Shift */
  shift?: boolean
  /** 回调 */
  handler: () => void
}

let registeredCount = 0

/**
 * 注册全局键盘快捷键。
 * 自动处理 Mac（⌘）与 Windows/Linux（Ctrl）的修饰键差异。
 * 模块级单例：多次调用只注册一次全局监听，避免 View + Drawer 同时挂载时重复触发。
 */
export function useKeyboardShortcuts(shortcuts: KeyboardShortcut[]) {
  // 防止 View 和 Drawer 同时注册导致快捷键二次触发
  if (registeredCount > 0) return

  registeredCount++
  const isMac = typeof navigator !== 'undefined' && /Mac|iPod|iPhone|iPad/.test(navigator.platform)

  function onKeydown(e: KeyboardEvent) {
    // 在输入框中不触发全局快捷键
    const tag = (e.target as HTMLElement)?.tagName
    if (
      tag === 'INPUT' ||
      tag === 'TEXTAREA' ||
      tag === 'SELECT' ||
      (e.target as HTMLElement)?.isContentEditable
    ) {
      return
    }

    for (const s of shortcuts) {
      const modValid = isMac ? !!s.mod === e.metaKey : !!s.mod === e.ctrlKey
      if (e.key.toLowerCase() === s.key.toLowerCase() && modValid && !!s.shift === e.shiftKey) {
        e.preventDefault()
        s.handler()
        return
      }
    }
  }

  onMounted(() => document.addEventListener('keydown', onKeydown))
  onUnmounted(() => {
    document.removeEventListener('keydown', onKeydown)
    registeredCount--
  })
}
