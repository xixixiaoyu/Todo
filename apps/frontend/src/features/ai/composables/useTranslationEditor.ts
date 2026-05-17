import { ref } from 'vue'

const STORAGE_KEY = 'lumina:translation-editor:isOpen'

// 模块级单例状态（从 localStorage 恢复）
const isOpen = ref(localStorage.getItem(STORAGE_KEY) === 'true')

/** 将 isOpen 持久化到 localStorage */
const persistOpen = (val: boolean) => localStorage.setItem(STORAGE_KEY, String(val))

/**
 * 翻译编辑器弹窗 Composable
 *
 * 与暂存箱弹窗同模式：模块级单例状态，持久化到 localStorage，
 * 可在任意入口（toolbar 按钮、modes 菜单、slash command）调用 openEditor()。
 */
export function useTranslationEditor() {
  const openEditor = () => {
    isOpen.value = true
    persistOpen(true)
  }

  const closeEditor = () => {
    isOpen.value = false
    persistOpen(false)
  }

  return { isOpen, openEditor, closeEditor }
}
