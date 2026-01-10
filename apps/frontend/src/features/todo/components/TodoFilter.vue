<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import type { FilterType } from '../stores/todo'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'

const { t } = useI18n()

defineProps<{
  filter: FilterType
}>()

const emit = defineEmits<{
  'update:filter': [value: FilterType]
}>()
</script>

<template>
  <div class="mb-8 flex justify-center">
    <Tabs :model-value="filter" @update:model-value="emit('update:filter', $event as FilterType)">
      <TabsList class="grid w-full max-w-[400px] grid-cols-2 h-11 p-1 bg-muted/50 rounded-xl">
        <TabsTrigger
          value="pending"
          class="rounded-lg px-8 text-sm font-medium transition-all data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm"
        >
          {{ t('todo.pending') }}
        </TabsTrigger>
        <TabsTrigger
          value="completed"
          class="rounded-lg px-8 text-sm font-medium transition-all data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm"
        >
          {{ t('todo.completed') }}
        </TabsTrigger>
      </TabsList>
    </Tabs>
  </div>
</template>
