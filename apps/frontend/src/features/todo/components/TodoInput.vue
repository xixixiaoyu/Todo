<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { Plus } from 'lucide-vue-next'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'

const { t } = useI18n()

defineProps<{
  modelValue: string
  isShaking: boolean
  showTooltip: boolean
  errorMessage: string
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
  add: []
  keydown: [e: KeyboardEvent]
}>()
</script>

<template>
  <div class="relative mb-8">
    <div class="flex items-center gap-3">
      <div class="relative flex-1 group">
        <TooltipProvider :delay-duration="0">
          <Tooltip :open="showTooltip">
            <TooltipTrigger as-child>
              <div :class="isShaking ? 'animate-shake' : ''">
                <Input
                  :model-value="modelValue"
                  type="text"
                  :placeholder="t('todo.inputPlaceholder')"
                  class="h-10 px-4 text-sm rounded-xl border-border bg-card shadow-sm transition-all focus-visible:ring-primary/20 group-hover:border-primary/30"
                  :class="isShaking ? 'border-destructive' : ''"
                  @update:model-value="emit('update:modelValue', $event as string)"
                  @keydown="emit('keydown', $event)"
                />
              </div>
            </TooltipTrigger>
            <TooltipContent
              side="top"
              align="start"
              class="bg-destructive text-destructive-foreground border-none"
            >
              <p>{{ errorMessage?.includes('.') ? t(errorMessage) : errorMessage || '' }}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
      <Button
        class="h-10 px-4 rounded-xl font-medium shadow-sm transition-all active:scale-95"
        @click="emit('add')"
      >
        <Plus class="mr-1.5 h-4 w-4" />
        {{ t('todo.add') }}
      </Button>
    </div>
  </div>
</template>
