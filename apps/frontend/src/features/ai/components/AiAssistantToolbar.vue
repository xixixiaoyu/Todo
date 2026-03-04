<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useWindowSize } from '@vueuse/core'
import type { AIPreset, AIConfig } from '@/features/ai/composables/useAIConfig'
import type { ChatSession } from '@/features/ai/composables/useChatHistory'
import {
  Plus,
  History,
  Lightbulb,
  GraduationCap,
  Clover,
  Image as ImageIcon,
  Settings2,
  Blocks,
  ChevronLeft,
  Square,
} from 'lucide-vue-next'
import AiAssistantToolbarDiscussionMenu from '@/features/ai/components/AiAssistantToolbarDiscussionMenu.vue'
import AiAssistantToolbarPresetMenu from '@/features/ai/components/AiAssistantToolbarPresetMenu.vue'

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
</script>

<template>
  <div
    :class="[
      'toolbar-container shrink-0 bg-[hsl(var(--ai-glass-bg))] transition-all duration-300',
      isMobile ? 'p-2' : 'px-4 pt-2 pb-4',
    ]"
  >
    <div
      :class="[isMaximized ? 'mx-auto max-w-4xl w-full' : '', 'flex flex-col']"
      :style="{ gap: isMobile ? '6px' : '8px' }"
    >
      <!-- 快捷操作按钮 -->
      <div :class="['flex items-center text-sm', isMobile ? 'gap-1' : 'gap-2']">
        <div class="no-scrollbar flex flex-1 items-center gap-2 overflow-x-auto py-1">
          <button
            :class="[
              'toolbar-btn group flex shrink-0 items-center rounded-full border transition-all active:scale-95 disabled:cursor-not-allowed disabled:opacity-30',
              isMobile ? 'h-8 px-2.5 gap-1' : 'px-3.5 py-1.5 gap-1.5 text-[13px]',
              '!border-primary/20 !bg-primary/10 !text-primary hover:!bg-primary/20 hover:!border-primary/30',
            ]"
            :disabled="!hasHistory || isGenerating"
            :title="t('ai.newChat')"
            @click="emit('newChat')"
          >
            <Plus :size="isMobile ? 14 : 14" class="transition-transform group-hover:rotate-90" />
            <span v-if="!isMobile" class="toolbar-text font-medium">{{ t('ai.newChat') }}</span>
          </button>

          <!-- 历史记录按钮 -->
          <button
            class="toolbar-btn flex h-8 w-8 shrink-0 items-center justify-center rounded-full border transition-all active:scale-95"
            :title="t('ai.history')"
            :class="{ 'cursor-not-allowed opacity-50': isGenerating }"
            :disabled="isGenerating"
            @click="emit('openHistory')"
          >
            <History :size="16" />
          </button>

          <!-- 移动端：文件上传与上一个会话 -->
          <template v-if="isMobile">
            <button
              class="toolbar-btn flex h-8 w-8 shrink-0 items-center justify-center rounded-full border transition-all active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
              :title="t('ai.uploadFile')"
              :disabled="isGenerating || (totalAttachments ?? 0) >= 10"
              @click="emit('triggerFileUpload')"
            >
              <ImageIcon :size="16" />
            </button>

            <!-- 停止生成按钮 (仅移动端在生成时显示) -->
            <button
              v-if="isGenerating"
              class="toolbar-btn animate-stop-pulse flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-red-500/30 bg-red-500/10 text-red-500 transition-all active:scale-95"
              :title="t('ai.stop')"
              @click="emit('stopGenerating')"
            >
              <Square :size="10" class="fill-current" />
            </button>

            <button
              class="toolbar-btn flex h-8 w-8 shrink-0 items-center justify-center rounded-full border transition-all active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
              :title="t('ai.previousSession')"
              :disabled="isGenerating || !lastActiveSession"
              @click="emit('navigatePrevious')"
            >
              <ChevronLeft :size="16" />
            </button>
          </template>

          <div class="h-4 w-px shrink-0 bg-border/20 mx-1" />

          <!-- AI 思考模式开关 -->
          <button
            class="toolbar-btn flex h-8 w-8 shrink-0 items-center justify-center rounded-full border transition-all active:scale-95"
            :class="
              isThinkingEnabled
                ? 'border-primary/30 bg-primary/15 text-primary shadow-[0_0_12px_hsl(var(--primary)_/_0.1)]'
                : 'border-transparent'
            "
            :title="isThinkingEnabled ? t('ai.thinkingEnabled') : t('ai.thinkingDisabled')"
            @click="emit('toggleThinking')"
          >
            <Lightbulb
              :size="16"
              :class="[
                'transition-all duration-300',
                isThinkingEnabled ? 'fill-primary/20 scale-110' : 'text-muted-foreground',
              ]"
            />
          </button>

          <button
            class="toolbar-btn flex h-8 w-8 shrink-0 items-center justify-center rounded-full border transition-all active:scale-95"
            :class="
              isTeachingEnabled
                ? 'border-primary/30 bg-primary/15 text-primary shadow-[0_0_12px_hsl(var(--primary)_/_0.1)]'
                : 'border-transparent'
            "
            :title="isTeachingEnabled ? t('ai.teachingEnabled') : t('ai.teachingDisabled')"
            @click="emit('toggleTeaching')"
          >
            <GraduationCap
              :size="16"
              :class="[
                'transition-all duration-300',
                isTeachingEnabled ? 'scale-110 text-primary' : 'text-muted-foreground',
              ]"
            />
          </button>

          <!-- Todo 助手 -->
          <button
            :class="[
              'toolbar-btn flex shrink-0 items-center transition-all active:scale-95 rounded-full border',
              isMobile ? 'h-8 w-8 justify-center' : 'px-3.5 py-1.5 gap-1.5 text-[13px]',
              isTodoAssistantEnabled
                ? 'border-primary/30 bg-primary/15 text-primary shadow-[0_0_12px_hsl(var(--primary)_/_0.1)]'
                : 'border-transparent text-muted-foreground',
            ]"
            :title="
              isTodoAssistantEnabled ? t('ai.todoAssistantEnabled') : t('ai.todoAssistantDisabled')
            "
            @click="emit('toggleTodo')"
          >
            <Clover
              :size="14"
              :class="[
                'transition-all duration-500',
                isTodoAssistantEnabled ? 'animate-spin-slow scale-110' : '',
              ]"
            />
            <span v-if="!isMobile" class="toolbar-text font-medium">{{
              t('ai.todoAssistant')
            }}</span>
          </button>

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

          <!-- 生图功能开关 -->
          <button
            :class="[
              'toolbar-btn flex shrink-0 items-center transition-all active:scale-95 rounded-full border',
              isMobile ? 'h-8 w-8 justify-center' : 'px-3.5 py-1.5 gap-1.5 text-[13px]',
              isImageGenerationEnabled
                ? 'border-primary/30 bg-primary/15 text-primary shadow-[0_0_12px_hsl(var(--primary)_/_0.1)]'
                : 'border-transparent text-muted-foreground',
            ]"
            :title="t('ai.enableImageGeneration')"
            @click="emit('toggleImageGen')"
          >
            <ImageIcon
              :size="14"
              :class="[
                'transition-all duration-300',
                isImageGenerationEnabled ? 'animate-pulse-slow scale-110' : '',
              ]"
            />
            <span v-if="!isMobile" class="toolbar-text font-medium">{{
              t('ai.enableImageGeneration')
            }}</span>
          </button>

          <!-- MCP 工具 -->
          <button
            :class="[
              'toolbar-btn flex h-8 w-8 shrink-0 items-center justify-center rounded-full border transition-all active:scale-95 border-transparent text-muted-foreground',
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
        <div class="flex shrink-0 items-center gap-2">
          <button
            :class="[
              'toolbar-btn flex items-center justify-center rounded-full border border-transparent text-muted-foreground transition-all active:scale-95',
              isMobile ? 'h-8 w-8' : 'h-8 w-8',
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
  transition: all 0.4s cubic-bezier(0.23, 1, 0.32, 1);
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
