<script setup lang="ts">
import { ref, nextTick, watch, computed, useId, onMounted, onUnmounted, type Component } from 'vue'
import { useWindowSize } from '@vueuse/core'
import { useI18n } from 'vue-i18n'
import {
  AlertCircle,
  Image as ImageIcon,
  Clover,
  GraduationCap,
  Send,
  BookOpen,
  Languages,
} from 'lucide-vue-next'
import type { ParsedFile } from '@/composables/useFileParsing'
import type { ThinkingMode } from '@/features/ai/composables/useAIConfig/types'
import AiAssistantInputAttachments from '@/features/ai/components/AiAssistantInputAttachments.vue'
import AiAssistantInputSlashCommands from '@/features/ai/components/AiAssistantInputSlashCommands.vue'
import { AI_UPLOAD_ACCEPT } from '@/features/ai/constants/attachments'
import { useAiModeItems, type AiModeId } from '@/features/ai/composables/useAiModeItems'

const props = defineProps<{
  modelValue: string
  isImageGenerationEnabled: boolean
  isTodoAssistantEnabled: boolean
  thinkingLevel: ThinkingMode
  isTeachingEnabled: boolean
  isNovelEnabled: boolean
  isTranslationEnabled: boolean
  selectedImages: string[]
  parsedFiles: ParsedFile[]
  isGenerating: boolean
  error: string | null
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void
  (e: 'send'): void
  (e: 'removeImage', index: number): void
  (e: 'removeFile', id: string): void
  (e: 'triggerFileUpload'): void
  (e: 'handleFileUpload', event: Event): void
  (e: 'paste', event: ClipboardEvent): void
  (e: 'toggleTodo'): void
  (e: 'toggleImageGen'): void
  (e: 'update:thinkingLevel', level: ThinkingMode): void
  (e: 'toggleTeaching'): void
  (e: 'toggleNovel'): void
  (e: 'toggleTranslation'): void
}>()

const { t } = useI18n()
const textareaRef = ref<HTMLTextAreaElement>()
const fileInputRef = ref<HTMLInputElement>()
const textareaId = useId()
const fileInputId = useId()

// 快捷指令相关
const showSlashCommands = ref(false)
const selectedCommandIndex = ref(0)

// slash 菜单中每个模式对应的图标（与 Toolbar 下拉可能不同，由各入口自定义）
// 多模型协同讨论 (discuss) 在 Toolbar 有独立入口，故不在 slash 菜单重复曝露
const SLASH_COMMAND_ICON: Partial<Record<AiModeId, Component>> = {
  todo: Clover,
  teaching: GraduationCap,
  draw: ImageIcon,
  novel: BookOpen,
  translation: Languages,
}

const modeItems = useAiModeItems({
  todo: { active: () => props.isTodoAssistantEnabled, toggle: () => emit('toggleTodo') },
  teaching: { active: () => props.isTeachingEnabled, toggle: () => emit('toggleTeaching') },
  draw: { active: () => props.isImageGenerationEnabled, toggle: () => emit('toggleImageGen') },
  novel: { active: () => props.isNovelEnabled, toggle: () => emit('toggleNovel') },
  translation: {
    active: () => props.isTranslationEnabled,
    toggle: () => emit('toggleTranslation'),
  },
})

const slashCommands = computed(() =>
  modeItems.value
    .map((m) => {
      const icon = SLASH_COMMAND_ICON[m.id]
      return icon ? { id: m.id, title: m.title, icon, active: m.active, action: m.toggle } : null
    })
    .filter((x): x is NonNullable<typeof x> => x != null),
)

const handleSlashCommand = (index: number) => {
  slashCommands.value[index].action()
  emit('update:modelValue', '')
  showSlashCommands.value = false
  void nextTick(() => textareaRef.value?.focus())
}

const { width: windowWidth } = useWindowSize()
const isMobile = computed(() => windowWidth.value < 640)
const completedFilesCount = computed(
  () => props.parsedFiles.filter((f) => f.status === 'completed').length,
)

const canSend = computed(() => {
  if (props.isGenerating) return false
  if (props.modelValue.trim()) return true
  if (props.selectedImages.length > 0) return true
  return completedFilesCount.value > 0
})

const handleKeydown = (event: KeyboardEvent) => {
  if (showSlashCommands.value) {
    if (event.key === 'ArrowUp') {
      event.preventDefault()
      selectedCommandIndex.value =
        (selectedCommandIndex.value - 1 + slashCommands.value.length) % slashCommands.value.length
    } else if (event.key === 'ArrowDown') {
      event.preventDefault()
      selectedCommandIndex.value = (selectedCommandIndex.value + 1) % slashCommands.value.length
    } else if (event.key === 'Enter') {
      event.preventDefault()
      handleSlashCommand(selectedCommandIndex.value)
    } else if (event.key === 'Escape') {
      event.preventDefault()
      showSlashCommands.value = false
    } else if (event.key === 'Backspace' && props.modelValue === '/') {
      showSlashCommands.value = false
    }
    return
  }

  if (event.key === '/' && !props.modelValue) {
    showSlashCommands.value = true
    selectedCommandIndex.value = 0
  }

  if (event.key === 'Enter' && !event.shiftKey) {
    if (isMobile.value) return
    event.preventDefault()
    if (canSend.value) emit('send')
  }
}

const MIN_HEIGHT = computed(() => (isMobile.value ? 36 : 40))
const MAX_HEIGHT = 160

const adjustTextareaHeight = () => {
  const textarea = textareaRef.value
  if (!textarea) return

  // 空内容时固定单行高度，避免 placeholder 干扰 scrollHeight 导致高度跳动
  const isEmpty = !textarea.value.trim()
  if (isEmpty) {
    textarea.style.height = `${MIN_HEIGHT.value}px`
    textarea.style.maxHeight = `${MIN_HEIGHT.value}px`
    textarea.style.overflowY = 'hidden'
    return
  }

  // 有内容时按 scrollHeight 自适应，支持换行自动撑高
  textarea.style.maxHeight = `${MAX_HEIGHT}px`
  textarea.style.height = 'auto'
  const scrollHeight = textarea.scrollHeight

  // 确保高度在最小和最大值之间
  const newHeight = Math.min(Math.max(scrollHeight, MIN_HEIGHT.value), MAX_HEIGHT)
  textarea.style.height = `${newHeight}px`

  // 处理滚动条显示
  textarea.style.overflowY = scrollHeight > MAX_HEIGHT ? 'auto' : 'hidden'
}

const handleClickOutside = (event: MouseEvent) => {
  if (showSlashCommands.value) {
    const target = event.target as HTMLElement
    if (!target.closest('.slash-commands-menu') && !target.closest('textarea')) {
      showSlashCommands.value = false
    }
  }
}

let resizeObserver: ResizeObserver | null = null

onMounted(() => {
  // 确保在 layout 稳定后进行初次高度调整
  void nextTick(() => {
    adjustTextareaHeight()
  })

  // 监听容器大小变化，确保在窗口缩放或抽屉展开时高度依然正确
  if (textareaRef.value) {
    resizeObserver = new ResizeObserver(() => {
      requestAnimationFrame(() => {
        adjustTextareaHeight()
      })
    })
    resizeObserver.observe(textareaRef.value)
  }

  window.addEventListener('click', handleClickOutside)
})

onUnmounted(() => {
  window.removeEventListener('click', handleClickOutside)
  if (resizeObserver) {
    resizeObserver.disconnect()
    resizeObserver = null
  }
})

watch(
  () => props.modelValue,
  (newVal) => {
    void nextTick(() => adjustTextareaHeight())
    if (showSlashCommands.value && !newVal.startsWith('/')) {
      showSlashCommands.value = false
    }
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
  void nextTick(() => {
    textarea.selectionStart = textarea.selectionEnd = start + 1
    textarea.scrollTop = textarea.scrollHeight
  })
}

defineExpose({
  focus: () => textareaRef.value?.focus(),
  adjustHeight: adjustTextareaHeight,
  triggerFileUpload: () => fileInputRef.value?.click(),
})
</script>

<template>
  <div
    :class="[
      'ai-assistant-composer input-container-refined relative flex flex-col rounded-[1.25rem] border border-[hsl(var(--ai-glass-border))] bg-[hsl(var(--ai-glass-bg))] shadow-[0_4px_20px_rgba(0,0,0,0.04)] transition-all duration-500 focus-within:border-primary/40 focus-within:shadow-[0_8px_32px_rgba(0,0,0,0.06)]',
      isMobile ? 'p-1 gap-0' : 'p-1 gap-0',
    ]"
  >
    <AiAssistantInputAttachments
      :selected-images="selectedImages"
      :parsed-files="parsedFiles"
      :is-mobile="isMobile"
      @remove-image="(index) => emit('removeImage', index)"
      @remove-file="(id) => emit('removeFile', id)"
    />

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
        class="mb-1 flex items-center gap-1.5 px-2 text-[11px] text-amber-500/80 dark:text-amber-400/70"
      >
        <AlertCircle :size="12" />
        <span>{{ t('ai.imageGenerationDesc') }}</span>
      </div>
    </Transition>

    <AiAssistantInputSlashCommands
      v-model:open="showSlashCommands"
      v-model:selected-index="selectedCommandIndex"
      :commands="slashCommands"
      @select="handleSlashCommand"
    />

    <label :for="textareaId" class="sr-only">{{ t('ai.placeholder') }}</label>
    <div class="flex items-end px-2 py-1.5">
      <textarea
        :id="textareaId"
        ref="textareaRef"
        name="ai-input"
        :value="modelValue"
        rows="1"
        autocapitalize="off"
        autocorrect="off"
        spellcheck="false"
        :placeholder="
          isGenerating
            ? t('ai.typeNextMessage')
            : isImageGenerationEnabled
              ? t('ai.imagePromptPlaceholder')
              : isTeachingEnabled
                ? t('ai.teachingPlaceholder')
                : isNovelEnabled
                  ? t('ai.novelPlaceholder')
                  : t('ai.placeholder')
        "
        :class="[
          'ai-assistant-textarea flex-1 resize-none bg-transparent text-foreground outline-none transition-colors',
          isMobile ? 'px-2 py-1' : 'px-2 py-1.5',
        ]"
        :style="{ minHeight: `${MIN_HEIGHT}px` }"
        @input="(e) => emit('update:modelValue', (e.target as HTMLTextAreaElement).value)"
        @keydown.exact="handleKeydown"
        @keydown.enter.shift.exact="handleNewline"
        @paste="(e) => emit('paste', e)"
      />

      <!-- 发送按钮内联 (全平台统一) -->
      <div class="flex items-center gap-2 pb-1 pr-1">
        <button
          :class="[
            'flex shrink-0 items-center justify-center rounded-xl text-primary-foreground transition-all shadow-sm',
            isMobile ? 'h-8 w-8' : 'h-8 w-8',
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
    </div>

    <label :for="fileInputId" class="sr-only">{{ t('ai.uploadFile') }}</label>
    <input
      :id="fileInputId"
      ref="fileInputRef"
      name="ai-file-upload"
      type="file"
      :accept="AI_UPLOAD_ACCEPT"
      multiple
      class="hidden"
      @change="(e) => emit('handleFileUpload', e)"
    />
  </div>
</template>
