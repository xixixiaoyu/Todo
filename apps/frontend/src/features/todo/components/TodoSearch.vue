<script setup lang="ts">
import { onMounted, ref, useId } from 'vue'
import { useI18n } from 'vue-i18n'
import { Search, X } from 'lucide-vue-next'
import { useIsMobile } from '@/composables/useWindowSize'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

const { t } = useI18n()
const { isMobile } = useIsMobile()
const inputId = useId()

const props = defineProps<{
  modelValue: string
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
  clear: []
  close: []
}>()

const inputRef = ref<InstanceType<typeof Input> | null>(null)

function handleClear() {
  emit('clear')
  inputRef.value?.$el?.focus()
}

function handleKeyDown(e: KeyboardEvent) {
  if (e.key === 'Escape') {
    if (props.modelValue) {
      handleClear()
    } else {
      emit('close')
    }
  }
}

onMounted(() => {
  // 仅在非移动端自动聚焦
  // 延迟一小会儿聚焦，确保 Transition 动画不影响聚焦效果
  if (!isMobile.value) {
    setTimeout(() => {
      inputRef.value?.$el?.focus()
    }, 150)
  }
})
</script>

<template>
  <div class="mb-4 relative group">
    <Search
      :size="18"
      class="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors group-focus-within:text-primary"
    />
    <label :for="inputId" class="sr-only">{{ t('todo.searchPlaceholder') }}</label>
    <Input
      :id="inputId"
      ref="inputRef"
      name="todo-search"
      :model-value="modelValue"
      type="text"
      :placeholder="t('todo.searchPlaceholder')"
      class="h-11 pl-11 pr-11 text-base bg-muted/30 border-none rounded-xl focus-visible:ring-primary/20"
      @update:model-value="emit('update:modelValue', $event as string)"
      @keydown="handleKeyDown"
    />
    <Button
      v-if="modelValue"
      variant="ghost"
      size="icon"
      class="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8 text-muted-foreground hover:text-foreground"
      @click="handleClear"
    >
      <X :size="16" />
    </Button>
  </div>
</template>
