import { ref, watch, onUnmounted, getCurrentInstance } from 'vue'
import { renderMermaidSvg } from '@/composables/markdown/mermaid-render'
import { getCurrentTheme } from '@/composables/markdown/utils'
import { useTheme } from '@/composables/useTheme'
import {
  STORAGE_KEY_CODE,
  STORAGE_KEY_OPEN,
  DEFAULT_DEBOUNCE_MS,
} from '@/composables/markdown/mermaid'

// ---- 模块级单例状态（惰性初始化，无模块级副作用） ----
let instanceState: ReturnType<typeof createEditorState> | null = null
let instanceRefCount = 0

function createEditorState() {
  const isOpen = ref(false)
  const code = ref('')
  const svgHtml = ref('')
  const error = ref<string | null>(null)
  const isRendering = ref(false)

  let debounceTimer: ReturnType<typeof setTimeout> | null = null
  let abortController: AbortController | null = null
  let isInitialized = false

  /** 从 localStorage 恢复状态（仅首次调用） */
  const restoreState = () => {
    if (isInitialized) return
    isInitialized = true
    try {
      const savedOpen = localStorage.getItem(STORAGE_KEY_OPEN) === 'true'
      const savedCode = localStorage.getItem(STORAGE_KEY_CODE) ?? ''
      isOpen.value = savedOpen
      code.value = savedCode
    } catch {
      // localStorage 不可用，保持默认值
    }
  }

  const persistCode = (val: string) => {
    try {
      localStorage.setItem(STORAGE_KEY_CODE, val)
    } catch {
      /* noop */
    }
  }

  const persistOpen = (val: boolean) => {
    try {
      localStorage.setItem(STORAGE_KEY_OPEN, String(val))
    } catch {
      /* noop */
    }
  }

  const cancelRender = () => {
    if (abortController) {
      abortController.abort()
      abortController = null
    }
  }

  const render = async (targetCode: string) => {
    cancelRender()

    if (!targetCode.trim()) {
      svgHtml.value = ''
      error.value = null
      isRendering.value = false
      return
    }

    isRendering.value = true
    abortController = new AbortController()
    const currentController = abortController

    const currentTheme = getCurrentTheme()
    const result = await renderMermaidSvg(targetCode, currentTheme, currentController.signal)

    // 防止竞态：仅当编辑器仍打开、代码匹配且未被取消时更新
    if (currentController === abortController && isOpen.value && code.value === targetCode) {
      svgHtml.value = result.svg
      error.value = result.error
      isRendering.value = false
    }
  }

  const openEditor = (initialCode?: string) => {
    const finalCode =
      initialCode !== undefined && initialCode.trim() !== '' ? initialCode : code.value || ''
    code.value = finalCode
    isOpen.value = true
    persistCode(finalCode)
    persistOpen(true)
    void render(finalCode)
  }

  const closeEditor = () => {
    isOpen.value = false
    error.value = null
    persistOpen(false)
    cancelRender()
    if (debounceTimer) {
      clearTimeout(debounceTimer)
      debounceTimer = null
    }
  }

  const updateCode = (newCode: string) => {
    code.value = newCode
    persistCode(newCode)

    if (debounceTimer) {
      clearTimeout(debounceTimer)
    }

    debounceTimer = setTimeout(() => {
      void render(newCode)
    }, DEFAULT_DEBOUNCE_MS)
  }

  return {
    isOpen,
    code,
    svgHtml,
    error,
    isRendering,
    openEditor,
    closeEditor,
    updateCode,
    /** 仅供内部测试/清理使用 */
    _restoreState: restoreState,
    _cancelRender: cancelRender,
  }
}

/**
 * Mermaid 编辑器核心 Composable（单例模式）
 *
 * 多个组件共享同一编辑器状态。使用引用计数管理主题监听器生命周期。
 */
export function useMermaidEditor() {
  // 初始化或获取单例
  if (!instanceState) {
    instanceState = createEditorState()
  }

  const state = instanceState
  const { theme: themeState } = useTheme()
  const isInComponent = getCurrentInstance() !== null

  // 引用计数仅在组件上下文中管理；外部调用（如测试）不计入生命周期
  if (isInComponent) {
    instanceRefCount++
  }

  // 惰性恢复状态（仅首次调用执行）
  state._restoreState()

  // 监听主题变化，自动重绘
  const stopWatch = watch(
    () => themeState.value,
    () => {
      if (state.isOpen.value) {
        void (async () => {
          const currentTheme = getCurrentTheme()
          const result = await renderMermaidSvg(state.code.value, currentTheme)
          if (state.isOpen.value) {
            state.svgHtml.value = result.svg
            state.error.value = result.error
          }
        })()
      }
    },
  )

  // 清理：仅在组件上下文中注册生命周期钩子
  if (isInComponent) {
    onUnmounted(() => {
      instanceRefCount--
      stopWatch()
      if (instanceRefCount <= 0) {
        instanceState = null
      }
    })
  }

  // 页面刷新后恢复：如果编辑器曾经打开且有代码，自动重新渲染
  if (state.isOpen.value && state.code.value.trim()) {
    state._cancelRender()
    const currentTheme = getCurrentTheme()
    void renderMermaidSvg(state.code.value, currentTheme).then((result) => {
      if (state.isOpen.value) {
        state.svgHtml.value = result.svg
        state.error.value = result.error
      }
    })
  }

  return {
    isOpen: state.isOpen,
    code: state.code,
    svgHtml: state.svgHtml,
    error: state.error,
    isRendering: state.isRendering,
    openEditor: state.openEditor,
    closeEditor: state.closeEditor,
    updateCode: state.updateCode,
  }
}
