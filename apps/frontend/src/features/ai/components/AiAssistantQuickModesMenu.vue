<script setup lang="ts">
import { ref, type Component } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  ChevronDown,
  Clover,
  GraduationCap,
  BookOpen,
  Languages,
  MessageSquare,
} from 'lucide-vue-next'
import AiLuminaIcon from '@/features/ai/components/AiLuminaIcon.vue'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useAIConfig } from '@/features/ai/composables/useAIConfig'
import { useAiAssistantModes } from '@/features/ai/composables/useAiAssistantModes'
import { useAiModeItems, type AiModeId } from '@/features/ai/composables/useAiModeItems'
import { useHoverPopover } from '@/features/ai/composables/useHoverPopover'
import { useTodoStore } from '@/features/todo/stores/todo'

/**
 * AI 助手主入口 — 分离式设计（主按钮 + 辅助 chevron）。
 *
 * 视觉：
 *   - 主按钮：独立胶囊，承载「AI 助手」品牌感（与既有设计一致）
 *   - Chevron：紧贴主按钮的窄胶囊（w-6），降低饱和度的小箭头，作为「有菜单」的
 *     可发现性提示，不喧宾夺主
 *
 * 交互：
 *   - 点击主按钮：打开 AI 助手 Drawer
 *   - 悬浮主按钮或 chevron（仅 fine pointer 设备）：延迟 200ms 弹出模式菜单，延迟 200ms 收起
 *   - 点击 chevron：手动切换菜单开合（无需等待 hover 延迟）
 *   - 菜单项点击：打开 Drawer + 切到对应模式（已激活则仅开 Drawer，避免误关）
 *
 * 移动端自动降级：useHoverPopover 内置 `(hover: hover)` 检测，触屏设备仅响应点击。
 */

const { t } = useI18n()
const todoStore = useTodoStore()
const { config, updateConfig } = useAIConfig()
const {
  isTeachingEnabled,
  toggleTeachingMode,
  isNovelEnabled,
  toggleNovelMode,
  isTranslationEnabled,
  toggleTranslationMode,
  isTodoAssistantEnabled,
  toggleTodoAssistant,
  isImageGenerationEnabled,
  toggleImageGeneration,
} = useAiAssistantModes({ config, updateConfig })

const modeItems = useAiModeItems({
  todo: { active: () => isTodoAssistantEnabled.value, toggle: toggleTodoAssistant },
  teaching: { active: () => isTeachingEnabled.value, toggle: toggleTeachingMode },
  draw: { active: () => isImageGenerationEnabled.value, toggle: toggleImageGeneration },
  novel: { active: () => isNovelEnabled.value, toggle: toggleNovelMode },
  translation: { active: () => isTranslationEnabled.value, toggle: toggleTranslationMode },
})

const MODE_ICON: Record<AiModeId, Component> = {
  todo: Clover,
  teaching: GraduationCap,
  draw: AiLuminaIcon,
  discuss: MessageSquare,
  novel: BookOpen,
  translation: Languages,
}

const open = ref(false)
const hover = useHoverPopover({ open, openDelayMs: 200, closeDelayMs: 200 })

const openAssistant = () => {
  if (!todoStore.isDrawerOpen) todoStore.setDrawerOpen(true)
}

const handleActivate = (mode: { active: boolean; toggle: () => void }) => {
  if (!todoStore.isDrawerOpen) todoStore.setDrawerOpen(true)
  if (!mode.active) mode.toggle()
  open.value = false
}
</script>

<template>
  <div
    class="flex items-center gap-1"
    @mouseenter="hover.onMouseEnter"
    @mouseleave="hover.onMouseLeave"
  >
    <!-- 主按钮：沿用既有独立胶囊样式 -->
    <Button
      variant="ghost"
      size="sm"
      class="h-8 rounded-[18px] border border-primary/15 bg-primary/10 px-3 text-primary shadow-none transition-all duration-300 gap-1.5 font-semibold hover:bg-primary/15 md:h-9 md:rounded-xl md:px-3 group/ai touch-manipulation"
      @click.stop="openAssistant"
    >
      <Clover
        :size="14"
        class="md:h-4 md:w-4 transition-transform duration-300 group-hover/ai:rotate-12 group-hover/ai:scale-110"
      />
      <span class="text-[var(--todo-font-meta)] tracking-[0.02em]">
        {{ t('ai.assistant') }}
      </span>
    </Button>

    <!-- 辅助 chevron：窄胶囊，低饱和，提示「有菜单」 -->
    <DropdownMenu v-model:open="open" :modal="false">
      <DropdownMenuTrigger as-child>
        <button
          type="button"
          :aria-label="t('ai.modes')"
          :title="t('ai.modes')"
          class="inline-flex h-8 w-6 items-center justify-center rounded-full border border-primary/10 bg-primary/5 text-primary/70 transition-all duration-300 hover:bg-primary/15 hover:text-primary md:h-9 md:w-7 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
          @mouseenter="hover.onMouseEnter"
        >
          <ChevronDown
            :size="12"
            class="transition-transform duration-300"
            :class="{ 'rotate-180': open }"
          />
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="end"
        :side-offset="6"
        class="z-[251] min-w-[180px] rounded-xl p-1"
      >
        <div @mouseenter="hover.clear" @mouseleave="hover.onMouseLeave">
          <DropdownMenuItem
            v-for="mode in modeItems"
            :key="mode.id"
            class="flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-xs"
            :class="{ 'bg-accent/50 text-primary': mode.active }"
            @click.stop="handleActivate(mode)"
          >
            <component :is="MODE_ICON[mode.id]" :size="14" class="shrink-0" />
            <span class="flex-1">{{ mode.title }}</span>
            <span
              v-if="mode.active"
              class="h-1.5 w-1.5 rounded-full bg-primary"
              aria-hidden="true"
            ></span>
          </DropdownMenuItem>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  </div>
</template>
