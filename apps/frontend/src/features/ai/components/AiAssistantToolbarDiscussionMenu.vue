<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import type { AIPreset, AIConfig } from '@/features/ai/composables/useAIConfig'
import { Users, Check } from 'lucide-vue-next'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useHoverPopover } from '@/features/ai/composables/useHoverPopover'

defineProps<{
  isMobile: boolean
  isDiscussionEnabled: boolean
  presets: AIPreset[]
  config: AIConfig
}>()

const open = defineModel<boolean>('open', { default: false })

const emit = defineEmits<{
  (e: 'toggle'): void
  (e: 'selectPrimaryModel', id: string): void
  (e: 'toggleSecondaryModel', id: string): void
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
            'toolbar-btn flex items-center transition-all active:scale-95 rounded-full border',
            isMobile ? 'h-8 w-8 justify-center' : 'px-3.5 py-1.5 gap-1.5 text-[13px]',
            isDiscussionEnabled
              ? 'border-primary/30 bg-primary/15 text-primary shadow-[0_0_12px_hsl(var(--primary)_/_0.1)]'
              : 'border-transparent text-muted-foreground',
          ]"
          :title="t('ai.discussionMode')"
          @click="emit('toggle')"
          @mouseenter="hover.clear"
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
        <div class="space-y-4" @mouseenter="hover.clear" @mouseleave="hover.onMouseLeave">
          <div class="space-y-2">
            <p
              class="text-[10px] font-bold text-muted-foreground uppercase tracking-widest opacity-70"
            >
              {{ t('ai.discussionPrimaryModel') }}
            </p>
            <div v-if="presets.length === 0" class="text-[11px] text-muted-foreground/50 py-1">
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
                <Check
                  v-if="config.discussionPrimaryModelId === preset.id"
                  :size="10"
                  stroke-width="3"
                />
                <span class="font-medium">{{ preset.name }}</span>
              </button>
            </div>
          </div>

          <div class="space-y-2">
            <p
              class="text-[10px] font-bold text-muted-foreground uppercase tracking-widest opacity-70"
            >
              {{ t('ai.discussionSecondaryModels') }}
            </p>
            <div v-if="presets.length === 0" class="text-[11px] text-muted-foreground/50 py-1">
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
</template>
