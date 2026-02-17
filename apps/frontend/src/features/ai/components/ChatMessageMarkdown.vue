<script setup lang="ts">
import { ref, watch, nextTick, onMounted, onUnmounted, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useDraggable, useWindowSize } from '@vueuse/core'
import { useMarkdown } from '@/composables/useMarkdown'
import { useEscClose } from '@/composables/useEscClose'
import { GlobalSelectionManager } from '@/features/ai/utils/GlobalSelectionManager'

const props = defineProps<{
  content: string
  isStreaming: boolean
  isMobile: boolean
}>()

const emit = defineEmits<{
  (e: 'ask-selection', prompt: string): void
}>()

const { t } = useI18n()
const { renderMarkdown, getMermaidSvgMap } = useMarkdown()

const containerRef = ref<HTMLDivElement>()
const renderedHtml = ref('')

const isAskButtonVisible = ref(false)
const isAskPanelOpen = ref(false)
const askButtonX = ref(0)
const askButtonY = ref(0)
const selectionText = ref('')
const questionText = ref('')

const panelRef = ref<HTMLElement | null>(null)
const panelHandleRef = ref<HTMLElement | null>(null)
const { width: windowWidth, height: windowHeight } = useWindowSize()
const { x: panelX, y: panelY } = useDraggable(panelRef, {
  initialValue: { x: 0, y: 0 },
  handle: panelHandleRef,
  preventDefault: true,
})

const panelStyle = computed(() => ({
  left: `${panelX.value}px`,
  top: `${panelY.value}px`,
}))

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}

function clampPanelIntoViewport() {
  const panel = panelRef.value
  if (!panel) return

  const margin = 12
  const panelRect = panel.getBoundingClientRect()
  const maxX = Math.max(margin, windowWidth.value - panelRect.width - margin)
  const maxY = Math.max(margin, windowHeight.value - panelRect.height - margin)
  panelX.value = clamp(panelX.value, margin, maxX)
  panelY.value = clamp(panelY.value, margin, maxY)
}

function buildAskPrompt(selected: string, question: string) {
  const quote = selected.trim()
  const q = question.trim()
  const quoted = quote.replace(/\n/g, '\n> ')
  return `${q}\n\n---\n\n${t('ai.askSelectionQuote')}\n\n> ${quoted}`
}

function closeAskPanel() {
  isAskPanelOpen.value = false
  questionText.value = ''
}

useEscClose(isAskPanelOpen, closeAskPanel)

function getSelectionInContainer() {
  const root = containerRef.value
  if (!root) return null

  const selection = window.getSelection?.()
  if (!selection || selection.rangeCount === 0) return null

  const range = selection.getRangeAt(0)
  const commonAncestor = range.commonAncestorContainer
  if (!root.contains(commonAncestor)) return null

  const text = selection.toString().trim()
  if (!text) return null

  const rect = range.getBoundingClientRect()
  const clientRects = range.getClientRects()
  const fallbackRect = clientRects.length > 0 ? clientRects[0] : null
  const safeRect = rect.width || rect.height ? rect : fallbackRect
  return { text, rect: safeRect }
}

function updateAskAnchor() {
  const info = getSelectionInContainer()
  if (!info) {
    isAskButtonVisible.value = false
    selectionText.value = ''
    return
  }

  selectionText.value = info.text
  isAskButtonVisible.value = true

  const rect = info.rect
  const baseX = rect ? rect.left : 12
  const baseY = rect ? rect.bottom : 12

  const x = clamp(baseX, 12, windowWidth.value - 48)
  const y = clamp(baseY + 8, 12, windowHeight.value - 48)

  askButtonX.value = x
  askButtonY.value = y
}

function openAskPanel() {
  if (!selectionText.value.trim()) return

  isAskPanelOpen.value = true
  isAskButtonVisible.value = false

  const x = clamp(askButtonX.value, 12, windowWidth.value - 360)
  const y = clamp(askButtonY.value + 8, 12, windowHeight.value - 220)
  panelX.value = x
  panelY.value = y

  void nextTick(() => {
    clampPanelIntoViewport()
    const input = panelRef.value?.querySelector('input') as HTMLInputElement | null
    input?.focus()
  })
}

function submitAsk() {
  if (!selectionText.value.trim() || !questionText.value.trim()) return
  emit('ask-selection', buildAskPrompt(selectionText.value, questionText.value))
  closeAskPanel()
  selectionText.value = ''
}

function onDocSelectionChange() {
  if (isAskPanelOpen.value) return
  updateAskAnchor()
}

function onDocMouseDown(e: MouseEvent) {
  if (!isAskPanelOpen.value) return
  const target = e.target as Node | null
  if (!target) return
  if (panelRef.value?.contains(target)) return
  closeAskPanel()
}

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

let registeredEl: HTMLElement | null = null

onMounted(() => {
  if (containerRef.value) {
    registeredEl = containerRef.value
    GlobalSelectionManager.getInstance().register(registeredEl, {
      onSelectionChange: onDocSelectionChange,
      onOutsideClick: onDocMouseDown,
    })
  }
})

onUnmounted(() => {
  if (registeredEl) {
    GlobalSelectionManager.getInstance().unregister(registeredEl)
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

watch([windowWidth, windowHeight], () => {
  if (isAskPanelOpen.value) {
    clampPanelIntoViewport()
  }
  if (isAskButtonVisible.value) {
    updateAskAnchor()
  }
})

defineExpose({
  initCodeInteractions,
  injectInteractions,
})
</script>

<template>
  <div
    ref="containerRef"
    @mouseup="updateAskAnchor"
    @keyup="updateAskAnchor"
    @touchend="updateAskAnchor"
  >
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

  <Teleport to="body">
    <button
      v-if="isAskButtonVisible && selectionText"
      type="button"
      class="fixed z-[220] rounded-full border border-border/30 bg-card/70 px-3 py-1.5 text-xs font-medium text-foreground shadow-lg backdrop-blur-2xl transition-colors hover:bg-card/85 active:scale-[0.98]"
      :style="{ left: `${askButtonX}px`, top: `${askButtonY}px`, '--wails-draggable': 'no-drag' }"
      @click="openAskPanel"
    >
      {{ t('ai.askSelectionAction') }}
    </button>

    <div
      v-if="isAskPanelOpen"
      ref="panelRef"
      class="fixed z-[230] w-[min(360px,calc(100vw-24px))] rounded-2xl border border-border/30 bg-card/70 shadow-2xl backdrop-blur-3xl"
      :style="{ ...panelStyle, '--wails-draggable': 'no-drag' }"
      role="dialog"
      :aria-label="t('ai.askSelectionTitle')"
    >
      <div
        ref="panelHandleRef"
        class="flex items-center justify-between gap-3 border-b border-border/20 px-4 py-3 cursor-move select-none"
      >
        <div class="min-w-0">
          <div class="truncate text-sm font-semibold text-foreground">
            {{ t('ai.askSelectionTitle') }}
          </div>
          <div class="truncate text-[11px] text-muted-foreground">
            {{ selectionText }}
          </div>
        </div>

        <button
          type="button"
          class="shrink-0 rounded-lg px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted/30 hover:text-foreground"
          :aria-label="t('common.close')"
          @click="closeAskPanel"
        >
          {{ t('common.close') }}
        </button>
      </div>

      <div class="space-y-3 p-4">
        <input
          v-model="questionText"
          class="h-10 w-full rounded-xl border border-border/30 bg-background/40 px-3 text-sm text-foreground outline-none ring-0 placeholder:text-muted-foreground/70 focus:border-primary/40 focus:bg-background/55"
          :placeholder="t('ai.askSelectionPlaceholder')"
          @keydown.enter.prevent="submitAsk"
        />

        <div class="flex items-center justify-end gap-2">
          <button
            type="button"
            class="h-9 rounded-xl px-3 text-sm text-muted-foreground transition-colors hover:bg-muted/30 hover:text-foreground"
            @click="closeAskPanel"
          >
            {{ t('common.cancel') }}
          </button>
          <button
            type="button"
            class="h-9 rounded-xl bg-primary px-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
            :disabled="!questionText.trim()"
            @click="submitAsk"
          >
            {{ t('ai.send') }}
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.markdown-content :deep(.hljs) {
  background: transparent;
  padding: 0;
}
</style>
