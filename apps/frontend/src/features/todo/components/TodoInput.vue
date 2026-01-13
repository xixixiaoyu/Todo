<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { Plus } from 'lucide-vue-next'
import { ref, onMounted } from 'vue'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'

const { t } = useI18n()

defineProps<{
  modelValue: string
  showTooltip: boolean
  errorMessage: string
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
  add: []
  keydown: [e: KeyboardEvent]
}>()

const inputRef = ref<InstanceType<typeof Input> | null>(null)

onMounted(() => {
  inputRef.value?.$el?.focus?.()
})
</script>

<template>
  <div class="relative mb-6">
    <div class="flex items-center gap-3">
      <div class="relative flex-1 group">
        <TooltipProvider :delay-duration="0">
          <Tooltip :open="showTooltip">
            <TooltipTrigger as-child>
              <div>
                <Input
                  ref="inputRef"
                  :model-value="modelValue"
                  type="text"
                  :placeholder="t('todo.inputPlaceholder')"
                  class="h-12 px-5 text-base rounded-xl border-border bg-card shadow-[0_8px_30px_rgb(0,0,0,0.04)] transition-all focus-visible:ring-primary/20 group-hover:border-primary/30 group-hover:shadow-[0_8px_30px_rgb(0,0,0,0.08)]"
                  :class="{ 'border-destructive focus-visible:ring-destructive/20': errorMessage }"
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
        class="h-12 px-6 rounded-xl text-base font-semibold shadow-[0_8px_20px_-4px_rgba(var(--primary),0.3)] transition-all active:scale-95 hover:shadow-[0_12px_25px_-4px_rgba(var(--primary),0.4)]"
        @click="emit('add')"
      >
        <Plus class="mr-1.5 h-5 w-5" />
        {{ t('todo.add') }}
      </Button>
    </div>
  </div>
</template>
