<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useWindowSize } from '@vueuse/core'
import type { AIPreset, AIConfig } from '@/features/ai/composables/useAIConfig'
import type { ChatSession } from '@/features/ai/composables/useChatHistory'
import {
  Plus,
  History,
  Paperclip,
  Lightbulb,
  Settings2,
  Blocks,
  ChevronLeft,
  Square,
} from 'lucide-vue-next'
import AiAssistantToolbarDiscussionMenu from '@/features/ai/components/AiAssistantToolbarDiscussionMenu.vue'
import AiAssistantToolbarPresetMenu from '@/features/ai/components/AiAssistantToolbarPresetMenu.vue'
import AiAssistantToolbarModesMenu from '@/features/ai/components/AiAssistantToolbarModesMenu.vue'

defineProps<{
  hasHistory: boolean
  isGenerating: boolean
  isThinkingEnabled: boolean
  isTeachingEnabled: boolean
  isTodoAssistantEnabled: boolean
  isDiscussionEnabled: boolean
  isImageGenerationEnabled: boolean
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
  (e: 'toggleThinking'): void
  (e: 'toggleTeaching'): void
  (e: 'toggleTodo'): void
  (e: 'toggleDiscussion'): void
  (e: 'toggleImageGen'): void
  (e: 'selectPrimaryModel', id: string): void
  (e: 'toggleSecondaryModel', id: string): void
  (e: 'selectPreset', id: string): void
  (e: 'openSettings', tab?: 'settings' | 'presets' | 'memory' | 'mcp' | 'contextCompression'): void
  (e: 'triggerFileUpload'): void
  (e: 'navigatePrevious'): void
  (e: 'stopGenerating'): void
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
            :disabled="!hasHistory || isGenerating"
            :title="newChatTitle"
            @click="emit('newChat')"
          >
            <Plus :size="isMobile ? 14 : 14" class="transition-transform group-hover:rotate-90" />
            <span v-if="!isMobile" class="toolbar-text font-medium">{{ t('ai.newChat') }}</span>
          </button>

          <!-- 历史记录按钮 -->
          <button
            class="toolbar-btn flex h-8 w-8 shrink-0 items-center justify-center rounded-full border active:scale-95"
            :title="t('ai.history')"
            :class="{ 'cursor-not-allowed opacity-50': isGenerating }"
            :disabled="isGenerating"
            @click="emit('openHistory')"
          >
            <History :size="16" />
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

          <!-- AI 思考模式开关 (移回工具栏外层) -->
          <button
            class="toolbar-btn relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full border active:scale-95 transition-all duration-700"
            :class="[
              isThinkingEnabled
                ? '!border-primary/40 bg-gradient-to-br from-primary/10 to-primary/5 text-primary shadow-[0_4px_12px_rgba(var(--primary-rgb),0.12)]'
                : 'border-transparent',
            ]"
            :title="isThinkingEnabled ? t('ai.thinkingEnabled') : t('ai.thinkingDisabled')"
            @click="emit('toggleThinking')"
          >
            <!-- 激活状态下的外层扩散光圈 (极简设计) -->
            <div
              v-if="isThinkingEnabled"
              class="absolute inset-0 rounded-full animate-ping-slow bg-primary/20"
            ></div>

            <Lightbulb
              :size="16"
              :class="[
                'relative z-10 transition-all duration-700 ease-soft-spring',
                isThinkingEnabled
                  ? 'text-primary scale-110 filter drop-shadow-[0_0_5px_rgba(var(--primary-rgb),0.4)]'
                  : 'text-muted-foreground opacity-60',
              ]"
              :stroke-width="isThinkingEnabled ? 2.5 : 2"
            />

            <!-- 极简激活指示点 -->
            <div
              v-if="isThinkingEnabled"
              class="absolute bottom-1.5 right-1.5 h-1 w-1 rounded-full bg-primary shadow-[0_0_4px_rgba(var(--primary-rgb),0.8)]"
            ></div>
          </button>

          <!-- 模式切换功能 -->
          <AiAssistantToolbarModesMenu
            :is-mobile="isMobile"
            :is-teaching-enabled="isTeachingEnabled"
            :is-todo-assistant-enabled="isTodoAssistantEnabled"
            :is-image-generation-enabled="isImageGenerationEnabled"
            @toggle-teaching="emit('toggleTeaching')"
            @toggle-todo="emit('toggleTodo')"
            @toggle-image-gen="emit('toggleImageGen')"
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

          <!-- MCP 工具 -->
          <button
            :class="[
              'toolbar-btn flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-muted-foreground active:scale-95',
            ]"
            :title="t('ai.mcp')"
            @click="emit('openSettings', 'mcp')"
          >
            <Blocks :size="16" />
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

        <!-- 设置 -->
        <div class="flex shrink-0 items-center gap-2 pl-0.5">
          <button
            :class="[
              'toolbar-btn flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-muted-foreground active:scale-95',
              'group',
            ]"
            :title="t('ai.settings')"
            @click="emit('openSettings')"
          >
            <Settings2 :size="16" class="transition-transform duration-500 group-hover:rotate-90" />
          </button>
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
