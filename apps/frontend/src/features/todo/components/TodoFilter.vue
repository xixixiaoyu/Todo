<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { Circle, CheckCircle2, ChevronsDownUp, ChevronsUpDown } from 'lucide-vue-next'
import type { FilterType } from '../stores/todo'
import { useTodoStore } from '../stores/todo'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

const { t } = useI18n()
const todoStore = useTodoStore()

defineProps<{
  filter: FilterType
}>()

const emit = defineEmits<{
  'update:filter': [value: FilterType]
}>()
</script>

<template>
  <div class="mb-6 flex items-center justify-center relative">
    <Tabs
      :model-value="filter"
      class="w-full max-w-[310px]"
      @update:model-value="emit('update:filter', $event as FilterType)"
    >
      <TabsList
        class="grid w-full grid-cols-2 h-11 p-1 bg-muted/50 backdrop-blur-sm rounded-full border border-border/50 shadow-inner"
      >
        <TabsTrigger
          value="pending"
          class="flex items-center gap-2 rounded-full px-5 text-sm font-medium transition-all data-[state=active]:bg-background data-[state=active]:text-primary data-[state=active]:shadow-[0_2px_8px_rgba(0,0,0,0.08)] hover:text-foreground/80"
        >
          <Circle
            class="h-4 w-4"
            :class="filter === 'pending' ? 'text-primary' : 'text-muted-foreground/60'"
          />
          {{ t('todo.pending') }}
        </TabsTrigger>
        <TabsTrigger
          value="completed"
          class="flex items-center gap-2 rounded-full px-5 text-sm font-medium transition-all data-[state=active]:bg-background data-[state=active]:text-success data-[state=active]:shadow-sm hover:text-foreground/80"
        >
          <CheckCircle2
            class="h-4 w-4"
            :class="filter === 'completed' ? 'text-success' : 'text-muted-foreground/60'"
          />
          {{ t('todo.completed') }}
        </TabsTrigger>
      </TabsList>
    </Tabs>

    <!-- 全局展开/收起按钮 - 移动到右侧，更靠近任务列表且操作便捷 -->
    <div class="absolute right-0 hidden md:block">
      <Tooltip>
        <TooltipTrigger as-child>
          <Button
            variant="ghost"
            size="icon"
            class="h-10 w-10 rounded-xl text-muted-foreground/60 hover:text-primary hover:bg-primary/5 transition-all duration-300"
            @click="todoStore.toggleAllExpansion"
          >
            <component
              :is="todoStore.isAllExpanded ? ChevronsDownUp : ChevronsUpDown"
              :size="20"
              :stroke-width="1.5"
            />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="left" :side-offset="10">
          {{ todoStore.isAllExpanded ? t('todo.collapseAll') : t('todo.expandAll') }}
        </TooltipContent>
      </Tooltip>
    </div>
  </div>
</template>
