<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { Lightbulb, Check } from 'lucide-vue-next'
import type { ThinkingMode } from '@/features/ai/composables/useAIConfig/types'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useHoverPopover } from '@/features/ai/composables/useHoverPopover'

const props = defineProps<{
  currentLevel: ThinkingMode
  isMobile?: boolean
}>()

const open = defineModel<boolean>('open', { default: false })

const emit = defineEmits<{
  (e: 'update:level', level: ThinkingMode): void
}>()

const { t } = useI18n()
const hover = useHoverPopover({ open })

const ALL_LEVELS: ThinkingMode[] = ['off', 'auto', 'high', 'xhigh']

const levelLabel = (lv: ThinkingMode): string => {
  const map: Record<ThinkingMode, string> = {
    off: t('ai.thinkingLevelOff'),
    auto: t('ai.thinkingLevelAuto'),
    high: t('ai.thinkingLevelHigh'),
    xhigh: t('ai.thinkingLevelXhigh'),
  }
  return map[lv] || lv
}

const levelDesc = (lv: ThinkingMode): string => {
  const map: Record<ThinkingMode, string> = {
    off: t('ai.thinkingLevelOffDesc'),
    auto: t('ai.thinkingLevelAutoDesc'),
    high: t('ai.thinkingLevelHighDesc'),
    xhigh: t('ai.thinkingLevelXhighDesc'),
  }
  return map[lv] || ''
}

const isActive = computed(() => props.currentLevel !== 'off')
</script>

<template>
  <div class="relative shrink-0" @mouseenter="hover.onMouseEnter" @mouseleave="hover.onMouseLeave">
    <DropdownMenu v-model:open="open" :modal="false">
      <DropdownMenuTrigger as-child>
        <button
          :class="[
            'toolbar-btn relative flex shrink-0 items-center justify-center rounded-full border active:scale-95 transition-all duration-700',
            isMobile ? 'h-8 w-8' : 'h-8 w-8',
            isActive
              ? 'border-primary/40 bg-gradient-to-br from-primary/10 to-primary/5 text-primary shadow-[0_4px_12px_rgba(var(--primary-rgb),0.12)]'
              : 'border-transparent',
          ]"
          :title="t('ai.thinkingMode')"
          @mouseenter="hover.clear"
        >
          <!-- 激活状态下的外层扩散光圈 -->
          <div
            v-if="isActive"
            class="absolute inset-0 rounded-full animate-ping-slow bg-primary/20"
          ></div>

          <Lightbulb
            :size="16"
            :class="[
              'relative z-10 transition-all duration-700 ease-soft-spring',
              isActive
                ? 'text-primary scale-110 filter drop-shadow-[0_0_5px_rgba(var(--primary-rgb),0.4)]'
                : 'text-muted-foreground opacity-60',
            ]"
            :stroke-width="isActive ? 2.5 : 2"
          />

          <!-- 极简激活指示点 -->
          <div
            v-if="isActive"
            class="absolute bottom-1.5 right-1.5 h-1 w-1 rounded-full bg-primary shadow-[0_0_4px_rgba(var(--primary-rgb),0.8)]"
          ></div>
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        side="top"
        align="center"
        :side-offset="4"
        class="z-[251] min-w-[200px] p-1"
      >
        <div @mouseenter="hover.clear" @mouseleave="hover.onMouseLeave">
          <DropdownMenuItem
            v-for="lv in ALL_LEVELS"
            :key="lv"
            class="flex w-full items-start gap-2 px-3 py-2.5 text-xs"
            :class="{ 'bg-accent text-primary': currentLevel === lv }"
            @click="emit('update:level', lv)"
            @mouseenter="hover.clear"
          >
            <div class="flex h-4 w-4 shrink-0 items-center justify-center pt-0.5">
              <Check v-if="currentLevel === lv" :size="12" class="text-primary" />
            </div>
            <div class="flex flex-col gap-0.5">
              <span class="font-medium leading-none">{{ levelLabel(lv) }}</span>
              <span class="text-[10px] leading-tight text-muted-foreground">
                {{ levelDesc(lv) }}
              </span>
            </div>
          </DropdownMenuItem>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  </div>
</template>
