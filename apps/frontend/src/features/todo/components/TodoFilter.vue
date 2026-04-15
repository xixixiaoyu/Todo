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
  <div
    class="mb-2 md:mb-3 flex items-center justify-between md:justify-center relative min-h-10 gap-1.5 md:gap-2"
  >
    <!-- 中间切换卡 -->
    <Tabs
      :model-value="filter"
      class="flex-1 w-auto md:w-[300px] md:flex-none"
      @update:model-value="emit('update:filter', $event as FilterType)"
    >
      <TabsList
        class="grid h-[var(--todo-segment-height)] w-full rounded-[22px] border border-border/60 bg-muted/15 p-[3px] backdrop-blur-lg shadow-[inset_0_1px_0_rgba(255,255,255,0.45)] dark:border-border/40 dark:bg-muted/15 dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] md:rounded-full"
        :class="['grid-cols-2', 'max-w-[272px]', 'mx-auto']"
      >
        <TabsTrigger
          value="pending"
          class="flex items-center justify-center gap-1 rounded-[16px] border border-transparent px-2.5 text-[11px] font-medium text-muted-foreground/72 transition-[background-color,color,box-shadow] duration-200 hover:bg-background/35 hover:text-foreground/80 data-[state=active]:bg-primary/[0.08] data-[state=active]:text-primary data-[state=active]:font-semibold data-[state=active]:shadow-[inset_0_0_0_1px_hsl(var(--primary)_/_0.14)] md:gap-1.5 md:rounded-full md:px-3.5 md:text-[var(--todo-font-meta)]"
        >
          <Circle
            class="h-[11px] w-[11px] transition-colors md:h-[15px] md:w-[15px]"
            :class="
              filter === 'pending' ? 'text-primary fill-primary/10' : 'text-muted-foreground/70'
            "
          />
          <span class="truncate">{{ t('todo.pending') }}</span>
        </TabsTrigger>
        <TabsTrigger
          value="completed"
          class="flex items-center justify-center gap-1 rounded-[16px] border border-transparent px-2.5 text-[11px] font-medium text-muted-foreground/72 transition-[background-color,color,box-shadow] duration-200 hover:bg-background/35 hover:text-foreground/80 data-[state=active]:bg-success/[0.08] data-[state=active]:text-success data-[state=active]:font-semibold data-[state=active]:shadow-[inset_0_0_0_1px_hsl(var(--success)_/_0.16)] md:gap-1.5 md:rounded-full md:px-3.5 md:text-[var(--todo-font-meta)]"
        >
          <CheckCircle2
            class="h-[11px] w-[11px] transition-colors md:h-[15px] md:w-[15px]"
            :class="
              filter === 'completed' ? 'text-success fill-success/10' : 'text-muted-foreground/70'
            "
          />
          <span class="truncate">{{ t('todo.completed') }}</span>
        </TabsTrigger>
      </TabsList>
    </Tabs>

    <!-- 工具栏 -->
    <div class="flex items-center gap-0.5 md:gap-1 md:absolute md:right-0">
      <TooltipProvider>
        <!-- Search -->
        <Tooltip>
          <TooltipTrigger as-child>
            <Button
              variant="ghost"
              size="icon"
              class="h-[var(--todo-control-secondary-height)] w-[var(--todo-control-secondary-height)] rounded-[12px] transition-all duration-300 md:rounded-[var(--todo-radius-soft)]"
              :class="
                showSearch
                  ? 'bg-primary/10 text-primary'
                  : 'text-muted-foreground/60 hover:bg-primary/5 hover:text-primary'
              "
              @click="emit('update:showSearch', !showSearch)"
            >
              <Search :size="16" class="md:w-[18px] md:h-[18px]" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="top">{{ t('todo.search') }}</TooltipContent>
        </Tooltip>

        <!-- Trash Filter -->
        <Tooltip v-if="showTrash">
          <TooltipTrigger as-child>
            <Button
              variant="ghost"
              size="icon"
              class="h-[var(--todo-control-secondary-height)] w-[var(--todo-control-secondary-height)] rounded-[12px] transition-all duration-300 md:rounded-[var(--todo-radius-soft)]"
              :class="
                filter === 'trash'
                  ? 'bg-destructive/10 text-destructive hover:bg-destructive/15'
                  : 'text-muted-foreground/60 hover:bg-destructive/5 hover:text-destructive'
              "
              @click="emit('update:filter', 'trash')"
            >
              <Trash2 :size="16" class="md:w-[18px] md:h-[18px]" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="top">{{ t('todo.trash') }}</TooltipContent>
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
                    class="h-[var(--todo-control-secondary-height)] w-[var(--todo-control-secondary-height)] rounded-[12px] text-destructive transition-all duration-300 hover:bg-destructive/10 md:rounded-[var(--todo-radius-soft)]"
                  >
                    <Trash2 :size="16" class="md:w-[18px] md:h-[18px]" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent side="bottom" :side-offset="8" align="end" class="w-64 p-4 z-50">
                  <div class="space-y-3">
                    <p class="text-[var(--todo-font-meta)] font-medium leading-none">
                      {{ t('todo.clearTrashConfirm') }}
                    </p>
                    <div class="flex justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        class="h-8 rounded-lg px-3 text-[var(--todo-font-caption)]"
                        @click="isClearPopoverOpen = false"
                      >
                        {{ t('common.cancel') }}
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        class="h-8 rounded-lg px-3 text-[var(--todo-font-caption)] shadow-lg shadow-destructive/20"
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
              class="h-[var(--todo-control-secondary-height)] w-[var(--todo-control-secondary-height)] rounded-[12px] text-muted-foreground/60 transition-all duration-300 hover:bg-primary/5 hover:text-primary md:rounded-[var(--todo-radius-soft)]"
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
