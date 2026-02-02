<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useWindowSize } from '@vueuse/core'
import type { AIPreset, AIConfig } from '@/composables/useAIConfig'
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
  (e: 'openSettings', tab?: 'settings' | 'presets'): void
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
      'toolbar-container shrink-0 border-t border-border/10 bg-background transition-all duration-300',
      isMobile ? 'p-2' : 'p-4',
    ]"
  >
    <div
      :class="[isMaximized ? 'mx-auto max-w-4xl w-full' : '', 'flex flex-col']"
      :style="{ gap: isMobile ? '4px' : '12px' }"
    >
      <!-- 快捷操作按钮 -->
      <div :class="['flex items-center text-sm', isMobile ? 'gap-1' : 'gap-2']">
        <div class="no-scrollbar flex flex-1 items-center gap-2 overflow-x-auto py-1">
          <button
            :class="[
              'flex shrink-0 items-center rounded-full border border-border bg-card text-muted-foreground transition-all hover:bg-accent hover:text-accent-foreground hover:shadow-sm active:scale-95 disabled:cursor-not-allowed disabled:opacity-30',
              isMobile ? 'h-8 px-2.5 gap-1' : 'px-3.5 py-1.5 gap-1.5 text-[13px]',
            ]"
            :disabled="!hasHistory || isGenerating"
            :title="t('ai.newChat')"
            @click="emit('newChat')"
          >
            <Plus :size="isMobile ? 14 : 14" />
            <span v-if="!isMobile" class="toolbar-text">{{ t('ai.newChat') }}</span>
          </button>

          <!-- 历史记录按钮 -->
          <button
            class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border bg-card text-muted-foreground transition-all hover:bg-accent hover:text-accent-foreground active:scale-95 shadow-sm"
            :title="t('ai.history')"
            :class="{ 'cursor-not-allowed opacity-50': isGenerating }"
            :disabled="isGenerating"
            @click="emit('openHistory')"
          >
            <History :size="16" />
          </button>

          <div class="h-4 w-px shrink-0 bg-border/30 mx-1" />

          <!-- AI 思考模式开关 -->
          <button
            class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border transition-all active:scale-95 shadow-sm"
            :class="
              isThinkingEnabled
                ? 'border-primary/30 bg-primary/10 text-primary shadow-primary/5'
                : 'border-border bg-card text-muted-foreground hover:bg-accent hover:text-accent-foreground'
            "
            :title="isThinkingEnabled ? t('ai.thinkingEnabled') : t('ai.thinkingDisabled')"
            @click="emit('toggleThinking')"
          >
            <Lightbulb :size="16" :class="{ 'fill-primary/20': isThinkingEnabled }" />
          </button>

          <!-- Todo 助手 -->
          <button
            :class="[
              'flex shrink-0 items-center transition-all active:scale-95 shadow-sm rounded-full border',
              isMobile ? 'h-8 w-8 justify-center' : 'px-3.5 py-1.5 gap-1.5 text-[13px]',
              isTodoAssistantEnabled
                ? 'border-primary/30 bg-primary/10 text-primary shadow-primary/5'
                : 'border-border bg-card text-muted-foreground hover:bg-accent hover:text-accent-foreground',
            ]"
            :title="
              isTodoAssistantEnabled ? t('ai.todoAssistantEnabled') : t('ai.todoAssistantDisabled')
            "
            @click="emit('toggleTodo')"
          >
            <Clover :size="14" :class="{ 'animate-spin-slow': isTodoAssistantEnabled }" />
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
                    'flex items-center transition-all active:scale-95 shadow-sm rounded-full border',
                    isMobile ? 'h-8 w-8 justify-center' : 'px-3.5 py-1.5 gap-1.5 text-[13px]',
                    isDiscussionEnabled
                      ? 'border-primary/30 bg-primary/10 text-primary shadow-primary/5'
                      : 'border-border bg-card text-muted-foreground hover:bg-accent hover:text-accent-foreground',
                  ]"
                  :title="isDiscussionEnabled ? t('ai.discussionMode') : t('ai.discussionMode')"
                  @click="emit('toggleDiscussion')"
                  @mouseenter="clearDiscussionTimer"
                >
                  <Users :size="14" :class="{ 'animate-pulse-slow': isDiscussionEnabled }" />
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
                class="w-64 p-3"
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
                            ? 'border-primary bg-primary text-primary-foreground shadow-sm'
                            : 'border-border bg-background/50 text-muted-foreground hover:border-primary/50 hover:text-foreground'
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
                            ? 'border-primary bg-primary text-primary-foreground shadow-sm'
                            : 'border-border bg-background/50 text-muted-foreground hover:border-primary/50 hover:text-foreground'
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
              'flex shrink-0 items-center transition-all active:scale-95 shadow-sm rounded-full border',
              isMobile ? 'h-8 w-8 justify-center' : 'px-3.5 py-1.5 gap-1.5 text-[13px]',
              isImageGenerationEnabled
                ? 'border-primary/30 bg-primary/10 text-primary shadow-primary/5'
                : 'border-border bg-card text-muted-foreground hover:bg-accent hover:text-accent-foreground',
            ]"
            :title="t('ai.enableImageGeneration')"
            @click="emit('toggleImageGen')"
          >
            <ImageIcon :size="14" :class="{ 'animate-pulse-slow': isImageGenerationEnabled }" />
            <span v-if="!isMobile" class="toolbar-text font-medium">{{
              t('ai.enableImageGeneration')
            }}</span>
          </button>

          <div class="h-4 w-px shrink-0 bg-border/30 mx-0.5" />

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
                    'flex items-center border border-border bg-card text-muted-foreground transition-all hover:bg-accent hover:text-accent-foreground active:scale-95 shadow-sm rounded-full',
                    isMobile ? 'h-8 px-2.5 gap-1' : 'px-3 py-1.5 gap-1.5 text-[13px]',
                  ]"
                  :title="t('ai.managePresets')"
                  @mouseenter="clearPresetTimer"
                >
                  <Sparkles :size="14" class="toolbar-icon-only" :class="{ hidden: !isMobile }" />
                  <span v-if="!isMobile" class="toolbar-text font-medium">{{
                    currentPresetName
                  }}</span>
                  <ChevronDown
                    :size="14"
                    class="transition-transform duration-300"
                    :class="{ 'rotate-180': showPresetDropdown }"
                  />
                </button>
              </DropdownMenuTrigger>

              <DropdownMenuContent
                side="top"
                align="start"
                :side-offset="4"
                class="min-w-[160px] p-1"
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
              'flex items-center justify-center rounded-full border border-border bg-card text-muted-foreground transition-all hover:bg-accent hover:text-accent-foreground hover:scale-110 active:scale-95 shadow-sm',
              isMobile ? 'h-8 w-8' : 'h-8 w-8',
            ]"
            :title="t('ai.settings')"
            @click="emit('openSettings')"
          >
            <Settings2 :size="16" />
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
