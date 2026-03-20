import { ref, watch, nextTick, onUnmounted, getCurrentInstance, type Ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useMarkdown } from '@/composables/useMarkdown'

function initCodeInteractions(container: HTMLElement, t: (key: string) => string) {
  const copyButtons = container.querySelectorAll('.code-copy-button')
  copyButtons.forEach((btn) => {
    const htmlBtn = btn as HTMLButtonElement
    if (htmlBtn.dataset.interacted === 'true') return
    htmlBtn.dataset.interacted = 'true'

    htmlBtn.addEventListener('click', () => {
      void (async () => {
        const code = htmlBtn.dataset.code
        if (!code) return

        try {
          await navigator.clipboard.writeText(decodeURIComponent(code))
          htmlBtn.classList.add('copied')
          const span = htmlBtn.querySelector('span')
          if (span) span.textContent = t('ai.copied')

          setTimeout(() => {
            htmlBtn.classList.remove('copied')
            if (span) span.textContent = t('ai.copy')
          }, 2000)
        } catch (err) {
          console.error('Failed to copy code:', err)
        }
      })()
    })
  })
}

function initMermaidInteractions(container: HTMLElement) {
  if (container.dataset.interacted === 'true') return
  container.dataset.interacted = 'true'

  const diagram = container.querySelector('.mermaid-diagram') as HTMLElement
  const svg = diagram?.querySelector('svg') as SVGElement
  if (!diagram || !svg) return

  let scale = 1
  let translateX = 0
  let translateY = 0
  let isDragging = false
  let startX = 0
  let startY = 0

  const updateTransform = () => {
    diagram.style.setProperty('--mermaid-scale', scale.toString())
    diagram.style.setProperty('--mermaid-translate-x', `${translateX}px`)
    diagram.style.setProperty('--mermaid-translate-y', `${translateY}px`)
  }

  container.addEventListener('click', (e) => {
    const btn = (e.target as HTMLElement).closest('.mermaid-zoom-btn') as HTMLButtonElement
    if (!btn) return

    const action = btn.dataset.action
    const step = 0.15

    if (action === 'copy') {
      const rawCode = container.dataset.raw
      if (!rawCode) return
      void navigator.clipboard.writeText(decodeURIComponent(rawCode))
      return
    }

    if (action === 'in') {
      scale = Math.min(scale + step, 3)
    } else if (action === 'out') {
      scale = Math.max(scale - step, 0.3)
    } else if (action === 'reset') {
      scale = 1
      translateX = 0
      translateY = 0
    } else {
      return
    }

    updateTransform()
  })

  svg.addEventListener('mousedown', (e) => {
    if ((e.target as HTMLElement).closest('.mermaid-zoom-btn')) return
    e.preventDefault()

    isDragging = true
    startX = e.clientX - translateX
    startY = e.clientY - translateY
    svg.style.cursor = 'grabbing'

    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (!isDragging) return
      translateX = moveEvent.clientX - startX
      translateY = moveEvent.clientY - startY
      updateTransform()
    }

    const handleMouseUp = () => {
      isDragging = false
      svg.style.cursor = 'grab'
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
  })
}

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

  const injectInteractions = () => {
    const container = containerRef.value
    if (!container) return

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
            initMermaidInteractions(containerElement as HTMLElement)
          }
          return
        }

        initMermaidInteractions(placeholder as HTMLElement)
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
