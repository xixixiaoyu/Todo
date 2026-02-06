<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import {
  Circle,
  CheckCircle2,
  ChevronsDownUp,
  ChevronsUpDown,
  Search,
  Trash2,
} from 'lucide-vue-next'
import type { FilterType } from '../stores/todo'
import { useTodoStore } from '../stores/todo'
import { useToast } from '@/composables/useToast'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { ref } from 'vue'

const { t } = useI18n()
const todoStore = useTodoStore()
const toast = useToast()
const isClearPopoverOpen = ref(false)

withDefaults(
  defineProps<{
    filter: FilterType
    isDrawerOpen: boolean
    showSearch: boolean
    showTrash?: boolean
  }>(),
  {
    showTrash: true,
  },
)

const emit = defineEmits<{
  'update:filter': [value: FilterType]
  'update:isDrawerOpen': [value: boolean]
  'update:showSearch': [value: boolean]
}>()

async function handleClearTrash() {
  await todoStore.clearTrash()
  toast.success(t('todo.clearTrashSuccess'))
  isClearPopoverOpen.value = false
}
</script>

<template>
  <div class="mb-6 flex items-center justify-center relative min-h-11 gap-2">
    <!-- 中间切换卡 -->
    <Tabs
      :model-value="filter"
      class="flex-1 md:flex-none w-full md:w-[400px]"
      @update:model-value="emit('update:filter', $event as FilterType)"
    >
      <TabsList
        class="grid w-full h-11 md:h-12 p-1 bg-muted/60 dark:bg-muted/20 backdrop-blur-xl rounded-full border border-border/80 dark:border-border/40 shadow-[inset_0_2px_4px_rgba(0,0,0,0.05)] dark:shadow-[inset_0_1px_2px_rgba(255,255,255,0.05)]"
        :class="showTrash ? 'grid-cols-3' : 'grid-cols-2 max-w-[280px] mx-auto'"
      >
        <TabsTrigger
          value="pending"
          class="flex items-center justify-center gap-1.5 md:gap-2 rounded-full px-2 md:px-4 text-[10px] md:text-sm font-medium transition-all duration-300 border border-transparent data-[state=active]:border-primary/20 data-[state=active]:bg-gradient-to-b data-[state=active]:from-background data-[state=active]:to-background/95 data-[state=active]:text-primary data-[state=active]:shadow-[0_2px_8px_-1px_rgba(0,0,0,0.08),0_0_1px_rgba(0,0,0,0.1)] dark:data-[state=active]:shadow-[0_8px_20px_-6px_rgba(0,0,0,0.6),0_0_1px_rgba(255,255,255,0.1)] data-[state=active]:scale-[1.02] data-[state=active]:font-semibold text-muted-foreground/70 hover:text-primary/80"
        >
          <Circle
            class="h-3 w-3 md:h-4 md:w-4 transition-colors"
            :class="
              filter === 'pending' ? 'text-primary fill-primary/10' : 'text-muted-foreground/70'
            "
          />
          {{ t('todo.pending') }}
        </TabsTrigger>
        <TabsTrigger
          value="completed"
          class="flex items-center justify-center gap-1.5 md:gap-2 rounded-full px-2 md:px-4 text-[10px] md:text-sm font-medium transition-all duration-300 border border-transparent data-[state=active]:border-success/20 data-[state=active]:bg-gradient-to-b data-[state=active]:from-background data-[state=active]:to-background/95 data-[state=active]:text-success data-[state=active]:shadow-[0_2px_8px_-1px_rgba(0,0,0,0.08),0_0_1px_rgba(0,0,0,0.1)] dark:data-[state=active]:shadow-[0_8px_20px_-6px_rgba(0,0,0,0.6),0_0_1px_rgba(255,255,255,0.1)] data-[state=active]:scale-[1.02] data-[state=active]:font-semibold text-muted-foreground/70 hover:text-success/80"
        >
          <CheckCircle2
            class="h-3 w-3 md:h-4 md:w-4 transition-colors"
            :class="
              filter === 'completed' ? 'text-success fill-success/10' : 'text-muted-foreground/70'
            "
          />
          {{ t('todo.completed') }}
        </TabsTrigger>
        <TabsTrigger
          v-if="showTrash"
          value="trash"
          class="flex items-center justify-center gap-1.5 md:gap-2 rounded-full px-2 md:px-4 text-[10px] md:text-sm font-medium transition-all duration-300 border border-transparent data-[state=active]:border-destructive/20 data-[state=active]:bg-gradient-to-b data-[state=active]:from-background data-[state=active]:to-background/95 data-[state=active]:text-destructive data-[state=active]:shadow-[0_2px_8px_-1px_rgba(0,0,0,0.08),0_0_1px_rgba(0,0,0,0.1)] dark:data-[state=active]:shadow-[0_8px_20px_-6px_rgba(0,0,0,0.6),0_0_1px_rgba(255,255,255,0.1)] data-[state=active]:scale-[1.02] data-[state=active]:font-semibold text-muted-foreground/70 hover:text-destructive/80"
        >
          <Trash2
            class="h-3 w-3 md:h-4 md:w-4 transition-colors"
            :class="
              filter === 'trash'
                ? 'text-destructive fill-destructive/10'
                : 'text-muted-foreground/70'
            "
          />
          {{ t('todo.trash') }}
        </TabsTrigger>
      </TabsList>
    </Tabs>

    <!-- 工具栏 -->
    <div class="md:absolute md:right-0 flex items-center gap-0.5 md:gap-1">
      <TooltipProvider>
        <!-- Search -->
        <Tooltip>
          <TooltipTrigger as-child>
            <Button
              variant="ghost"
              size="icon"
              class="h-9 w-9 md:h-10 md:w-10 rounded-xl transition-all duration-300"
              :class="
                showSearch
                  ? 'text-primary bg-primary/10'
                  : 'text-muted-foreground/60 hover:text-primary hover:bg-primary/5'
              "
              @click="emit('update:showSearch', !showSearch)"
            >
              <Search :size="16" class="md:w-[18px] md:h-[18px]" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="top">{{ t('todo.search') }}</TooltipContent>
        </Tooltip>

        <!-- Clear Trash -->
        <div v-if="filter === 'trash'">
          <Tooltip>
            <TooltipTrigger as-child>
              <Popover v-model:open="isClearPopoverOpen">
                <PopoverTrigger as-child>
                  <Button
                    variant="ghost"
                    size="icon"
                    class="h-9 w-9 md:h-10 md:w-10 rounded-xl text-destructive hover:bg-destructive/10 transition-all duration-300"
                  >
                    <Trash2 :size="16" class="md:w-[18px] md:h-[18px]" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent side="bottom" :side-offset="8" align="end" class="w-64 p-4 z-50">
                  <div class="space-y-3">
                    <p class="text-sm font-medium leading-none">
                      {{ t('todo.clearTrashConfirm') }}
                    </p>
                    <div class="flex justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        class="h-8 rounded-lg px-3 text-xs"
                        @click="isClearPopoverOpen = false"
                      >
                        {{ t('common.cancel') }}
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        class="h-8 rounded-lg px-3 text-xs shadow-lg shadow-destructive/20"
                        @click="handleClearTrash"
                      >
                        {{ t('common.confirm') }}
                      </Button>
                    </div>
                  </div>
                </PopoverContent>
              </Popover>
            </TooltipTrigger>
            <TooltipContent side="top">{{ t('todo.clearTrash') }}</TooltipContent>
          </Tooltip>
        </div>

        <!-- Expand/Collapse -->
        <Tooltip v-if="filter !== 'trash'">
          <TooltipTrigger as-child>
            <Button
              variant="ghost"
              size="icon"
              class="h-9 w-9 md:h-10 md:w-10 rounded-xl text-muted-foreground/60 hover:text-primary hover:bg-primary/5 transition-all duration-300"
              @click="todoStore.toggleAllExpansion"
            >
              <component
                :is="todoStore.isAllExpanded ? ChevronsDownUp : ChevronsUpDown"
                :size="18"
                class="md:w-5 md:h-5"
                :stroke-width="1.5"
              />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="top">
            {{ todoStore.isAllExpanded ? t('todo.collapseAll') : t('todo.expandAll') }}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  </div>
</template>
