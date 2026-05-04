<script setup lang="ts">
import { computed, type Component } from 'vue'
import { useI18n } from 'vue-i18n'
import { GraduationCap, Clover, LayoutGrid, Check, ChevronDown, BookOpen } from 'lucide-vue-next'
import AiLuminaIcon from './AiLuminaIcon.vue'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useHoverPopover } from '@/features/ai/composables/useHoverPopover'
import { useAiModeItems, type AiModeId } from '@/features/ai/composables/useAiModeItems'

const props = defineProps<{
  isMobile: boolean
  isTeachingEnabled: boolean
  isNovelEnabled: boolean
  isTodoAssistantEnabled: boolean
  isImageGenerationEnabled: boolean
}>()

const open = defineModel<boolean>('open', { default: false })

const emit = defineEmits<{
  (e: 'toggleTeaching'): void
  (e: 'toggleNovel'): void
  (e: 'toggleTodo'): void
  (e: 'toggleImageGen'): void
}>()

const { t } = useI18n()
const hover = useHoverPopover({ open })

// Toolbar 下拉不包含「多模型协同讨论」（该模式在 Toolbar 有独立入口），
// 故仅注入四项 inputs，useAiModeItems 会自动按统一顺序输出。
const modeItems = useAiModeItems({
  todo: { active: () => props.isTodoAssistantEnabled, toggle: () => emit('toggleTodo') },
  teaching: { active: () => props.isTeachingEnabled, toggle: () => emit('toggleTeaching') },
  draw: { active: () => props.isImageGenerationEnabled, toggle: () => emit('toggleImageGen') },
  novel: { active: () => props.isNovelEnabled, toggle: () => emit('toggleNovel') },
})

// Toolbar 下拉按模式 id 映射的图标（绘图使用品牌自定义 AiLuminaIcon）
// 仅包含本组件实际渲染的模式，discuss 由 Toolbar 独立入口处理
const MODE_ICON: Partial<Record<AiModeId, Component>> = {
  todo: Clover,
  teaching: GraduationCap,
  draw: AiLuminaIcon,
  novel: BookOpen,
}

// 激活状态下的额外图标动画类（保留原有视觉效果）
const iconAnimClass = (id: AiModeId, active: boolean): string => {
  if (!active) return ''
  if (id === 'todo') return 'animate-spin-slow'
  if (id === 'draw') return 'animate-pulse-slow'
  return ''
}

const activeModesCount = computed(() => modeItems.value.filter((m) => m.active).length)
</script>

<template>
  <div class="relative shrink-0" @mouseenter="hover.onMouseEnter" @mouseleave="hover.onMouseLeave">
    <DropdownMenu v-model:open="open" :modal="false">
      <DropdownMenuTrigger as-child>
        <button
          :class="[
            'toolbar-btn flex items-center border border-transparent text-muted-foreground active:scale-95 rounded-full',
            isMobile ? 'h-8 px-2.5 gap-1' : 'px-3 py-1.5 gap-1.5 text-[13px]',
            activeModesCount > 0 ? '!border-primary/20 !bg-primary/5 !text-primary' : '',
            open ? 'bg-accent/50 text-foreground border-border/20' : '',
          ]"
          :title="t('ai.modes')"
          @mouseenter="hover.clear"
        >
          <div class="relative flex h-4 w-4 items-center justify-center">
            <LayoutGrid :size="14" />
            <div
              v-if="activeModesCount > 0"
              class="absolute -right-1 -top-1 flex h-2.5 w-2.5 items-center justify-center rounded-full bg-primary text-[8px] font-bold text-primary-foreground"
            >
              {{ activeModesCount }}
            </div>
          </div>
          <span v-if="!isMobile" class="toolbar-text font-medium">{{ t('ai.modes') }}</span>
          <ChevronDown
            :size="14"
            class="transition-transform duration-300 opacity-50"
            :class="{ 'rotate-180': open }"
          />
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        side="top"
        align="start"
        :side-offset="4"
        class="z-[251] min-w-[200px] p-1"
      >
        <div @mouseenter="hover.clear" @mouseleave="hover.onMouseLeave">
          <DropdownMenuItem
            v-for="mode in modeItems"
            :key="mode.id"
            class="flex w-full items-center justify-between gap-2 px-3 py-2 text-xs"
            :class="{ 'bg-accent/50 text-primary': mode.active }"
            @click.stop="mode.toggle()"
          >
            <div class="flex items-center gap-2">
              <component
                :is="MODE_ICON[mode.id]"
                :size="14"
                :class="iconAnimClass(mode.id, mode.active)"
              />
              <span>{{ mode.title }}</span>
            </div>
            <Check v-if="mode.active" :size="12" class="text-primary" />
          </DropdownMenuItem>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  </div>
</template>
