<script setup lang="ts">
import { ref, watch, nextTick, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useMarkdown } from '@/composables/useMarkdown'

const props = defineProps<{
  content: string
  isStreaming: boolean
  isMobile: boolean
}>()

const { t } = useI18n()
const { renderMarkdown, getMermaidSvgMap } = useMarkdown()

const containerRef = ref<HTMLDivElement>()
const renderedHtml = ref('')

// 注入交互逻辑（Mermaid 和 代码块）
function injectInteractions() {
  const container = containerRef.value
  if (!container) return

  // 1. 处理 Mermaid SVG 注入与交互
  const svgMap = getMermaidSvgMap()
  if (svgMap.size > 0) {
    svgMap.forEach((fullHtml, placeholderId) => {
      const placeholder = container.querySelector(`#${placeholderId}`)
      if (placeholder) {
        if (placeholder.getAttribute('data-processed') !== 'true') {
          const tempWrapper = document.createElement('div')
          tempWrapper.innerHTML = fullHtml
          const containerElement = tempWrapper.querySelector('.mermaid-container')
          if (containerElement && placeholder.parentNode) {
            containerElement.setAttribute('data-processed', 'true')
            placeholder.parentNode.replaceChild(containerElement, placeholder)
            initMermaidInteractions(containerElement as HTMLElement)
          }
        } else {
          initMermaidInteractions(placeholder as HTMLElement)
        }
      }
    })
  }

  // 2. 处理代码块复制按钮
  initCodeInteractions(container)
}

// 初始化代码块交互
function initCodeInteractions(container: HTMLElement) {
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

// 初始化 Mermaid 图表交互（缩放与拖拽）
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

  // 缩放按钮处理
  container.addEventListener('click', (e) => {
    void (async () => {
      const btn = (e.target as HTMLElement).closest('.mermaid-zoom-btn') as HTMLButtonElement
      if (!btn) return

      const action = btn.dataset.action
      if (action === 'copy') {
        const rawCode = container.dataset.raw
        if (rawCode) {
          try {
            await navigator.clipboard.writeText(decodeURIComponent(rawCode))
            const originalInner = btn.innerHTML
            btn.innerHTML =
              '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-green-500"><polyline points="20 6 9 17 4 12"></polyline></svg>'
            setTimeout(() => {
              btn.innerHTML = originalInner
            }, 2000)
          } catch (err) {
            console.error('Failed to copy mermaid code:', err)
          }
        }
        return
      }

      if (action === 'in') scale = Math.min(scale + 0.2, 5)
      else if (action === 'out') scale = Math.max(scale - 0.2, 0.5)
      else if (action === 'reset') {
        scale = 1
        translateX = 0
        translateY = 0
      }
      updateTransform()
    })()
  })

  // 鼠标滚轮缩放
  diagram.addEventListener(
    'wheel',
    (e) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault()
        const delta = e.deltaY > 0 ? -0.1 : 0.1
        scale = Math.min(Math.max(scale + delta, 0.5), 5)
        updateTransform()
      }
    },
    { passive: false },
  )

  // 拖拽平移
  svg.addEventListener('mousedown', (e) => {
    if (scale <= 1 && translateX === 0 && translateY === 0) return
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

// 渲染 Markdown 内容
let renderTimer: ReturnType<typeof setTimeout> | null = null

// 组件卸载时清理定时器
onUnmounted(() => {
  if (renderTimer) {
    clearTimeout(renderTimer)
    renderTimer = null
  }
})

async function updateRenderedContent(immediate = false) {
  const content = props.content
  const streaming = props.isStreaming

  if (!content) return

  // 如果是流式输出，且非立即执行，则进行节流处理
  if (streaming && !immediate) {
    if (renderTimer) return
    renderTimer = setTimeout(() => {
      renderTimer = null
      void (async () => {
        renderedHtml.value = await renderMarkdown(props.content, true)
        void nextTick(injectInteractions)
      })()
    }, 60) // 约 16fps，平衡流畅度与渲染开销
    return
  }

  // 非流式或强制立即执行
  if (renderTimer) {
    clearTimeout(renderTimer)
    renderTimer = null
  }
  renderedHtml.value = await renderMarkdown(content, streaming)
  void nextTick(injectInteractions)
}

// 监听内容与状态变化
watch(
  [() => props.content, () => props.isStreaming],
  async (newValues, oldValues) => {
    const [newContent] = newValues
    const oldContent = oldValues ? oldValues[0] : undefined

    // 只有内容真正变化时才更新
    if (newContent !== oldContent) {
      await updateRenderedContent()
    }
  },
  { immediate: true },
)

// 当流式结束时，强制进行最后一次完整渲染
watch(
  () => props.isStreaming,
  async (streaming) => {
    if (!streaming) {
      await updateRenderedContent(true)
    }
  },
)

defineExpose({
  initCodeInteractions,
  injectInteractions,
})
</script>

<template>
  <div ref="containerRef">
    <div
      v-if="renderedHtml"
      class="markdown-content selectable relative break-words leading-relaxed select-text"
    >
      <!-- eslint-disable-next-line vue/no-v-html -->
      <div v-html="renderedHtml" />
    </div>

    <!-- AI 消息：兜底显示（渲染完成前或渲染失败时） -->
    <div
      v-else-if="content"
      :class="[
        'relative selectable select-text break-words leading-relaxed',
        isMobile ? 'text-[14px]' : 'text-[15px]',
      ]"
    >
      {{ content }}
    </div>
  </div>
</template>

<style scoped>
.markdown-content :deep(.hljs) {
  background: transparent;
  padding: 0;
}
</style>
