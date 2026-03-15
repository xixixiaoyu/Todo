<script setup lang="ts">
import { ref, nextTick, computed, onUnmounted, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useDraggable, useWindowSize } from '@vueuse/core'
import { useEscClose } from '@/composables/useEscClose'
import { GlobalSelectionManager } from '@/features/ai/utils/GlobalSelectionManager'
import { getAIStreamResponse, generateId, type ChatMessage } from '@/features/ai/services/aiService'
import ChatMessageMarkdown from '@/features/ai/components/ChatMessageMarkdown.vue'
import ChatMessageThinking from '@/features/ai/components/ChatMessageThinking.vue'
import { X, MessageSquare, LayoutTemplate, Send, ExternalLink } from 'lucide-vue-next'
import AiLuminaIcon from './AiLuminaIcon.vue'
import { useChat } from '@/features/ai/composables/useChat'

const props = defineProps<{
  container: HTMLElement | null | undefined
}>()

const emit = defineEmits<{
  (e: 'ask-selection', prompt: string): void
  (e: 'transfer-selection'): void
}>()

const { t } = useI18n()
const { messages: chatMessages, addMessagePair } = useChat()

const isAskButtonVisible = ref(false)
const isAskPanelOpen = ref(false)
const askButtonX = ref(0)
const askButtonY = ref(0)
const selectionText = ref('')
const questionText = ref('')

// 模式选择 - 最佳实践：默认使用浮窗回答，保持阅读心流
const askMode = ref<'chat' | 'float'>('float')

// 浮窗回答状态
const isResultOpen = ref(false)
const resultContent = ref('')
const resultThinking = ref('')
const isGeneratingResult = ref(false)
const resultError = ref('')
const lastSubmittedPrompt = ref('')
let floatingAbortController: AbortController | null = null

const resultMessage = computed<ChatMessage>(() => ({
  id: 'floating-result',
  role: 'assistant',
  content: resultContent.value,
  thinkingContent: resultThinking.value,
}))

const panelRef = ref<HTMLElement | null>(null)
const panelHandleRef = ref<HTMLElement | null>(null)
const resultPanelRef = ref<HTMLElement | null>(null)
const resultPanelHandleRef = ref<HTMLElement | null>(null)

const { width: windowWidth, height: windowHeight } = useWindowSize()
const isMobile = computed(() => windowWidth.value < 640)

const { x: panelX, y: panelY } = useDraggable(panelRef, {
  initialValue: { x: 0, y: 0 },
  handle: panelHandleRef,
  preventDefault: true,
})

const { x: resultX, y: resultY } = useDraggable(resultPanelRef, {
  initialValue: { x: 0, y: 0 },
  handle: resultPanelHandleRef,
  preventDefault: true,
})

const panelStyle = computed(() => ({
  left: `${panelX.value}px`,
  top: `${panelY.value}px`,
}))

const resultPanelStyle = computed(() => ({
  left: `${resultX.value}px`,
  top: `${resultY.value}px`,
}))

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}

function clampPanelIntoViewport(targetRef: typeof panelRef, x: typeof panelX, y: typeof panelY) {
  const el = targetRef.value
  if (!el) return
  const rect = el.getBoundingClientRect()
  const maxX = windowWidth.value - rect.width - 12
  const maxY = windowHeight.value - rect.height - 12
  x.value = clamp(x.value, 12, Math.max(12, maxX))
  y.value = clamp(y.value, 12, Math.max(12, maxY))
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

function closeResultPanel() {
  if (floatingAbortController) {
    floatingAbortController.abort()
    floatingAbortController = null
  }
  isGeneratingResult.value = false
  isResultOpen.value = false
}

useEscClose(isAskPanelOpen, closeAskPanel)
useEscClose(isResultOpen, closeResultPanel)

function getSelectionInContainer() {
  const root = props.container
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

  askButtonX.value = clamp(baseX, 12, windowWidth.value - 48)
  askButtonY.value = clamp(baseY + 8, 12, windowHeight.value - 48)
}

function openAskPanel() {
  if (!selectionText.value.trim()) return

  isAskPanelOpen.value = true
  isAskButtonVisible.value = false

  panelX.value = clamp(askButtonX.value, 12, windowWidth.value - 360)
  panelY.value = clamp(askButtonY.value + 8, 12, windowHeight.value - 220)

  void nextTick(() => {
    clampPanelIntoViewport(panelRef, panelX, panelY)
    const input = panelRef.value?.querySelector('input') as HTMLInputElement | null
    input?.focus()
  })
}

async function submitAsk() {
  if (!selectionText.value.trim() || !questionText.value.trim()) return

  if (askMode.value === 'chat') {
    emit('ask-selection', buildAskPrompt(selectionText.value, questionText.value))
    closeAskPanel()
    selectionText.value = ''
  } else {
    await submitAskFloating()
  }
}

async function submitAskFloating() {
  const prompt = buildAskPrompt(selectionText.value, questionText.value)
  lastSubmittedPrompt.value = prompt
  if (floatingAbortController) {
    floatingAbortController.abort()
  }
  const requestController = new AbortController()
  floatingAbortController = requestController

  // 记录位置以便浮窗出现在相同位置
  const initialX = panelX.value
  const initialY = panelY.value

  closeAskPanel()
  isResultOpen.value = true
  resultContent.value = ''
  resultThinking.value = ''
  resultError.value = ''
  isGeneratingResult.value = true

  resultX.value = initialX
  resultY.value = initialY

  void nextTick(() => {
    clampPanelIntoViewport(resultPanelRef, resultX, resultY)
  })

  try {
    // 最佳实践：携带当前会话的历史消息作为上下文，确保 AI 理解当前语境
    const contextMessages = [
      ...chatMessages.value.map((msg) => ({
        id: msg.id,
        role: msg.role,
        content: msg.content,
      })),
      { id: generateId(), role: 'user', content: prompt },
    ] as ChatMessage[]

    await getAIStreamResponse(
      contextMessages,
      (chunk) => {
        if (chunk === '[DONE]') {
          isGeneratingResult.value = false
        } else if (chunk === '[ABORTED]') {
          isGeneratingResult.value = false
        } else {
          resultContent.value += chunk
        }
      },
      (thinking) => {
        resultThinking.value += thinking
      },
      undefined,
      {
        abortSignal: requestController.signal,
      },
    )
  } catch (err) {
    resultError.value = err instanceof Error ? err.message : String(err)
    isGeneratingResult.value = false
  } finally {
    if (floatingAbortController === requestController) {
      floatingAbortController = null
    }
  }
}

function transferToChat() {
  if (!lastSubmittedPrompt.value || !resultContent.value) return

  // 最佳实践：直接转存已有回答，避免重复生成，保持会话连贯
  addMessagePair(lastSubmittedPrompt.value, resultContent.value, resultThinking.value)

  // 通知父组件打开侧边栏（如果未打开）
  emit('transfer-selection')

  closeResultPanel()
  selectionText.value = ''
  questionText.value = ''
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

let registeredEl: HTMLElement | null = null
let detachContainerEvents: (() => void) | null = null

const attachToContainer = (el: HTMLElement | null) => {
  if (detachContainerEvents) {
    detachContainerEvents()
    detachContainerEvents = null
  }

  if (registeredEl) {
    GlobalSelectionManager.getInstance().unregister(registeredEl)
    registeredEl = null
  }

  if (!el) return

  registeredEl = el
  GlobalSelectionManager.getInstance().register(registeredEl, {
    onSelectionChange: onDocSelectionChange,
    onOutsideClick: onDocMouseDown,
  })

  const onMouseUp = () => updateAskAnchor()
  const onKeyUp = () => updateAskAnchor()
  const onTouchEnd = () => updateAskAnchor()

  el.addEventListener('mouseup', onMouseUp)
  el.addEventListener('keyup', onKeyUp)
  el.addEventListener('touchend', onTouchEnd)

  detachContainerEvents = () => {
    el.removeEventListener('mouseup', onMouseUp)
    el.removeEventListener('keyup', onKeyUp)
    el.removeEventListener('touchend', onTouchEnd)
  }
}

watch(
  () => props.container,
  (el) => {
    attachToContainer(el ?? null)
  },
  { immediate: true },
)

watch([windowWidth, windowHeight], () => {
  if (isAskPanelOpen.value) clampPanelIntoViewport(panelRef, panelX, panelY)
  if (isResultOpen.value) clampPanelIntoViewport(resultPanelRef, resultX, resultY)
  if (isAskButtonVisible.value) updateAskAnchor()
})

onUnmounted(() => {
  if (floatingAbortController) {
    floatingAbortController.abort()
    floatingAbortController = null
  }
  if (detachContainerEvents) detachContainerEvents()
  if (registeredEl) {
    GlobalSelectionManager.getInstance().unregister(registeredEl)
  }
})

defineExpose({ updateAskAnchor })
</script>

<template>
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
      class="fixed z-[230] w-[min(400px,calc(100vw-24px))] rounded-2xl border border-border/30 bg-card/70 shadow-2xl backdrop-blur-3xl"
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
      </div>

      <div class="space-y-4 p-4">
        <input
          v-model="questionText"
          class="h-10 w-full rounded-xl border border-border/30 bg-background/40 px-3 text-sm text-foreground outline-none ring-0 placeholder:text-muted-foreground/70 focus:border-primary/40 focus:bg-background/55"
          :placeholder="t('ai.askSelectionPlaceholder')"
          @keydown.enter.prevent="submitAsk"
        />

        <div class="flex items-center justify-between gap-3">
          <div class="flex items-center gap-1 rounded-xl bg-muted/40 p-1 shrink-0">
            <button
              type="button"
              class="flex items-center gap-1.5 whitespace-nowrap rounded-lg px-2.5 py-1.5 text-[11px] font-medium transition-all"
              :class="
                askMode === 'chat'
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              "
              @click="askMode = 'chat'"
            >
              <MessageSquare :size="13" />
              {{ t('ai.askSelectionModeChat') }}
            </button>
            <button
              type="button"
              class="flex items-center gap-1.5 whitespace-nowrap rounded-lg px-2.5 py-1.5 text-[11px] font-medium transition-all"
              :class="
                askMode === 'float'
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              "
              @click="askMode = 'float'"
            >
              <LayoutTemplate :size="13" />
              {{ t('ai.askSelectionModeFloat') }}
            </button>
          </div>

          <div class="flex items-center gap-2">
            <button
              type="button"
              class="h-9 whitespace-nowrap rounded-xl px-3 text-sm text-muted-foreground transition-colors hover:bg-muted/30 hover:text-foreground"
              @click="closeAskPanel"
            >
              {{ t('common.cancel') }}
            </button>
            <button
              type="button"
              class="group flex h-9 items-center gap-1.5 whitespace-nowrap rounded-xl bg-primary px-4 text-sm font-medium text-primary-foreground transition-all hover:bg-primary/90 disabled:opacity-50"
              :disabled="!questionText.trim()"
              @click="submitAsk"
            >
              <Send :size="14" class="transition-transform group-hover:translate-x-0.5" />
              {{ t('ai.send') }}
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- 浮窗回答结果面板 -->
    <div
      v-if="isResultOpen"
      ref="resultPanelRef"
      class="fixed z-[240] flex flex-col w-[min(480px,calc(100vw-24px))] max-h-[min(600px,calc(100vh-48px))] rounded-2xl border border-border/30 bg-card/70 shadow-2xl backdrop-blur-3xl"
      :style="{ ...resultPanelStyle, '--wails-draggable': 'no-drag' }"
      role="dialog"
      :aria-label="t('ai.askSelectionFloatingTitle')"
    >
      <div
        ref="resultPanelHandleRef"
        class="flex items-center justify-between gap-3 border-b border-border/20 px-4 py-3 cursor-move select-none"
      >
        <div class="flex items-center gap-2 min-w-0">
          <AiLuminaIcon :size="14" class="text-primary shrink-0" />
          <div class="truncate text-sm font-semibold text-foreground">
            {{ t('ai.askSelectionFloatingTitle') }}
          </div>
        </div>
        <button
          type="button"
          class="shrink-0 rounded-lg p-1 text-muted-foreground transition-colors hover:bg-muted/30 hover:text-foreground"
          :aria-label="t('common.close')"
          @click="closeResultPanel"
        >
          <X :size="16" />
        </button>
      </div>

      <div class="flex-1 overflow-y-auto p-4 space-y-4">
        <ChatMessageThinking
          v-if="resultThinking"
          :message="resultMessage"
          :is-streaming="isGeneratingResult"
          :has-content="!!resultContent"
        />

        <ChatMessageMarkdown
          v-if="resultContent"
          :content="resultContent"
          :is-streaming="isGeneratingResult"
          :is-mobile="isMobile"
        />

        <div
          v-if="isGeneratingResult && !resultContent"
          class="flex items-center gap-2 text-xs text-muted-foreground"
        >
          <div
            class="h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent"
          />
          {{ t('ai.generating') }}
        </div>

        <div v-if="resultError" class="rounded-lg bg-destructive/10 p-3 text-xs text-destructive">
          {{ resultError }}
        </div>
      </div>

      <!-- 结果面板底部：转存对话 -->
      <div
        v-if="!isGeneratingResult && resultContent"
        class="shrink-0 border-t border-border/20 bg-muted/5 px-4 py-3"
      >
        <button
          type="button"
          class="flex w-full items-center justify-center gap-2 rounded-xl border border-primary/20 bg-primary/5 px-3 py-2 text-xs font-medium text-primary transition-all hover:bg-primary/10 active:scale-[0.98]"
          @click="transferToChat"
        >
          <ExternalLink :size="14" />
          {{ t('ai.askSelectionTransferToChat') }}
        </button>
      </div>
    </div>
  </Teleport>
</template>
