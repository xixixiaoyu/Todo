<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { onClickOutside } from '@vueuse/core'
import { Check, X } from 'lucide-vue-next'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip'
import { useTodoStore } from '../stores/todo'
import { useHaptics, ImpactStyle } from '@/composables/useHaptics'

const { t } = useI18n()
const store = useTodoStore()
const { hapticImpact } = useHaptics()

const props = defineProps<{
  parentId: string
  inputId: string
  error: string | null
  showTooltip: boolean
}>()

const emit = defineEmits<{
  added: []
  cancel: []
}>()

const newTitle = ref('')
const inputRef = ref<InstanceType<typeof Input> | null>(null)
const containerRef = ref<HTMLElement | null>(null)

onMounted(() => {
  inputRef.value?.$el?.focus?.()
})

onClickOutside(containerRef, () => {
  emit('cancel')
})

async function handleSubmit() {
  if (newTitle.value.trim()) {
    store.setSilencingToast(true)
    store.clearError()
    const success = await store.addTodo(newTitle.value, props.parentId)
    if (success) {
      await hapticImpact(ImpactStyle.Light)
      newTitle.value = ''
      emit('added')
      store.setSilencingToast(false)
    } else {
      setTimeout(() => {
        store.setSilencingToast(false)
      }, 2000)
    }
  }
}
</script>

<template>
  <div
    ref="containerRef"
    class="flex items-center gap-2 px-4 py-2.5 ml-10 border-l-2 border-primary/10"
  >
    <TooltipProvider :delay-duration="0">
      <Tooltip :open="showTooltip">
        <TooltipTrigger as-child>
          <div class="flex-1">
            <label :for="inputId" class="sr-only">{{ t('todo.subtaskPlaceholder') }}</label>
            <Input
              :id="inputId"
              ref="inputRef"
              v-model="newTitle"
              name="new-subtask"
              type="text"
              class="h-9 w-full bg-background text-sm"
              :placeholder="t('todo.subtaskPlaceholder')"
              @keydown.enter="handleSubmit"
              @keydown.esc="emit('cancel')"
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
              @click="handleSubmit"
            >
              <Check class="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="top">{{ t('todo.add') }}</TooltipContent>
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
