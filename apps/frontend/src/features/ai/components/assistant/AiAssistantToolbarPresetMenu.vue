<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import type { AIPreset } from '@/features/ai/composables/useAIConfig'
import { ChevronDown, Settings2, Check } from 'lucide-vue-next'
import AiLuminaIcon from '../AiLuminaIcon.vue'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
import { useHoverPopover } from '@/features/ai/composables/useHoverPopover'

defineProps<{
  isMobile: boolean
  currentPresetName: string
  presets: AIPreset[]
  activePreset: AIPreset | null
}>()

const open = defineModel<boolean>('open', { default: false })

const emit = defineEmits<{
  (e: 'selectPreset', id: string): void
  (e: 'openPresetsSettings'): void
}>()

const { t } = useI18n()
const hover = useHoverPopover({ open })
</script>

<template>
  <div class="relative shrink-0" @mouseenter="hover.onMouseEnter" @mouseleave="hover.onMouseLeave">
    <DropdownMenu v-model:open="open" :modal="false">
      <DropdownMenuTrigger as-child>
        <button
          :class="[
            'toolbar-btn flex items-center border border-transparent text-muted-foreground active:scale-95 rounded-full',
            isMobile ? 'h-8 px-2.5 gap-1' : 'px-3 py-1.5 gap-1.5 text-[13px]',
            open ? 'bg-accent/50 text-foreground border-border/20' : '',
          ]"
          :title="t('ai.managePresets')"
          @mouseenter="hover.clear"
        >
          <AiLuminaIcon
            :size="14"
            class="toolbar-icon-only text-primary/70"
            :class="{ hidden: !isMobile }"
          />
          <span v-if="!isMobile" class="toolbar-text font-medium">{{ currentPresetName }}</span>
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
        class="z-[251] min-w-[160px] p-1"
      >
        <div @mouseenter="hover.clear" @mouseleave="hover.onMouseLeave">
          <DropdownMenuItem
            v-for="preset in presets"
            :key="preset.id"
            class="flex w-full items-center gap-2 px-3 py-2 text-xs"
            :class="{ 'bg-accent text-primary': activePreset?.id === preset.id }"
            @click="emit('selectPreset', preset.id)"
            @mouseenter="hover.clear"
          >
            <div class="flex h-4 w-4 items-center justify-center">
              <Check v-if="activePreset?.id === preset.id" :size="12" class="text-primary" />
            </div>
            <span>{{ preset.name }}</span>
          </DropdownMenuItem>

          <DropdownMenuSeparator />

          <DropdownMenuItem
            class="flex w-full items-center gap-2 px-3 py-2 text-xs text-muted-foreground"
            @click="emit('openPresetsSettings')"
            @mouseenter="hover.clear"
          >
            <Settings2 :size="12" />
            <span>{{ t('ai.managePresets') }}</span>
          </DropdownMenuItem>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  </div>
</template>
