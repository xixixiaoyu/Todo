<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import {
  Circle,
  CheckCircle2,
  ChevronsDownUp,
  ChevronsUpDown,
  Search,
  Clover,
} from 'lucide-vue-next'
import type { FilterType } from '../stores/todo'
import { useTodoStore } from '../stores/todo'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'

const { t } = useI18n()
const todoStore = useTodoStore()

defineProps<{
  filter: FilterType
  isDrawerOpen: boolean
  showSearch: boolean
}>()

const emit = defineEmits<{
  'update:filter': [value: FilterType]
  'update:isDrawerOpen': [value: boolean]
  'update:showSearch': [value: boolean]
}>()
</script>

<template>
  <div class="mb-6 flex items-center justify-center relative min-h-11">
    <!-- 左侧工具栏 - 桌面端显示 -->
    <div class="absolute left-0 hidden md:flex items-center gap-2">
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger as-child>
            <Button
              variant="outline"
              size="icon"
              class="h-10 w-10 rounded-xl bg-card border-border hover:bg-accent"
              @click="emit('update:isDrawerOpen', true)"
            >
              <Clover :size="18" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>{{ t('ai.assistant') }} (Cmd+E / Alt+E)</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger as-child>
            <Button
              variant="outline"
              size="icon"
              class="h-10 w-10 rounded-xl transition-all"
              :class="
                showSearch
                  ? 'border-primary bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground'
                  : 'bg-card border-border hover:bg-accent'
              "
              @click="emit('update:showSearch', !showSearch)"
            >
              <Search :size="18" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>{{ t('todo.search') }}</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>

    <!-- 中间切换卡 -->
    <Tabs
      :model-value="filter"
      class="w-full max-w-[320px]"
      @update:model-value="emit('update:filter', $event as FilterType)"
    >
      <TabsList
        class="grid w-full grid-cols-2 h-12 p-1 bg-muted/60 dark:bg-muted/20 backdrop-blur-xl rounded-full border border-border/80 dark:border-border/40 shadow-[inset_0_2px_4px_rgba(0,0,0,0.05)] dark:shadow-[inset_0_1px_2px_rgba(255,255,255,0.05)]"
      >
        <TabsTrigger
          value="pending"
          class="flex items-center justify-center gap-2 rounded-full px-4 text-sm font-medium transition-all duration-300 border border-transparent data-[state=active]:border-primary/20 data-[state=active]:bg-gradient-to-b data-[state=active]:from-background data-[state=active]:to-background/95 data-[state=active]:text-primary data-[state=active]:shadow-[0_2px_8px_-1px_rgba(0,0,0,0.08),0_0_1px_rgba(0,0,0,0.1)] dark:data-[state=active]:shadow-[0_8px_20px_-6px_rgba(0,0,0,0.6),0_0_1px_rgba(255,255,255,0.1)] data-[state=active]:scale-[1.02] data-[state=active]:font-semibold text-muted-foreground/70 hover:text-primary/80"
        >
          <Circle
            class="h-4 w-4 transition-colors"
            :class="
              filter === 'pending' ? 'text-primary fill-primary/10' : 'text-muted-foreground/70'
            "
          />
          {{ t('todo.pending') }}
        </TabsTrigger>
        <TabsTrigger
          value="completed"
          class="flex items-center justify-center gap-2 rounded-full px-4 text-sm font-medium transition-all duration-300 border border-transparent data-[state=active]:border-success/20 data-[state=active]:bg-gradient-to-b data-[state=active]:from-background data-[state=active]:to-background/95 data-[state=active]:text-success data-[state=active]:shadow-[0_2px_8px_-1px_rgba(0,0,0,0.08),0_0_1px_rgba(0,0,0,0.1)] dark:data-[state=active]:shadow-[0_8px_20px_-6px_rgba(0,0,0,0.6),0_0_1px_rgba(255,255,255,0.1)] data-[state=active]:scale-[1.02] data-[state=active]:font-semibold text-muted-foreground/70 hover:text-success/80"
        >
          <CheckCircle2
            class="h-4 w-4 transition-colors"
            :class="
              filter === 'completed' ? 'text-success fill-success/10' : 'text-muted-foreground/70'
            "
          />
          {{ t('todo.completed') }}
        </TabsTrigger>
      </TabsList>
    </Tabs>

    <!-- 右侧操作 - 桌面端显示 -->
    <div class="absolute right-0 hidden md:block">
      <TooltipProvider>
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
      </TooltipProvider>
    </div>
  </div>
</template>
