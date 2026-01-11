<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { Search, X } from 'lucide-vue-next'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

const { t } = useI18n()

defineProps<{
  modelValue: string
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
  clear: []
}>()
</script>

<template>
  <div class="mb-6 relative group">
    <Search
      :size="18"
      class="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors group-focus-within:text-primary"
    />
    <Input
      :model-value="modelValue"
      type="text"
      :placeholder="t('todo.searchPlaceholder')"
      class="h-11 pl-11 pr-11 text-base bg-muted/30 border-none rounded-xl focus-visible:ring-primary/20"
      @update:model-value="emit('update:modelValue', $event as string)"
    />
    <Button
      v-if="modelValue"
      variant="ghost"
      size="icon"
      class="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8 text-muted-foreground hover:text-foreground"
      @click="emit('clear')"
    >
      <X :size="16" />
    </Button>
  </div>
</template>
