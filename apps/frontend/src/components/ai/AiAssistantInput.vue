<script setup lang="ts">
import { ref, onMounted, watch, nextTick } from 'vue'
import { useI18n } from 'vue-i18n'
import type { ChatSession } from '@/composables/useChatHistory'
import { X, AlertCircle, Image as ImageIcon, Square, ChevronLeft, Send } from 'lucide-vue-next'

const props = defineProps<{
  modelValue: string
  isInputDisabled: boolean
  isImageGenerationEnabled: boolean
  selectedImages: string[]
  isGenerating: boolean
  error: string | null
  lastActiveSession: ChatSession | null
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void
  (e: 'send'): void
  (e: 'stop'): void
  (e: 'navigatePrevious'): void
  (e: 'removeImage', index: number): void
  (e: 'triggerImageUpload'): void
  (e: 'paste', event: ClipboardEvent): void
  (e: 'handleImageUpload', event: Event): void
}>()

const { t } = useI18n()
const textareaRef = ref<HTMLTextAreaElement>()
const fileInputRef = ref<HTMLInputElement>()

const MIN_HEIGHT = 40
const MAX_HEIGHT = 160

const adjustTextareaHeight = () => {
  const textarea = textareaRef.value
  if (!textarea) return

  textarea.style.height = 'auto'
  const scrollHeight = textarea.scrollHeight
  const newHeight = Math.min(Math.max(scrollHeight, MIN_HEIGHT), MAX_HEIGHT)
  textarea.style.height = `${newHeight}px`

  // 处理滚动条显示
  textarea.style.overflowY = scrollHeight > MAX_HEIGHT ? 'auto' : 'hidden'
}

onMounted(() => {
  adjustTextareaHeight()
})

watch(
  () => props.modelValue,
  () => {
    nextTick(() => adjustTextareaHeight())
  },
)

const handleNewline = (event: KeyboardEvent) => {
  event.preventDefault()
  const textarea = event.target as HTMLTextAreaElement
  const start = textarea.selectionStart
  const end = textarea.selectionEnd
  const value = textarea.value
  const newValue = value.substring(0, start) + '\n' + value.substring(end)
  emit('update:modelValue', newValue)
  nextTick(() => {
    textarea.selectionStart = textarea.selectionEnd = start + 1
    textarea.scrollTop = textarea.scrollHeight
  })
}

defineExpose({
  focus: () => textareaRef.value?.focus(),
  adjustHeight: adjustTextareaHeight,
})
</script>

<template>
  <div
    class="input-container-refined relative flex flex-col rounded-2xl border border-border bg-card p-1.5 shadow-sm"
    :class="{ 'opacity-60 grayscale-[0.2]': isInputDisabled }"
  >
    <!-- 图片预览区域 -->
    <div v-if="selectedImages.length > 0" class="flex flex-wrap gap-2 px-2 pt-2">
      <div
        v-for="(img, index) in selectedImages"
        :key="index"
        class="group relative h-16 w-16 overflow-hidden rounded-lg border border-border bg-muted"
      >
        <img :src="img" class="h-full w-full object-cover" />
        <button
          class="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-black/50 text-white opacity-0 transition-opacity group-hover:opacity-100"
          @click="emit('removeImage', index)"
        >
          <X :size="12" />
        </button>
      </div>
    </div>

    <!-- 生图模式提示 -->
    <Transition
      enter-active-class="transition duration-200 ease-out"
      enter-from-class="transform -translate-y-1 opacity-0"
      enter-to-class="transform translate-y-0 opacity-100"
      leave-active-class="transition duration-150 ease-in"
      leave-from-class="transform translate-y-0 opacity-100"
      leave-to-class="transform -translate-y-1 opacity-0"
    >
      <div
        v-if="isImageGenerationEnabled"
        class="mb-2 flex items-center gap-1.5 px-1 text-[11px] text-amber-500/80 dark:text-amber-400/70"
      >
        <AlertCircle :size="12" />
        <span>{{ t('ai.imageGenerationDesc') }}</span>
      </div>
    </Transition>

    <textarea
      ref="textareaRef"
      :value="modelValue"
      rows="1"
      :placeholder="
        isInputDisabled
          ? t('ai.generating')
          : isImageGenerationEnabled
            ? t('ai.imagePromptPlaceholder')
            : t('ai.placeholder')
      "
      class="w-full resize-none bg-transparent px-3 pt-2.5 pb-1 text-[15px] text-foreground outline-none placeholder:text-muted-foreground/30 leading-relaxed transition-colors"
      :disabled="isInputDisabled"
      @input="(e) => emit('update:modelValue', (e.target as HTMLTextAreaElement).value)"
      @keydown.enter.exact.prevent="emit('send')"
      @keydown.enter.shift.exact="handleNewline"
      @paste="(e) => emit('paste', e)"
    />

    <div class="flex items-center justify-between px-1.5 pb-1.5">
      <div class="flex items-center gap-1.5">
        <!-- 图片上传按钮 -->
        <button
          class="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground transition-all hover:bg-accent hover:text-foreground active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
          :title="t('ai.uploadImage')"
          :disabled="isInputDisabled || selectedImages.length >= 4"
          @click="emit('triggerImageUpload')"
        >
          <ImageIcon :size="16" />
        </button>
        <input
          ref="fileInputRef"
          type="file"
          accept="image/*"
          multiple
          class="hidden"
          @change="(e) => emit('handleImageUpload', e)"
        />

        <!-- 停止生成按钮 -->
        <button
          v-if="isGenerating && !error"
          class="animate-stop-pulse flex items-center gap-1.5 rounded-lg bg-red-500 px-3 py-1.5 text-[12px] font-bold text-white transition-all hover:bg-red-600 active:scale-95"
          @click="emit('stop')"
        >
          <Square :size="12" class="fill-current" />
          <span>{{ t('ai.stop') }}</span>
        </button>

        <!-- 导航按钮 -->
        <button
          class="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground transition-all hover:bg-accent hover:text-foreground active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
          :title="t('ai.previousSession')"
          :disabled="isGenerating || !lastActiveSession"
          @click="emit('navigatePrevious')"
        >
          <ChevronLeft :size="16" />
        </button>
      </div>

      <button
        class="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-primary-foreground transition-all shadow-sm"
        :class="[
          isInputDisabled || (!modelValue.trim() && selectedImages.length === 0)
            ? 'cursor-not-allowed bg-primary/20 scale-95'
            : 'animate-button-pop bg-primary hover:bg-primary-hover hover:scale-105 active:scale-95 shadow-primary/20',
        ]"
        :disabled="isInputDisabled || (!modelValue.trim() && selectedImages.length === 0)"
        @click="emit('send')"
      >
        <Send :size="18" />
      </button>
    </div>
  </div>
</template>
