<script setup lang="ts">
import { ref, nextTick, watch, computed, useId, onMounted, onUnmounted } from 'vue'
import { useWindowSize } from '@vueuse/core'
import { useI18n } from 'vue-i18n'
import type { ChatSession } from '@/composables/useChatHistory'
import {
  X,
  AlertCircle,
  Image as ImageIcon,
  Square,
  ChevronLeft,
  Send,
  Clover,
  Users,
  Lightbulb,
  FileText,
  Loader2,
} from 'lucide-vue-next'
import type { ParsedFile } from '@/composables/useFileParsing'

const props = defineProps<{
  modelValue: string
  isInputDisabled: boolean
  isImageGenerationEnabled: boolean
  isTodoAssistantEnabled: boolean
  isDiscussionEnabled: boolean
  isThinkingEnabled: boolean
  selectedImages: string[]
  parsedFiles: ParsedFile[]
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
  (e: 'removeFile', id: string): void
  (e: 'triggerFileUpload'): void
  (e: 'handleFileUpload', event: Event): void
  (e: 'paste', event: ClipboardEvent): void
  (e: 'toggleTodo'): void
  (e: 'toggleDiscussion'): void
  (e: 'toggleImageGen'): void
  (e: 'toggleThinking'): void
}>()

const { t } = useI18n()
const textareaRef = ref<HTMLTextAreaElement>()
const fileInputRef = ref<HTMLInputElement>()
const textareaId = useId()
const fileInputId = useId()

// 快捷指令相关
const showSlashCommands = ref(false)
const selectedCommandIndex = ref(0)
const slashCommands = computed(() => [
  {
    id: 'thinking',
    title: t('ai.thinkingMode'),
    icon: Lightbulb,
    active: props.isThinkingEnabled,
    action: () => emit('toggleThinking'),
  },
  {
    id: 'todo',
    title: t('ai.todoAssistant'),
    icon: Clover,
    active: props.isTodoAssistantEnabled,
    action: () => emit('toggleTodo'),
  },
  {
    id: 'discuss',
    title: t('ai.discussionMode'),
    icon: Users,
    active: props.isDiscussionEnabled,
    action: () => emit('toggleDiscussion'),
  },
  {
    id: 'draw',
    title: t('ai.enableImageGeneration'),
    icon: ImageIcon,
    active: props.isImageGenerationEnabled,
    action: () => emit('toggleImageGen'),
  },
])

const handleSlashCommand = (index: number) => {
  slashCommands.value[index].action()
  emit('update:modelValue', '')
  showSlashCommands.value = false
  void nextTick(() => textareaRef.value?.focus())
}

const { width: windowWidth } = useWindowSize()
const isMobile = computed(() => windowWidth.value < 640)

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

  if (event.key === '/' && !props.modelValue && !props.isInputDisabled) {
    showSlashCommands.value = true
    selectedCommandIndex.value = 0
  }

  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault()
    emit('send')
  }
}

const MIN_HEIGHT = 40
const MAX_HEIGHT = 160

const adjustTextareaHeight = () => {
  const textarea = textareaRef.value
  if (!textarea) return

  // 使用更稳健的方式重置高度以获取准确的 scrollHeight
  // 先设为 auto 以允许它收缩到内容大小
  textarea.style.height = 'auto'
  const scrollHeight = textarea.scrollHeight

  // 确保高度在最小和最大值之间
  const newHeight = Math.min(Math.max(scrollHeight, MIN_HEIGHT), MAX_HEIGHT)
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
})
</script>

<template>
  <div
    :class="[
      'input-container-refined relative flex flex-col rounded-[1.5rem] border border-border/10 bg-background/60 shadow-[0_8px_32px_rgba(0,0,0,0.04)] backdrop-blur-2xl transition-all duration-300 focus-within:border-primary/30 focus-within:shadow-[0_8px_32px_rgba(var(--primary),0.05)]',
      isMobile ? 'p-1.5 gap-0' : 'p-1.5 gap-0',
      isInputDisabled ? 'opacity-60 grayscale-[0.2]' : '',
    ]"
  >
    <!-- 附件预览区域 (图片 + 文档) -->
    <div
      v-if="selectedImages.length > 0 || parsedFiles.length > 0"
      :class="['flex flex-wrap gap-2 px-2 pt-2', isMobile ? 'max-h-32 overflow-y-auto' : '']"
    >
      <!-- 图片预览 -->
      <div
        v-for="(img, index) in selectedImages"
        :key="`img-${index}`"
        :class="[
          'group relative overflow-hidden rounded-lg border border-border bg-muted',
          isMobile ? 'h-14 w-14' : 'h-16 w-16',
        ]"
      >
        <img :src="img" class="h-full w-full object-cover" />
        <button
          class="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-black/50 text-white opacity-0 transition-opacity group-hover:opacity-100"
          @click="emit('removeImage', index)"
        >
          <X :size="12" />
        </button>
      </div>

      <!-- 文档预览 -->
      <div
        v-for="file in parsedFiles"
        :key="file.id"
        :class="[
          'group relative flex items-center gap-2 rounded-lg border border-border bg-muted/50 px-2 py-1.5 transition-colors hover:bg-muted',
          isMobile ? 'h-14 w-28' : 'h-16 w-32',
        ]"
      >
        <div
          class="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-primary/10 text-primary"
        >
          <Loader2 v-if="file.status === 'parsing'" :size="14" class="animate-spin" />
          <AlertCircle v-else-if="file.status === 'error'" :size="14" class="text-red-500" />
          <FileText v-else :size="14" />
        </div>
        <div class="min-w-0 flex-1">
          <p class="truncate text-[11px] font-medium leading-none">{{ file.name }}</p>
          <p class="mt-1 text-[9px] text-muted-foreground">
            {{
              file.status === 'parsing' ? t('ai.parsing') : (file.size / 1024).toFixed(1) + ' KB'
            }}
          </p>
        </div>
        <button
          class="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-black/50 text-white opacity-0 transition-opacity group-hover:opacity-100"
          @click="emit('removeFile', file.id)"
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
        class="mb-1 flex items-center gap-1.5 px-2 text-[11px] text-amber-500/80 dark:text-amber-400/70"
      >
        <AlertCircle :size="12" />
        <span>{{ t('ai.imageGenerationDesc') }}</span>
      </div>
    </Transition>

    <!-- 快捷指令菜单 -->
    <Transition
      enter-active-class="transition duration-200 ease-out"
      enter-from-class="transform translate-y-2 opacity-0 scale-95"
      enter-to-class="transform translate-y-0 opacity-100 scale-100"
      leave-active-class="transition duration-150 ease-in"
      leave-from-class="transform translate-y-0 opacity-100 scale-100"
      leave-to-class="transform translate-y-2 opacity-0 scale-95"
    >
      <div
        v-if="showSlashCommands"
        class="slash-commands-menu absolute bottom-full left-0 z-50 mb-3 w-64 overflow-hidden rounded-2xl border border-border/40 bg-background/80 p-1.5 shadow-2xl shadow-black/10 backdrop-blur-2xl"
      >
        <div class="flex flex-col gap-0.5">
          <button
            v-for="(cmd, index) in slashCommands"
            :key="cmd.id"
            class="group flex items-center justify-between rounded-lg px-3 py-2 text-left transition-all"
            :class="[
              selectedCommandIndex === index
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'text-muted-foreground hover:bg-accent hover:text-foreground',
            ]"
            @click="handleSlashCommand(index)"
            @mouseenter="selectedCommandIndex = index"
          >
            <div class="flex items-center gap-2.5">
              <div
                class="flex h-7 w-7 items-center justify-center rounded-md"
                :class="[
                  selectedCommandIndex === index
                    ? 'bg-white/20 text-white'
                    : cmd.active
                      ? 'bg-primary/10 text-primary'
                      : 'bg-muted text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary',
                ]"
              >
                <component :is="cmd.icon" :size="16" />
              </div>
              <span class="text-[13px] font-medium">{{ cmd.title }}</span>
            </div>
            <div
              v-if="cmd.active"
              class="h-1.5 w-1.5 rounded-full"
              :class="selectedCommandIndex === index ? 'bg-white' : 'bg-primary'"
            />
          </button>
        </div>
      </div>
    </Transition>

    <label :for="textareaId" class="sr-only">{{ t('ai.placeholder') }}</label>
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
        isInputDisabled
          ? t('ai.generating')
          : isImageGenerationEnabled
            ? t('ai.imagePromptPlaceholder')
            : t('ai.placeholder')
      "
      :class="[
        'w-full resize-none bg-transparent text-foreground outline-none placeholder:text-muted-foreground/40 leading-relaxed transition-colors',
        isMobile ? 'px-3 pt-2 pb-0.5 text-[14px]' : 'px-4 pt-2.5 pb-1 text-[15px]',
      ]"
      :disabled="isInputDisabled"
      @input="(e) => emit('update:modelValue', (e.target as HTMLTextAreaElement).value)"
      @keydown.exact="handleKeydown"
      @keydown.enter.shift.exact="handleNewline"
      @paste="(e) => emit('paste', e)"
    />

    <div :class="['flex items-center justify-between px-1 pb-1', isMobile ? 'gap-2' : '']">
      <div class="flex items-center gap-1.5">
        <!-- 附件上传按钮 -->
        <button
          :class="[
            'flex items-center justify-center rounded-lg text-muted-foreground transition-all hover:bg-accent hover:text-foreground active:scale-95 disabled:cursor-not-allowed disabled:opacity-50',
            isMobile ? 'h-8 w-8' : 'h-7 w-7',
          ]"
          :title="t('ai.uploadFile')"
          :disabled="isInputDisabled || selectedImages.length + parsedFiles.length >= 10"
          @click="emit('triggerFileUpload')"
        >
          <ImageIcon :size="isMobile ? 18 : 16" />
        </button>
        <label :for="fileInputId" class="sr-only">{{ t('ai.uploadFile') }}</label>
        <input
          :id="fileInputId"
          ref="fileInputRef"
          name="ai-file-upload"
          type="file"
          accept="image/*,.pdf,.docx,.xlsx,.xls,.txt,.md,.json,.csv,.ts,.js,.py"
          multiple
          class="hidden"
          @change="(e) => emit('handleFileUpload', e)"
        />

        <!-- 停止生成按钮 -->
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

        <!-- 导航按钮 -->
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
          isInputDisabled ||
          (!modelValue.trim() &&
            selectedImages.length === 0 &&
            parsedFiles.filter((f) => f.status === 'completed').length === 0)
            ? 'cursor-not-allowed bg-primary/20 scale-95'
            : 'animate-button-pop bg-primary hover:bg-primary-hover hover:scale-105 active:scale-95 shadow-primary/20',
        ]"
        :disabled="
          isInputDisabled ||
          (!modelValue.trim() &&
            selectedImages.length === 0 &&
            parsedFiles.filter((f) => f.status === 'completed').length === 0)
        "
        @click="emit('send')"
      >
        <Send :size="isMobile ? 16 : 18" />
      </button>
    </div>
  </div>
</template>
