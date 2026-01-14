<script setup lang="ts">
import { useI18n } from 'vue-i18n'
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
} from 'lucide-vue-next'

const props = defineProps<{
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

// 讨论模型快速选择弹窗状态
let discussionHoverTimer: ReturnType<typeof setTimeout> | null = null

const handleDiscussionMouseEnter = () => {
  if (discussionHoverTimer) clearTimeout(discussionHoverTimer)
  if (props.isDiscussionEnabled) {
    showDiscussionPopover.value = true
  }
}

const handleDiscussionMouseLeave = () => {
  discussionHoverTimer = setTimeout(() => {
    showDiscussionPopover.value = false
  }, 200)
}

// 预设下拉框状态
let presetHoverTimer: ReturnType<typeof setTimeout> | null = null

const handlePresetMouseEnter = () => {
  if (presetHoverTimer) clearTimeout(presetHoverTimer)
  showPresetDropdown.value = true
}

const handlePresetMouseLeave = () => {
  presetHoverTimer = setTimeout(() => {
    showPresetDropdown.value = false
  }, 200)
}
</script>

<template>
  <div class="shrink-0 border-t border-border/10 bg-background p-4">
    <div :class="[isMaximized ? 'mx-auto max-w-4xl w-full' : '', 'space-y-3']">
      <!-- 快捷操作按钮 -->
      <div class="flex flex-wrap items-center gap-2 text-sm">
        <button
          class="flex items-center gap-1.5 rounded-full border border-border bg-card px-3.5 py-1.5 text-[13px] text-muted-foreground transition-all hover:bg-accent hover:text-accent-foreground hover:shadow-sm active:scale-95 disabled:cursor-not-allowed disabled:opacity-30"
          :disabled="!hasHistory || isGenerating"
          @click="emit('newChat')"
        >
          <Plus :size="14" />
          <span>{{ t('ai.newChat') }}</span>
        </button>

        <!-- 历史记录按钮 -->
        <button
          class="flex h-8 w-8 items-center justify-center rounded-full border border-border bg-card text-muted-foreground transition-all hover:bg-accent hover:text-accent-foreground hover:scale-110 active:scale-95 shadow-sm"
          :title="t('ai.history')"
          :class="{ 'cursor-not-allowed opacity-50': isGenerating }"
          :disabled="isGenerating"
          @click="emit('openHistory')"
        >
          <History :size="16" />
        </button>

        <div class="h-4 w-px bg-border/30 mx-1" />

        <!-- AI 思考模式开关 -->
        <button
          class="flex h-8 w-8 items-center justify-center rounded-full border transition-all hover:scale-110 active:scale-95 shadow-sm"
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
          class="flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-[13px] transition-all hover:scale-105 active:scale-95 shadow-sm"
          :class="
            isTodoAssistantEnabled
              ? 'border-primary/30 bg-primary/10 text-primary shadow-primary/5'
              : 'border-border bg-card text-muted-foreground hover:bg-accent hover:text-accent-foreground'
          "
          :title="
            isTodoAssistantEnabled ? t('ai.todoAssistantEnabled') : t('ai.todoAssistantDisabled')
          "
          @click="emit('toggleTodo')"
        >
          <Clover :size="14" :class="{ 'animate-spin-slow': isTodoAssistantEnabled }" />
          <span class="font-medium">{{ t('ai.todoAssistant') }}</span>
        </button>

        <!-- 多模型协同讨论 -->
        <div
          class="relative"
          @mouseenter="handleDiscussionMouseEnter"
          @mouseleave="handleDiscussionMouseLeave"
        >
          <button
            class="flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-[13px] transition-all hover:scale-105 active:scale-95 shadow-sm"
            :class="
              isDiscussionEnabled
                ? 'border-primary/30 bg-primary/10 text-primary shadow-primary/5'
                : 'border-border bg-card text-muted-foreground hover:bg-accent hover:text-accent-foreground'
            "
            :title="isDiscussionEnabled ? t('ai.discussionMode') : t('ai.discussionMode')"
            @click="emit('toggleDiscussion')"
          >
            <Users :size="14" :class="{ 'animate-pulse-slow': isDiscussionEnabled }" />
            <span class="font-medium">{{ t('ai.discussionMode') }}</span>
          </button>

          <!-- 讨论模型快速选择弹窗 -->
          <Transition
            enter-active-class="transition-all duration-200 cubic-bezier(0.23, 1, 0.32, 1)"
            leave-active-class="transition-all duration-150 cubic-bezier(0.23, 1, 0.32, 1)"
            enter-from-class="opacity-0 translate-y-2"
            enter-to-class="opacity-100 translate-y-0"
            leave-from-class="opacity-100 translate-y-0"
            leave-to-class="opacity-0 translate-y-2"
          >
            <div
              v-if="showDiscussionPopover && isDiscussionEnabled"
              class="absolute bottom-full left-0 z-50 mb-2 w-64 overflow-hidden rounded-xl border border-border bg-card p-3 shadow-lg"
            >
              <div class="space-y-4">
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
                      class="flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] transition-all"
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
                      class="flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] transition-all"
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
            </div>
          </Transition>
        </div>

        <!-- 生图功能开关 -->
        <button
          class="flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-[13px] transition-all hover:scale-105 active:scale-95 shadow-sm"
          :class="
            isImageGenerationEnabled
              ? 'border-primary/30 bg-primary/10 text-primary shadow-primary/5'
              : 'border-border bg-card text-muted-foreground hover:bg-accent hover:text-accent-foreground'
          "
          :title="t('ai.enableImageGeneration')"
          @click="emit('toggleImageGen')"
        >
          <ImageIcon :size="14" :class="{ 'animate-pulse-slow': isImageGenerationEnabled }" />
          <span class="font-medium">{{ t('ai.enableImageGeneration') }}</span>
        </button>

        <div class="h-4 w-px bg-border/30 mx-0.5" />

        <!-- 预设下拉框 -->
        <div
          class="relative"
          @mouseenter="handlePresetMouseEnter"
          @mouseleave="handlePresetMouseLeave"
        >
          <button
            class="flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-[13px] text-muted-foreground transition-all hover:bg-accent hover:text-accent-foreground hover:shadow-sm active:scale-95 shadow-sm"
            @click="showPresetDropdown = !showPresetDropdown"
          >
            <span class="font-medium">{{ currentPresetName }}</span>
            <ChevronDown
              :size="14"
              class="transition-transform duration-300"
              :class="{ 'rotate-180': showPresetDropdown }"
            />
          </button>
          <!-- 下拉菜单 -->
          <Transition
            enter-active-class="transition-all duration-200 cubic-bezier(0.23, 1, 0.32, 1)"
            leave-active-class="transition-all duration-150 cubic-bezier(0.23, 1, 0.32, 1)"
            enter-from-class="opacity-0 translate-y-2"
            enter-to-class="opacity-100 translate-y-0"
            leave-from-class="opacity-100 translate-y-0"
            leave-to-class="opacity-0 translate-y-2"
          >
            <div
              v-if="showPresetDropdown"
              class="absolute bottom-full left-0 z-50 mb-2 min-w-[160px] overflow-hidden rounded-lg border border-border bg-card py-1 shadow-lg"
            >
              <button
                v-for="preset in presets"
                :key="preset.id"
                class="flex w-full items-center gap-2 px-3 py-2 text-left text-xs transition-colors hover:bg-accent"
                :class="{
                  'bg-accent text-primary': activePreset?.id === preset.id,
                  'text-foreground': activePreset?.id !== preset.id,
                }"
                @click="emit('selectPreset', preset.id)"
              >
                <Check v-if="activePreset?.id === preset.id" :size="12" class="text-primary" />
                <span :class="{ 'ml-4': activePreset?.id !== preset.id }">{{ preset.name }}</span>
              </button>
              <!-- 分割线 + 设置入口 -->
              <div class="my-1 border-t border-border" />
              <button
                class="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                @click="emit('openSettings', 'presets')"
              >
                <Settings2 :size="12" />
                <span>{{ t('ai.managePresets') }}</span>
              </button>
            </div>
          </Transition>
        </div>

        <div class="flex-1" />

        <!-- 设置 -->
        <div class="flex items-center gap-2">
          <button
            class="flex h-8 w-8 items-center justify-center rounded-full border border-border bg-card text-muted-foreground transition-all hover:bg-accent hover:text-accent-foreground hover:scale-110 active:scale-95 shadow-sm"
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
