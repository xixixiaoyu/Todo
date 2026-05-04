<script setup lang="ts">
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
import { computed } from 'vue'

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

const activeModesCount = computed(() => {
  let count = 0
  if (props.isTeachingEnabled) count++
  if (props.isNovelEnabled) count++
  if (props.isTodoAssistantEnabled) count++
  if (props.isImageGenerationEnabled) count++
  return count
})
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
          <!-- Todo Assistant -->
          <DropdownMenuItem
            class="flex w-full items-center justify-between gap-2 px-3 py-2 text-xs"
            :class="{ 'bg-accent/50 text-primary': isTodoAssistantEnabled }"
            @click.stop="emit('toggleTodo')"
          >
            <div class="flex items-center gap-2">
              <Clover :size="14" :class="{ 'animate-spin-slow': isTodoAssistantEnabled }" />
              <span>{{ t('ai.todoAssistant') }}</span>
            </div>
            <Check v-if="isTodoAssistantEnabled" :size="12" class="text-primary" />
          </DropdownMenuItem>

          <!-- Teaching Mode -->
          <DropdownMenuItem
            class="flex w-full items-center justify-between gap-2 px-3 py-2 text-xs"
            :class="{ 'bg-accent/50 text-primary': isTeachingEnabled }"
            @click.stop="emit('toggleTeaching')"
          >
            <div class="flex items-center gap-2">
              <GraduationCap :size="14" />
              <span>{{ t('ai.teachingMode') }}</span>
            </div>
            <Check v-if="isTeachingEnabled" :size="12" class="text-primary" />
          </DropdownMenuItem>

          <!-- Image Gen -->
          <DropdownMenuItem
            class="flex w-full items-center justify-between gap-2 px-3 py-2 text-xs"
            :class="{ 'bg-accent/50 text-primary': isImageGenerationEnabled }"
            @click.stop="emit('toggleImageGen')"
          >
            <div class="flex items-center gap-2">
              <AiLuminaIcon
                :size="14"
                :class="{ 'animate-pulse-slow': isImageGenerationEnabled }"
              />
              <span>{{ t('ai.enableImageGeneration') }}</span>
            </div>
            <Check v-if="isImageGenerationEnabled" :size="12" class="text-primary" />
          </DropdownMenuItem>

          <!-- Novel Mode -->
          <DropdownMenuItem
            class="flex w-full items-center justify-between gap-2 px-3 py-2 text-xs"
            :class="{ 'bg-accent/50 text-primary': isNovelEnabled }"
            @click.stop="emit('toggleNovel')"
          >
            <div class="flex items-center gap-2">
              <BookOpen :size="14" />
              <span>{{ t('ai.novelMode') }}</span>
            </div>
            <Check v-if="isNovelEnabled" :size="12" class="text-primary" />
          </DropdownMenuItem>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  </div>
</template>
