import { ref, watch, onUnmounted } from 'vue'
import { renderMermaidSvg } from '@/composables/markdown/mermaid-render'
import { getCurrentTheme } from '@/composables/markdown/utils'
import { useTheme } from '@/composables/useTheme'

// 模块级单例状态
const isOpen = ref(false)
const code = ref('')
const svgHtml = ref('')
const error = ref<string | null>(null)
const isRendering = ref(false)

let debounceTimer: ReturnType<typeof setTimeout> | null = null

const DEFAULT_MERMAID_TEMPLATE = ''

/**
 * Mermaid 编辑器核心 Composable
 */
export function useMermaidEditor(options: { debounceMs?: number } = {}) {
  const { debounceMs = 300 } = options
  const { theme: themeState } = useTheme()

  const render = async (targetCode: string) => {
    if (!targetCode.trim()) {
      svgHtml.value = ''
      error.value = null
      isRendering.value = false
      return
    }

    isRendering.value = true
    const currentTheme = getCurrentTheme()
    const result = await renderMermaidSvg(targetCode, currentTheme)

    // 只有当编辑器仍然打开且代码匹配时才更新（防止竞态）
    if (isOpen.value && code.value === targetCode) {
      svgHtml.value = result.svg
      error.value = result.error
      isRendering.value = false
    }
  }

  const openEditor = (initialCode?: string) => {
    const finalCode =
      initialCode !== undefined && initialCode.trim() !== ''
        ? initialCode
        : DEFAULT_MERMAID_TEMPLATE
    code.value = finalCode
    isOpen.value = true
    // 立即渲染，无防抖
    void render(finalCode)
  }

  const closeEditor = () => {
    isOpen.value = false
    error.value = null
    if (debounceTimer) {
      clearTimeout(debounceTimer)
      debounceTimer = null
    }
  }

  const updateCode = (newCode: string) => {
    code.value = newCode

    if (debounceTimer) {
      clearTimeout(debounceTimer)
    }

    debounceTimer = setTimeout(() => {
      void render(newCode)
    }, debounceMs)
  }

  // 监听主题变化，自动重绘
  watch(themeState, () => {
    if (isOpen.value) {
      void render(code.value)
    }
  })

  onUnmounted(() => {
    if (debounceTimer) {
      clearTimeout(debounceTimer)
    }
  })

  return {
    isOpen,
    code,
    svgHtml,
    error,
    isRendering,
    openEditor,
    closeEditor,
    updateCode,
  }
}
