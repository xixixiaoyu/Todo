<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { Circle, CheckCircle2 } from 'lucide-vue-next'
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
      <TabsList
        class="grid w-full max-w-[300px] grid-cols-2 h-10 p-1 bg-muted/30 rounded-full border border-border/40 shadow-inner"
      >
        <TabsTrigger
          value="pending"
          class="flex items-center gap-2 rounded-full px-4 text-xs font-medium transition-all data-[state=active]:bg-background data-[state=active]:text-primary data-[state=active]:shadow-sm hover:text-foreground/80"
        >
          <Circle
            class="h-4 w-4"
            :class="filter === 'pending' ? 'text-primary' : 'text-muted-foreground/60'"
          />
          {{ t('todo.pending') }}
        </TabsTrigger>
        <TabsTrigger
          value="completed"
          class="flex items-center gap-2 rounded-full px-4 text-xs font-medium transition-all data-[state=active]:bg-background data-[state=active]:text-success data-[state=active]:shadow-sm hover:text-foreground/80"
        >
          <CheckCircle2
            class="h-4 w-4"
            :class="filter === 'completed' ? 'text-success' : 'text-muted-foreground/60'"
          />
          {{ t('todo.completed') }}
        </TabsTrigger>
      </TabsList>
    </Tabs>
  </div>
</template>
