<script setup lang="ts">
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue'
import { useWindowSize, useDebounceFn } from '@vueuse/core'
import { useI18n } from 'vue-i18n'
import { Languages, Copy, Check, Loader2, AlertCircle } from 'lucide-vue-next'
import { useResizable } from '@/composables/useResizable'
import { useToast } from '@/composables/useToast'
import { detectLanguage, translateText } from '@/features/ai/services/translation'
import type { AIConfig } from '@/features/ai/composables/useAIConfig'

const props = defineProps<{
  config: AIConfig
}>()

const { t } = useI18n()
const { success: showToast } = useToast()

const STORAGE_KEY = 'ai-translation'

function loadTranslationState(): { input: string; output: string } {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) {
      const parsed = JSON.parse(saved) as { input?: string; output?: string }
      return { input: parsed.input ?? '', output: parsed.output ?? '' }
    }
  } catch {
    /* ignore */
  }
  return { input: '', output: '' }
}

const debouncedSave = useDebounceFn((input: string, output: string) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ input, output }))
  } catch {
    console.warn('[translation] Failed to persist translation state to localStorage')
  }
}, 500)

const saved = loadTranslationState()
const inputText = ref(saved.input)
const translatedText = ref(saved.output)
const isTranslating = ref(false)
const error = ref<string | null>(null)
const isCopied = ref(false)
let copyTimer: ReturnType<typeof setTimeout> | null = null

const { width: windowWidth } = useWindowSize()
const isMobile = computed(() => windowWidth.value < 640)

const panelRef = ref<HTMLElement>()
const inputRef = ref<HTMLTextAreaElement>()
const {
  width: leftPanelWidth,
  isResizing,
  startResize: startPanelResize,
} = useResizable({
  initialWidth: 300,
  minWidth: 200,
  maxWidth: () => (panelRef.value ? panelRef.value.offsetWidth * 0.7 : 500),
  onResizeEnd: () => {
    /* no-op */
  },
})

const canTranslate = computed(() => inputText.value.trim().length > 0 && !isTranslating.value)

const handleTranslate = async () => {
  if (!canTranslate.value) return

  const targetLang = detectLanguage(inputText.value) === 'zh' ? 'en' : 'zh'
  error.value = null
  isTranslating.value = true

  try {
    const result = await translateText(inputText.value, targetLang, props.config)
    translatedText.value = result
  } catch (err) {
    const message = err instanceof Error ? err.message : t('ai.translationError')
    error.value = message
  } finally {
    isTranslating.value = false
  }
}

const handleCopy = async () => {
  if (!translatedText.value || isCopied.value) return
  try {
    await navigator.clipboard.writeText(translatedText.value)
    isCopied.value = true
    showToast(t('ai.translationCopied'))
    if (copyTimer) clearTimeout(copyTimer)
    copyTimer = setTimeout(() => {
      isCopied.value = false
      copyTimer = null
    }, 2000)
  } catch (err) {
    console.error('Failed to copy translation:', err)
    showToast(t('ai.translationError'))
  }
}

const handleKeydown = (event: KeyboardEvent) => {
  if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
    event.preventDefault()
    void handleTranslate()
  }
}

// 持久化翻译内容 - 500ms 防抖避免高频 localStorage 写入
watch([inputText, translatedText], ([input, output]) => {
  void debouncedSave(input, output)
})

onMounted(() => {
  const textarea = inputRef.value
  if (textarea && inputText.value) {
    // 自动调整 textarea 高度
    textarea.style.height = 'auto'
    textarea.style.height = `${textarea.scrollHeight}px`
  }
})

onBeforeUnmount(() => {
  if (copyTimer) {
    clearTimeout(copyTimer)
    copyTimer = null
  }
})
</script>

<template>
  <div class="flex flex-col h-full">
    <!-- 头部标题 -->
    <div
      class="flex items-center gap-2 shrink-0 mx-4 mt-3 rounded-xl border border-primary/15 bg-primary/5 px-3 py-2"
    >
      <Languages :size="13" class="text-primary/60 shrink-0" />
      <span class="flex-1 text-xs font-medium text-foreground/80">{{
        t('ai.translationMode')
      }}</span>
    </div>

    <!-- 分栏容器 -->
    <div ref="panelRef" :class="['flex flex-1 min-h-0', isMobile ? 'flex-col' : 'flex-row']">
      <!-- 左侧：输入区 -->
      <div
        :class="['flex flex-col min-h-0', isMobile ? 'flex-1' : '']"
        :style="isMobile ? {} : { width: leftPanelWidth + 'px' }"
      >
        <label for="translation-input" class="sr-only">
          {{ t('ai.translationInputPlaceholder') }}
        </label>
        <textarea
          id="translation-input"
          ref="inputRef"
          v-model="inputText"
          class="translation-input flex-1 resize-none bg-transparent text-sm text-foreground outline-none p-4 leading-relaxed placeholder:text-muted-foreground/50"
          :placeholder="t('ai.translationInputPlaceholder')"
          @keydown="handleKeydown"
        />
        <div
          :class="[
            'flex items-center gap-2 px-4 pb-3 shrink-0',
            isMobile ? 'justify-center' : 'justify-end',
          ]"
        >
          <span v-if="isTranslating" class="text-xs text-muted-foreground">
            {{ t('ai.translationTranslating') }}
          </span>
          <button
            :class="[
              'flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all',
              canTranslate
                ? 'bg-primary text-primary-foreground hover:bg-primary-hover active:scale-95 shadow-sm'
                : 'cursor-not-allowed bg-muted text-muted-foreground',
            ]"
            :disabled="!canTranslate"
            @click="handleTranslate"
          >
            <Loader2 v-if="isTranslating" :size="12" class="animate-spin" />
            <Languages v-else :size="12" />
            <span>{{
              isTranslating ? t('ai.translationTranslating') : t('ai.translationTranslate')
            }}</span>
          </button>
        </div>
      </div>

      <!-- 拖拽手柄（仅 desktop） -->
      <div
        v-if="!isMobile"
        class="relative flex shrink-0 items-center justify-center group"
        role="separator"
        aria-orientation="vertical"
        :aria-valuenow="isResizing ? 50 : undefined"
      >
        <div
          class="h-full w-[1px] bg-border group-hover:bg-primary/30 transition-colors"
          :class="{ 'bg-primary/50': isResizing }"
        />
        <div
          class="absolute inset-y-0 flex w-3 cursor-ew-resize items-center justify-center -mx-1"
          :class="{ 'bg-primary/5': isResizing }"
          @mousedown="startPanelResize"
        >
          <div
            class="h-8 w-1 rounded-full transition-all"
            :class="isResizing ? 'bg-primary/30' : 'bg-border group-hover:bg-primary/20'"
          />
        </div>
      </div>

      <!-- 右侧：输出区 -->
      <div class="flex flex-col flex-1 min-h-0">
        <!-- 翻译结果 -->
        <div v-if="translatedText || isTranslating || error" class="flex-1 overflow-y-auto p-4">
          <!-- 加载状态 -->
          <div v-if="isTranslating" class="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 :size="14" class="animate-spin" />
            <span>{{ t('ai.translationTranslating') }}</span>
          </div>

          <!-- 错误状态 -->
          <div
            v-else-if="error"
            class="flex items-start gap-2 rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-600 dark:text-red-400"
          >
            <AlertCircle :size="14" class="mt-0.5 shrink-0" />
            <span>{{ error }}</span>
          </div>

          <!-- 译文 -->
          <div
            v-else
            class="text-sm text-foreground leading-relaxed whitespace-pre-wrap"
            role="region"
            aria-live="polite"
          >
            {{ translatedText }}
          </div>
        </div>

        <!-- 空状态 -->
        <div v-else class="flex-1 flex items-center justify-center">
          <p class="text-sm text-muted-foreground/40">
            {{ t('ai.translationResultPlaceholder') }}
          </p>
        </div>

        <!-- 底部操作栏 -->
        <div
          v-if="translatedText"
          :class="[
            'flex items-center gap-2 px-4 pb-3 shrink-0',
            isMobile ? 'justify-center' : 'justify-end',
          ]"
        >
          <button
            :class="[
              'flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all border active:scale-95',
              isCopied
                ? 'border-green-400/30 bg-green-400/10 text-green-600 dark:text-green-400'
                : 'border-border bg-muted/50 text-muted-foreground hover:bg-accent hover:text-foreground',
            ]"
            @click="handleCopy"
          >
            <Check v-if="isCopied" :size="12" />
            <Copy v-else :size="12" />
            <span>{{ isCopied ? t('ai.translationCopied') : t('ai.translationCopyResult') }}</span>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
