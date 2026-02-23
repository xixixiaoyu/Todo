<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { ChatSession } from '@/features/ai/composables/useChatHistory'
import type { ParsedFile } from '@/composables/useFileParsing'
import { Image as ImageIcon, Square, ChevronLeft, Send } from 'lucide-vue-next'

const props = defineProps<{
  isMobile: boolean
  isInputDisabled: boolean
  isGenerating: boolean
  error: string | null
  lastActiveSession: ChatSession | null
  modelValue: string
  selectedImages: string[]
  parsedFiles: ParsedFile[]
  completedFilesCount: number
}>()

const emit = defineEmits<{
  (e: 'triggerFileUpload'): void
  (e: 'stop'): void
  (e: 'navigatePrevious'): void
  (e: 'send'): void
}>()

const { t } = useI18n()

const totalAttachments = computed(() => props.selectedImages.length + props.parsedFiles.length)
const canSend = computed(() => {
  if (props.isInputDisabled) return false
  if (props.modelValue.trim()) return true
  if (props.selectedImages.length > 0) return true
  return props.completedFilesCount > 0
})
</script>

<template>
  <div :class="['flex items-center justify-between px-2.5 pt-1 pb-2', isMobile ? 'gap-1' : '']">
    <div class="flex items-center gap-1">
      <button
        :class="[
          'flex items-center justify-center rounded-lg text-muted-foreground transition-all hover:bg-accent hover:text-foreground active:scale-95 disabled:cursor-not-allowed disabled:opacity-50',
          isMobile ? 'h-8 w-8' : 'h-7 w-7',
        ]"
        :title="t('ai.uploadFile')"
        :disabled="isInputDisabled || totalAttachments >= 10"
        @click="emit('triggerFileUpload')"
      >
        <ImageIcon :size="isMobile ? 18 : 16" />
      </button>

      <button
        v-if="isGenerating && !error"
        :class="[
          'animate-stop-pulse flex items-center gap-1.5 rounded-lg bg-red-500 font-bold text-white transition-all hover:bg-red-600 active:scale-95',
          isMobile ? 'h-8 px-2.5 text-[11px]' : 'px-3 py-1.5 text-[12px]',
        ]"
        @click="emit('stop')"
      >
        <Square :size="12" class="fill-current" />
        <span>{{ t('ai.stop') }}</span>
      </button>

      <button
        :class="[
          'flex items-center justify-center rounded-lg text-muted-foreground transition-all hover:bg-accent hover:text-foreground active:scale-95 disabled:cursor-not-allowed disabled:opacity-50',
          isMobile ? 'h-8 w-8' : 'h-7 w-7',
        ]"
        :title="t('ai.previousSession')"
        :disabled="isGenerating || !lastActiveSession"
        @click="emit('navigatePrevious')"
      >
        <ChevronLeft :size="isMobile ? 18 : 16" />
      </button>
    </div>

    <button
      :class="[
        'flex shrink-0 items-center justify-center rounded-xl text-primary-foreground transition-all shadow-sm',
        isMobile ? 'h-8 w-8' : 'h-9 w-9',
        !canSend
          ? 'cursor-not-allowed bg-primary/20 scale-95'
          : 'animate-button-pop bg-primary hover:bg-primary-hover hover:scale-105 active:scale-95 shadow-primary/20',
      ]"
      :disabled="!canSend"
      @click="emit('send')"
    >
      <Send :size="isMobile ? 16 : 18" />
    </button>
  </div>
</template>
