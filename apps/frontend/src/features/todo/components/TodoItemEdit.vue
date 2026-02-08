<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { Check, X } from 'lucide-vue-next'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip'

const { t } = useI18n()

defineProps<{
  modelValue: string
  inputId: string
  error: string | null
  showTooltip: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
  save: []
  cancel: []
  keydown: [e: KeyboardEvent]
}>()

const inputRef = ref<InstanceType<typeof Input> | null>(null)

onMounted(() => {
  inputRef.value?.$el?.focus?.()
})

defineExpose({
  focus: () => inputRef.value?.$el?.focus?.(),
})
</script>

<template>
  <div class="flex flex-1 items-center gap-2">
    <TooltipProvider :delay-duration="0">
      <Tooltip :open="showTooltip">
        <TooltipTrigger as-child>
          <div class="flex-1">
            <label :for="inputId" class="sr-only">{{ t('todo.editPlaceholder') }}</label>
            <Input
              :id="inputId"
              ref="inputRef"
              name="edit-todo"
              :model-value="modelValue"
              type="text"
              class="h-10 w-full bg-background text-foreground text-base focus-visible:ring-primary/20"
              :placeholder="t('todo.editPlaceholder')"
              @update:model-value="emit('update:modelValue', $event as string)"
              @keydown="emit('keydown', $event)"
              @blur="emit('save')"
            />
          </div>
        </TooltipTrigger>
        <TooltipContent
          v-if="error"
          side="top"
          align="start"
          class="bg-destructive text-destructive-foreground border-none"
        >
          <p>{{ error.includes('.') ? t(error) : error }}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>

    <div class="flex items-center gap-1">
      <TooltipProvider :delay-duration="0">
        <Tooltip>
          <TooltipTrigger as-child>
            <Button
              variant="ghost"
              size="icon"
              class="h-8 w-8 text-success hover:bg-success/10"
              @click="emit('save')"
            >
              <Check class="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="top">{{ t('todo.save') }}</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger as-child>
            <Button
              variant="ghost"
              size="icon"
              class="h-8 w-8 text-muted-foreground hover:bg-muted"
              @click="emit('cancel')"
            >
              <X class="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="top">{{ t('todo.cancel') }}</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  </div>
</template>
