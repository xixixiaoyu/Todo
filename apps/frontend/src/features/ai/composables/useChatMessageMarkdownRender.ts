import { ref, watch, nextTick, onUnmounted, getCurrentInstance } from 'vue'
import type { Ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useMarkdown } from '@/composables/useMarkdown'
import {
  initCodeInteractions,
  initMermaidInteractions,
} from '@/composables/markdown/mermaid-interactions'
import { useMermaidEditor } from '@/features/ai/composables/useMermaidEditor'

export function useChatMessageMarkdownRender(params: {
  content: Ref<string>
  isStreaming: Ref<boolean>
}) {
  const { t } = useI18n()
  const { renderMarkdown, getMermaidSvgMap } = useMarkdown()

  const containerRef = ref<HTMLDivElement>()
  const renderedHtml = ref('')
  let pendingRenderAfterSelection = false
  let selectionPollTimer: ReturnType<typeof setTimeout> | null = null

  const clearSelectionPollTimer = () => {
    if (!selectionPollTimer) return
    clearTimeout(selectionPollTimer)
    selectionPollTimer = null
  }

  const hasActiveSelectionInContainer = () => {
    const container = containerRef.value
    if (!container) return false

    const selection = window.getSelection?.()
    if (!selection || selection.rangeCount === 0 || selection.isCollapsed) return false

    try {
      const range = selection.getRangeAt(0)
      return container.contains(range.commonAncestorContainer)
    } catch {
      return false
    }
  }

  const { openEditor } = useMermaidEditor()

  const injectInteractions = () => {
    const container = containerRef.value
    if (!container) return

    const mermaidConfig = {
      onEdit: (code: string) => openEditor(code),
    }

    const svgMap = getMermaidSvgMap()
    if (svgMap.size > 0) {
      svgMap.forEach((fullHtml, placeholderId) => {
        const placeholder = container.querySelector(`#${placeholderId}`)
        if (!placeholder) return

        if (placeholder.getAttribute('data-processed') !== 'true') {
          const tempWrapper = document.createElement('div')
          tempWrapper.innerHTML = fullHtml
          const containerElement = tempWrapper.querySelector('.mermaid-container')
          if (containerElement && placeholder.parentNode) {
            containerElement.setAttribute('data-processed', 'true')
            placeholder.parentNode.replaceChild(containerElement, placeholder)
            initMermaidInteractions(containerElement as HTMLElement, false, mermaidConfig)
          }
          return
        }

        initMermaidInteractions(placeholder as HTMLElement, false, mermaidConfig)
      })
    }

    initCodeInteractions(container, t)
  }

  let renderTimer: ReturnType<typeof setTimeout> | null = null
  const scheduleRenderAfterSelection = () => {
    pendingRenderAfterSelection = true
    if (selectionPollTimer) return

    selectionPollTimer = setTimeout(() => {
      selectionPollTimer = null

      if (hasActiveSelectionInContainer()) {
        scheduleRenderAfterSelection()
        return
      }

      if (!pendingRenderAfterSelection) return
      pendingRenderAfterSelection = false
      void updateRenderedContent(true)
    }, 120)
  }

  if (getCurrentInstance()) {
    onUnmounted(() => {
      if (renderTimer) {
        clearTimeout(renderTimer)
        renderTimer = null
      }
      clearSelectionPollTimer()
    })
  }

  async function updateRenderedContent(immediate = false) {
    const content = params.content.value
    const streaming = params.isStreaming.value

    if (!content) {
      renderedHtml.value = ''
      pendingRenderAfterSelection = false
      clearSelectionPollTimer()
      return
    }

    if (hasActiveSelectionInContainer()) {
      scheduleRenderAfterSelection()
      return
    }

    if (streaming && !immediate) {
      if (renderTimer) return
      renderTimer = setTimeout(() => {
        renderTimer = null
        if (hasActiveSelectionInContainer()) {
          scheduleRenderAfterSelection()
          return
        }
        void (async () => {
          pendingRenderAfterSelection = false
          clearSelectionPollTimer()
          renderedHtml.value = await renderMarkdown(params.content.value, true)
          void nextTick(injectInteractions)
        })()
      }, 60)
      return
    }

    if (renderTimer) {
      clearTimeout(renderTimer)
      renderTimer = null
    }
    pendingRenderAfterSelection = false
    clearSelectionPollTimer()
    renderedHtml.value = await renderMarkdown(content, streaming)
    void nextTick(injectInteractions)
  }

  watch(
    [() => params.content.value, () => params.isStreaming.value],
    async (newValues, oldValues) => {
      const [newContent] = newValues
      const oldContent = oldValues ? oldValues[0] : undefined
      if (newContent !== oldContent) {
        await updateRenderedContent()
      }
    },
    { immediate: true },
  )

  watch(
    () => params.isStreaming.value,
    async (streaming) => {
      if (!streaming) {
        await updateRenderedContent(true)
      }
    },
  )

  return {
    containerRef,
    renderedHtml,
    injectInteractions,
    initCodeInteractions: (container: HTMLElement) => initCodeInteractions(container, t),
  }
}
