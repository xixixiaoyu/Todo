<script setup lang="ts">
import { ref, nextTick, computed, onUnmounted, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useDraggable, useWindowSize } from '@vueuse/core'
import { useEscClose } from '@/composables/useEscClose'
import { GlobalSelectionManager } from '@/features/ai/utils/GlobalSelectionManager'

const props = defineProps<{
  container: HTMLElement | null | undefined
}>()

const emit = defineEmits<{
  (e: 'ask-selection', prompt: string): void
}>()

const { t } = useI18n()

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
  const rect = panel.getBoundingClientRect()
  const maxX = windowWidth.value - rect.width - 12
  const maxY = windowHeight.value - rect.height - 12
  panelX.value = clamp(panelX.value, 12, Math.max(12, maxX))
  panelY.value = clamp(panelY.value, 12, Math.max(12, maxY))
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
  if (isAskPanelOpen.value) clampPanelIntoViewport()
  if (isAskButtonVisible.value) updateAskAnchor()
})

onUnmounted(() => {
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
