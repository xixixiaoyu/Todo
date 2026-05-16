<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useWindowSize } from '@vueuse/core'
import type { AIPreset, AIConfig, ThinkingMode } from '@/features/ai/composables/useAIConfig'
import type { ChatSession } from '@/features/ai/composables/useChatHistory'
import { Plus, Paperclip, ChevronLeft, Square, Presentation, Bot } from 'lucide-vue-next'
import AiAssistantToolbarDiscussionMenu from '@/features/ai/components/AiAssistantToolbarDiscussionMenu.vue'
import AiAssistantToolbarPresetMenu from '@/features/ai/components/AiAssistantToolbarPresetMenu.vue'
import AiAssistantToolbarModesMenu from '@/features/ai/components/AiAssistantToolbarModesMenu.vue'
import AiAssistantThinkingMenu from '@/features/ai/components/AiAssistantThinkingMenu.vue'

defineProps<{
  isGenerating: boolean
  thinkingLevel: ThinkingMode
  isTeachingEnabled: boolean
  isNovelEnabled: boolean
  isTodoAssistantEnabled: boolean
  isDiscussionEnabled: boolean
  isImageGenerationEnabled: boolean
  isTranslationEnabled: boolean
  isAgentEnabled?: boolean
  currentPresetName: string
  presets: AIPreset[]
  config: AIConfig
  activePreset: AIPreset | null
  isMaximized: boolean
  lastActiveSession?: ChatSession | null
  totalAttachments?: number
}>()

const showPresetDropdown = defineModel<boolean>('showPresetDropdown', { default: false })
const showDiscussionPopover = defineModel<boolean>('showDiscussionPopover', { default: false })

const emit = defineEmits<{
  (e: 'newChat'): void
  (e: 'openHistory'): void
  (e: 'update:thinkingLevel', level: ThinkingMode): void
  (e: 'toggleTeaching'): void
  (e: 'toggleNovel'): void
  (e: 'toggleTodo'): void
  (e: 'toggleDiscussion'): void
  (e: 'toggleImageGen'): void
  (e: 'toggleTranslation'): void
  (e: 'toggleAgent'): void
  (e: 'selectPrimaryModel', id: string): void
  (e: 'toggleSecondaryModel', id: string): void
  (e: 'selectPreset', id: string): void
  (e: 'openSettings', tab?: 'settings' | 'presets' | 'memory' | 'mcp' | 'contextCompression'): void
  (e: 'triggerFileUpload'): void
  (e: 'navigatePrevious'): void
  (e: 'stopGenerating'): void
  (e: 'openMermaidEditor'): void
}>()

const { t } = useI18n()
const { width: windowWidth } = useWindowSize()
const isMobile = computed(() => windowWidth.value < 640)

const isMac = typeof window !== 'undefined' && /Mac|iPod|iPhone|iPad/.test(navigator.platform)
const shortcutHint = isMac ? '⌘J' : 'Ctrl+J'
const newChatTitle = computed(() => `${t('ai.newChat')} (${shortcutHint})`)
</script>

<template>
  <div
    :class="[
      'toolbar-container shrink-0 bg-[hsl(var(--ai-glass-bg))]',
      isMobile ? 'p-2' : 'px-4 pt-2 pb-4',
    ]"
  >
    <div
      :class="[isMaximized ? 'mx-auto max-w-4xl w-full' : '', 'flex flex-col']"
      :style="{ gap: isMobile ? '6px' : '8px' }"
    >
      <!-- 快捷操作按钮 -->
      <div :class="['flex items-center text-sm', isMobile ? 'gap-1.5' : 'gap-2']">
        <div
          class="no-scrollbar scroll-mask flex flex-1 items-center gap-2 overflow-x-auto py-1 px-3"
        >
          <button
            :class="[
              'toolbar-btn group flex shrink-0 items-center rounded-full border active:scale-95 disabled:cursor-not-allowed disabled:opacity-30',
              isMobile ? 'h-8 px-2.5 gap-1' : 'px-3.5 py-1.5 gap-1.5 text-[13px]',
              '!border-primary/20 !bg-primary/10 !text-primary hover:!bg-primary/20 hover:!border-primary/30',
            ]"
            :title="newChatTitle"
            @click="emit('newChat')"
          >
            <Plus :size="isMobile ? 14 : 14" class="transition-transform group-hover:rotate-90" />
            <span v-if="!isMobile" class="toolbar-text font-medium">{{ t('ai.newChat') }}</span>
          </button>

          <!-- 文件上传与上一个会话 -->
          <button
            class="toolbar-btn flex h-8 w-8 shrink-0 items-center justify-center rounded-full border active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
            :title="t('ai.uploadFile')"
            :disabled="isGenerating || (totalAttachments ?? 0) >= 10"
            @click="emit('triggerFileUpload')"
          >
            <Paperclip :size="16" />
          </button>

          <!-- 停止生成 / 上一个会话 (生成中显示停止按钮，否则显示返回按钮) -->
          <button
            v-if="isGenerating"
            class="toolbar-btn flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-rose-400/15 bg-rose-400/5 text-rose-400/60 hover:bg-rose-400/10 hover:text-rose-400 active:scale-95"
            :title="t('ai.stop')"
            @click="emit('stopGenerating')"
          >
            <Square :size="10" class="fill-current" />
          </button>

          <button
            v-else
            class="toolbar-btn flex h-8 w-8 shrink-0 items-center justify-center rounded-full border active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
            :title="t('ai.previousSession')"
            :disabled="!lastActiveSession"
            @click="emit('navigatePrevious')"
          >
            <ChevronLeft :size="16" />
          </button>

          <div class="h-4 w-px shrink-0 bg-border/20 mx-1" />

          <!-- AI 思考级别选择器 -->
          <AiAssistantThinkingMenu
            :current-level="thinkingLevel"
            :is-mobile="isMobile"
            @update:level="(level) => emit('update:thinkingLevel', level)"
          />

          <!-- 模式切换功能 -->
          <AiAssistantToolbarModesMenu
            :is-mobile="isMobile"
            :is-teaching-enabled="isTeachingEnabled"
            :is-novel-enabled="isNovelEnabled"
            :is-todo-assistant-enabled="isTodoAssistantEnabled"
            :is-image-generation-enabled="isImageGenerationEnabled"
            :is-translation-enabled="isTranslationEnabled"
            @toggle-teaching="emit('toggleTeaching')"
            @toggle-novel="emit('toggleNovel')"
            @toggle-todo="emit('toggleTodo')"
            @toggle-image-gen="emit('toggleImageGen')"
            @toggle-translation="emit('toggleTranslation')"
          />

          <!-- 多模型协同讨论 -->
          <AiAssistantToolbarDiscussionMenu
            v-model:open="showDiscussionPopover"
            :is-mobile="isMobile"
            :is-discussion-enabled="isDiscussionEnabled"
            :presets="presets"
            :config="config"
            @toggle="emit('toggleDiscussion')"
            @select-primary-model="(id) => emit('selectPrimaryModel', id)"
            @toggle-secondary-model="(id) => emit('toggleSecondaryModel', id)"
          />

          <!-- Agent 模式 -->
          <button
            :class="[
              'toolbar-btn flex items-center active:scale-95 rounded-full border shrink-0',
              isMobile ? 'h-8 w-8 justify-center' : 'px-3.5 py-1.5 gap-1.5 text-[13px]',
              isAgentEnabled
                ? 'border-primary/30 bg-primary/15 text-primary shadow-[0_0_12px_hsl(var(--primary)_/_0.1)]'
                : 'border-transparent text-muted-foreground',
            ]"
            :title="t('ai.agentMode')"
            @click="emit('toggleAgent')"
          >
            <Bot
              :size="14"
              :class="[
                'transition-all duration-300',
                isAgentEnabled ? 'animate-pulse-slow scale-110' : '',
              ]"
            />
            <span v-if="!isMobile" class="toolbar-text font-medium">{{ t('ai.agentMode') }}</span>
          </button>

          <!-- Mermaid 编辑器 -->
          <button
            :class="[
              'toolbar-btn flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-muted-foreground active:scale-95',
            ]"
            :title="t('ai.mermaidOpenEditor')"
            @click="emit('openMermaidEditor')"
          >
            <Presentation :size="16" />
          </button>

          <div class="h-4 w-px shrink-0 bg-border/20 mx-0.5" />

          <!-- 预设下拉框 -->
          <AiAssistantToolbarPresetMenu
            v-model:open="showPresetDropdown"
            :is-mobile="isMobile"
            :current-preset-name="currentPresetName"
            :presets="presets"
            :active-preset="activePreset"
            @select-preset="(id) => emit('selectPreset', id)"
            @open-presets-settings="emit('openSettings', 'presets')"
          />
        </div>
      </div>
      <slot name="input"></slot>
    </div>
  </div>
</template>

<style scoped>
.toolbar-container {
  container-type: inline-size;
}

.toolbar-container :deep(.toolbar-btn) {
  background-color: hsl(var(--ai-glass-bg));
  border-color: hsl(var(--ai-glass-border));
  box-shadow:
    0 1px 2px rgba(0, 0, 0, 0.02),
    0 4px 12px rgba(0, 0, 0, 0.03);
  transition:
    background-color 0.4s,
    border-color 0.4s,
    color 0.4s,
    box-shadow 0.4s,
    transform 0.4s cubic-bezier(0.23, 1, 0.32, 1);
}

.toolbar-container :deep(.toolbar-btn:hover:not(:disabled)) {
  background-color: hsl(var(--accent) / 0.6);
  border-color: hsl(var(--primary) / 0.3);
  color: hsl(var(--primary));
  transform: translateY(-1px);
}

.toolbar-container :deep(.toolbar-btn:active:not(:disabled)) {
  transform: translateY(0) scale(0.96);
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.02);
}

.no-scrollbar {
  -ms-overflow-style: none;
  scrollbar-width: none;
}

.no-scrollbar::-webkit-scrollbar {
  display: none;
}

.scroll-mask {
  mask-image: linear-gradient(
    to right,
    transparent,
    black 12px,
    black calc(100% - 12px),
    transparent
  );
}

/* 抵消外层 padding，使滚动区域撑满容器 */
.toolbar-container .scroll-mask {
  margin-left: -0.75rem;
  margin-right: -0.75rem;
}

@keyframes ping-slow {
  0% {
    transform: scale(0.9);
    opacity: 0.8;
  }
  100% {
    transform: scale(1.5);
    opacity: 0;
  }
}

.animate-ping-slow {
  animation: ping-slow 3s cubic-bezier(0, 0, 0.2, 1) infinite;
}

@container (max-width: 520px) {
  .toolbar-container :deep(.toolbar-text) {
    display: none;
  }

  .toolbar-container :deep(.toolbar-icon-only) {
    display: block !important;
  }

  .toolbar-container :deep(button) {
    padding-left: 0.5rem;
    padding-right: 0.5rem;
  }
}
</style>
