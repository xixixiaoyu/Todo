<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useWindowSize } from '@vueuse/core'
import type { AIPreset, AIConfig } from '@/features/ai/composables/useAIConfig'
import {
  Plus,
  History,
  Lightbulb,
  Clover,
  Users,
  Image as ImageIcon,
  ChevronDown,
  Settings2,
  Check,
  Star,
  Sparkles,
  Blocks,
} from 'lucide-vue-next'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'

defineProps<{
  hasHistory: boolean
  isGenerating: boolean
  isThinkingEnabled: boolean
  isTodoAssistantEnabled: boolean
  isDiscussionEnabled: boolean
  isImageGenerationEnabled: boolean
  currentPresetName: string
  presets: AIPreset[]
  config: AIConfig
  activePreset: AIPreset | null
  isMaximized: boolean
}>()

const showPresetDropdown = defineModel<boolean>('showPresetDropdown', { default: false })
const showDiscussionPopover = defineModel<boolean>('showDiscussionPopover', { default: false })

const emit = defineEmits<{
  (e: 'newChat'): void
  (e: 'openHistory'): void
  (e: 'toggleThinking'): void
  (e: 'toggleTodo'): void
  (e: 'toggleDiscussion'): void
  (e: 'toggleImageGen'): void
  (e: 'selectPrimaryModel', id: string): void
  (e: 'toggleSecondaryModel', id: string): void
  (e: 'selectPreset', id: string): void
  (e: 'openSettings', tab?: 'settings' | 'presets' | 'memory' | 'mcp' | 'contextCompression'): void
}>()

const { t } = useI18n()

const { width: windowWidth } = useWindowSize()
const isMobile = computed(() => windowWidth.value < 640)

// 讨论模型快速选择弹窗状态
let discussionHoverTimer: ReturnType<typeof setTimeout> | null = null

const handleDiscussionMouseEnter = () => {
  if (discussionHoverTimer) {
    clearTimeout(discussionHoverTimer)
    discussionHoverTimer = null
  }
  showDiscussionPopover.value = true
}

const clearDiscussionTimer = () => {
  if (discussionHoverTimer) {
    clearTimeout(discussionHoverTimer)
    discussionHoverTimer = null
  }
}

const handleDiscussionMouseLeave = () => {
  discussionHoverTimer = setTimeout(() => {
    showDiscussionPopover.value = false
  }, 150)
}

// 预设下拉框状态
let presetHoverTimer: ReturnType<typeof setTimeout> | null = null

const handlePresetMouseEnter = () => {
  if (presetHoverTimer) {
    clearTimeout(presetHoverTimer)
    presetHoverTimer = null
  }
  showPresetDropdown.value = true
}

const clearPresetTimer = () => {
  if (presetHoverTimer) {
    clearTimeout(presetHoverTimer)
    presetHoverTimer = null
  }
}

const handlePresetMouseLeave = () => {
  presetHoverTimer = setTimeout(() => {
    showPresetDropdown.value = false
  }, 150)
}
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
          <div
            class="relative shrink-0"
            @mouseenter="handleDiscussionMouseEnter"
            @mouseleave="handleDiscussionMouseLeave"
          >
            <DropdownMenu v-model:open="showDiscussionPopover" :modal="false">
              <DropdownMenuTrigger as-child>
                <button
                  :class="[
                    'toolbar-btn flex items-center transition-all active:scale-95 rounded-full border',
                    isMobile ? 'h-8 w-8 justify-center' : 'px-3.5 py-1.5 gap-1.5 text-[13px]',
                    isDiscussionEnabled
                      ? 'border-primary/30 bg-primary/15 text-primary shadow-[0_0_12px_hsl(var(--primary)_/_0.1)]'
                      : 'border-transparent text-muted-foreground',
                  ]"
                  :title="isDiscussionEnabled ? t('ai.discussionMode') : t('ai.discussionMode')"
                  @click="emit('toggleDiscussion')"
                  @mouseenter="clearDiscussionTimer"
                >
                  <Users
                    :size="14"
                    :class="[
                      'transition-all duration-300',
                      isDiscussionEnabled ? 'animate-pulse-slow scale-110' : '',
                    ]"
                  />
                  <span v-if="!isMobile" class="toolbar-text font-medium">{{
                    t('ai.discussionMode')
                  }}</span>
                </button>
              </DropdownMenuTrigger>

              <DropdownMenuContent
                v-if="isDiscussionEnabled"
                side="top"
                align="start"
                :side-offset="4"
                class="z-[251] w-64 p-3"
              >
                <div
                  class="space-y-4"
                  @mouseenter="clearDiscussionTimer"
                  @mouseleave="handleDiscussionMouseLeave"
                >
                  <!-- 主模型 -->
                  <div class="space-y-2">
                    <p
                      class="text-[10px] font-bold text-muted-foreground uppercase tracking-widest opacity-70"
                    >
                      {{ t('ai.discussionPrimaryModel') }}
                    </p>
                    <div
                      v-if="presets.length === 0"
                      class="text-[11px] text-muted-foreground/50 py-1"
                    >
                      {{ t('ai.noPresetsForDiscussion') }}
                    </div>
                    <div v-else class="flex flex-wrap gap-1.5">
                      <button
                        v-for="preset in presets"
                        :key="'quick-primary-' + preset.id"
                        class="flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] transition-all active:scale-95"
                        :class="
                          config.discussionPrimaryModelId === preset.id
                            ? 'border-primary/50 bg-primary/20 text-primary shadow-[0_2px_8px_hsl(var(--primary)_/_0.1)]'
                            : 'border-border/40 bg-background/40 text-muted-foreground hover:border-primary/30 hover:bg-primary/5 hover:text-primary'
                        "
                        @click="emit('selectPrimaryModel', preset.id)"
                      >
                        <Star
                          v-if="config.discussionPrimaryModelId === preset.id"
                          :size="10"
                          class="fill-current"
                        />
                        <span class="font-medium">{{ preset.name }}</span>
                      </button>
                    </div>
                  </div>

                  <!-- 副模型 -->
                  <div class="space-y-2">
                    <p
                      class="text-[10px] font-bold text-muted-foreground uppercase tracking-widest opacity-70"
                    >
                      {{ t('ai.discussionSecondaryModels') }}
                    </p>
                    <div
                      v-if="presets.length === 0"
                      class="text-[11px] text-muted-foreground/50 py-1"
                    >
                      {{ t('ai.noPresetsForDiscussion') }}
                    </div>
                    <div v-else class="flex flex-wrap gap-1.5">
                      <button
                        v-for="preset in presets"
                        :key="'quick-secondary-' + preset.id"
                        class="flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] transition-all active:scale-95"
                        :class="
                          config.discussionModelIds.includes(preset.id)
                            ? 'border-primary/50 bg-primary/20 text-primary shadow-[0_2px_8px_hsl(var(--primary)_/_0.1)]'
                            : 'border-border/40 bg-background/40 text-muted-foreground hover:border-primary/30 hover:bg-primary/5 hover:text-primary'
                        "
                        @click="emit('toggleSecondaryModel', preset.id)"
                      >
                        <Check
                          v-if="config.discussionModelIds.includes(preset.id)"
                          :size="10"
                          stroke-width="3"
                        />
                        <span class="font-medium">{{ preset.name }}</span>
                      </button>
                    </div>
                  </div>
                </div>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

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
          <div
            class="relative shrink-0"
            @mouseenter="handlePresetMouseEnter"
            @mouseleave="handlePresetMouseLeave"
          >
            <DropdownMenu v-model:open="showPresetDropdown" :modal="false">
              <DropdownMenuTrigger as-child>
                <button
                  :class="[
                    'toolbar-btn flex items-center border border-transparent text-muted-foreground transition-all active:scale-95 rounded-full',
                    isMobile ? 'h-8 px-2.5 gap-1' : 'px-3 py-1.5 gap-1.5 text-[13px]',
                    showPresetDropdown ? 'bg-accent/50 text-foreground border-border/20' : '',
                  ]"
                  :title="t('ai.managePresets')"
                  @mouseenter="clearPresetTimer"
                >
                  <Sparkles
                    :size="14"
                    class="toolbar-icon-only text-primary/70"
                    :class="{ hidden: !isMobile }"
                  />
                  <span v-if="!isMobile" class="toolbar-text font-medium">{{
                    currentPresetName
                  }}</span>
                  <ChevronDown
                    :size="14"
                    class="transition-transform duration-300 opacity-50"
                    :class="{ 'rotate-180': showPresetDropdown }"
                  />
                </button>
              </DropdownMenuTrigger>

              <DropdownMenuContent
                side="top"
                align="start"
                :side-offset="4"
                class="z-[251] min-w-[160px] p-1"
              >
                <div @mouseenter="clearPresetTimer" @mouseleave="handlePresetMouseLeave">
                  <DropdownMenuItem
                    v-for="preset in presets"
                    :key="preset.id"
                    class="flex w-full items-center gap-2 px-3 py-2 text-xs"
                    :class="{
                      'bg-accent text-primary': activePreset?.id === preset.id,
                    }"
                    @click="emit('selectPreset', preset.id)"
                    @mouseenter="clearPresetTimer"
                  >
                    <div class="flex h-4 w-4 items-center justify-center">
                      <Check
                        v-if="activePreset?.id === preset.id"
                        :size="12"
                        class="text-primary"
                      />
                    </div>
                    <span>{{ preset.name }}</span>
                  </DropdownMenuItem>

                  <DropdownMenuSeparator />

                  <DropdownMenuItem
                    class="flex w-full items-center gap-2 px-3 py-2 text-xs text-muted-foreground"
                    @click="emit('openSettings', 'presets')"
                    @mouseenter="clearPresetTimer"
                  >
                    <Settings2 :size="12" />
                    <span>{{ t('ai.managePresets') }}</span>
                  </DropdownMenuItem>
                </div>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
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

.toolbar-btn {
  background-color: hsl(var(--ai-glass-bg));
  border-color: hsl(var(--ai-glass-border));
  box-shadow:
    0 1px 2px rgba(0, 0, 0, 0.02),
    0 4px 12px rgba(0, 0, 0, 0.03);
  transition: all 0.4s cubic-bezier(0.23, 1, 0.32, 1);
}

.toolbar-btn:hover:not(:disabled) {
  background-color: hsl(var(--accent) / 0.5);
  border-color: hsl(var(--primary) / 0.3);
  color: hsl(var(--primary));
  transform: translateY(-1px);
  box-shadow:
    0 4px 8px rgba(0, 0, 0, 0.04),
    0 12px 24px rgba(0, 0, 0, 0.08),
    inset 0 1px 1px rgba(255, 255, 255, 0.1);
}

.toolbar-btn:active:not(:disabled) {
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
  .toolbar-text {
    display: none;
  }

  .toolbar-icon-only {
    display: block !important;
  }

  .toolbar-container button {
    padding-left: 0.5rem;
    padding-right: 0.5rem;
  }
}
</style>
