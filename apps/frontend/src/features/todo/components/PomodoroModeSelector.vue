<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { Rocket, Zap, Timer, Globe } from 'lucide-vue-next'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu'
import { POMODORO_MODES, type PomodoroMode } from '../stores/pomodoro'

const { t } = useI18n()

const emit = defineEmits<{
  select: [mode: PomodoroMode]
}>()

const modes = [
  { id: 'icebreaker' as PomodoroMode, icon: Zap, color: 'text-orange-500' },
  { id: 'classic' as PomodoroMode, icon: Timer, color: 'text-primary' },
  { id: 'flow' as PomodoroMode, icon: Rocket, color: 'text-blue-500' },
  { id: 'cosmos' as PomodoroMode, icon: Globe, color: 'text-purple-500' },
]
</script>

<template>
  <DropdownMenu>
    <DropdownMenuTrigger as-child>
      <slot />
    </DropdownMenuTrigger>
    <DropdownMenuContent align="end" class="w-64 p-2">
      <DropdownMenuLabel
        class="px-2 py-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider"
      >
        {{ t('todo.focus') }}
      </DropdownMenuLabel>
      <DropdownMenuSeparator />
      <DropdownMenuItem
        v-for="mode in modes"
        :key="mode.id"
        class="flex items-start gap-3 p-3 cursor-pointer rounded-xl transition-all duration-200 hover:bg-accent group"
        @click="emit('select', mode.id)"
      >
        <div
          class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent/50 transition-colors group-hover:bg-accent"
          :class="mode.color"
        >
          <component :is="mode.icon" class="h-5 w-5" />
        </div>
        <div class="flex flex-col gap-0.5">
          <span class="font-bold text-sm leading-none">{{ t(`pomodoro.modes.${mode.id}`) }}</span>
          <span class="text-xs text-muted-foreground leading-snug">
            {{ t(`pomodoro.modes.${mode.id}_desc`) }}
          </span>
          <div class="flex items-center gap-1.5 mt-1.5">
            <span
              class="px-1.5 py-0.5 rounded-md bg-primary/10 text-[10px] font-medium text-primary"
            >
              {{ POMODORO_MODES[mode.id].focus }}m
            </span>
            <span class="text-[10px] text-muted-foreground">/</span>
            <span
              class="px-1.5 py-0.5 rounded-md bg-muted text-[10px] font-medium text-muted-foreground"
            >
              {{ POMODORO_MODES[mode.id].shortBreak }}m
            </span>
          </div>
        </div>
      </DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>
</template>
