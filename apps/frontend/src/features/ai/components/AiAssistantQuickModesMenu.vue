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
 * AI 助手主入口 — 统一胶囊设计（主按钮 + 分割线 + 辅助 chevron）。
 *
 * 视觉：
 *   - 整体容器：柔和背景 + 圆角边框的胶囊，hover 时加深
 *   - 主按钮（左侧）：Clover 图标 + "AI 助手" 文案，点击打开 Drawer
 *   - 分割线：垂直细线分隔主按钮与 chevron
 *   - Chevron（右侧）：下拉箭头，提示「有菜单」
 *
 * 交互：
 *   - 点击主按钮：打开 AI 助手 Drawer
 *   - 悬浮 chevron（仅 fine pointer 设备）：延迟 150ms 弹出模式菜单，延迟 200ms 收起
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
const hover = useHoverPopover({ open, openDelayMs: 150, closeDelayMs: 200 })

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
    class="flex items-center p-0.5 bg-muted/40 rounded-[14px] border border-border/40 transition-all duration-300 hover:bg-muted/60 hover:border-border/60"
  >
    <!-- 主按钮：左侧主体 -->
    <button
      type="button"
      class="h-7 md:h-8 flex items-center gap-1.5 px-2.5 rounded-[10px] text-muted-foreground hover:text-primary hover:bg-background shadow-none transition-all duration-300 group/ai"
      @click.stop="openAssistant"
    >
      <div
        class="flex items-center justify-center w-4.5 h-4.5 md:w-5 md:h-5 rounded-md bg-primary/10 text-primary transition-all duration-300 group-hover/ai:bg-primary/20"
      >
        <Clover :size="12" class="md:h-3.5 md:w-3.5" />
      </div>
      <span class="text-[11px] md:text-xs font-semibold tracking-tight">
        {{ t('ai.assistant') }}
      </span>
    </button>

    <!-- 垂直分割线 -->
    <div class="mx-0.5 w-px h-3 bg-border/60"></div>

    <!-- 辅助 chevron：右侧触发区域 -->
    <DropdownMenu v-model:open="open" :modal="false">
      <DropdownMenuTrigger as-child>
        <button
          type="button"
          :aria-label="t('ai.modes')"
          :title="t('ai.modes')"
          class="w-6 h-7 md:w-7 md:h-8 flex items-center justify-center rounded-[10px] text-muted-foreground hover:text-primary hover:bg-background transition-all duration-300 focus:outline-none"
          @mouseenter="hover.onMouseEnter"
          @mouseleave="hover.onMouseLeave"
        >
          <ChevronDown
            :size="12"
            class="transition-transform duration-500"
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
