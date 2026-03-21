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
    class="mb-3 md:mb-4 flex items-center justify-between md:justify-center relative min-h-10 gap-1.5 md:gap-2"
  >
    <!-- 中间切换卡 -->
    <Tabs
      :model-value="filter"
      class="flex-1 md:flex-none w-auto md:w-[320px]"
      @update:model-value="emit('update:filter', $event as FilterType)"
    >
      <TabsList
        class="grid h-11 w-full rounded-[22px] border border-border/70 bg-card/85 p-1 backdrop-blur-xl shadow-[inset_0_1px_2px_rgba(0,0,0,0.03)] dark:border-border/40 dark:bg-muted/20 dark:shadow-[inset_0_1px_2px_rgba(255,255,255,0.05)] md:h-12 md:rounded-full md:bg-muted/60"
        :class="['grid-cols-2', 'max-w-[280px]', 'mx-auto']"
      >
        <TabsTrigger
          value="pending"
          class="flex items-center justify-center gap-1 rounded-[18px] border border-transparent px-2 text-[12px] font-medium text-muted-foreground/70 transition-all duration-300 hover:text-primary/80 data-[state=active]:border-primary/15 data-[state=active]:bg-background/95 data-[state=active]:text-primary data-[state=active]:font-semibold data-[state=active]:shadow-[0_1px_4px_rgba(0,0,0,0.06)] md:gap-2 md:rounded-full md:px-4 md:text-[var(--todo-font-meta)] md:data-[state=active]:bg-gradient-to-b md:data-[state=active]:from-background md:data-[state=active]:to-background/95 md:data-[state=active]:shadow-[0_2px_8px_-1px_rgba(0,0,0,0.08),0_0_1px_rgba(0,0,0,0.1)] dark:md:data-[state=active]:shadow-[0_8px_20px_-6px_rgba(0,0,0,0.6),0_0_1px_rgba(255,255,255,0.1)] md:data-[state=active]:scale-[1.02]"
        >
          <Circle
            class="h-[11px] w-[11px] transition-colors md:h-4 md:w-4"
            :class="
              filter === 'pending' ? 'text-primary fill-primary/10' : 'text-muted-foreground/70'
            "
          />
          <span class="truncate">{{ t('todo.pending') }}</span>
        </TabsTrigger>
        <TabsTrigger
          value="completed"
          class="flex items-center justify-center gap-1 rounded-[18px] border border-transparent px-2 text-[12px] font-medium text-muted-foreground/70 transition-all duration-300 hover:text-success/80 data-[state=active]:border-success/15 data-[state=active]:bg-background/95 data-[state=active]:text-success data-[state=active]:font-semibold data-[state=active]:shadow-[0_1px_4px_rgba(0,0,0,0.06)] md:gap-2 md:rounded-full md:px-4 md:text-[var(--todo-font-meta)] md:data-[state=active]:bg-gradient-to-b md:data-[state=active]:from-background md:data-[state=active]:to-background/95 md:data-[state=active]:shadow-[0_2px_8px_-1px_rgba(0,0,0,0.08),0_0_1px_rgba(0,0,0,0.1)] dark:md:data-[state=active]:shadow-[0_8px_20px_-6px_rgba(0,0,0,0.6),0_0_1px_rgba(255,255,255,0.1)] md:data-[state=active]:scale-[1.02]"
        >
          <CheckCircle2
            class="h-[11px] w-[11px] transition-colors md:h-4 md:w-4"
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
              class="h-8 w-8 rounded-[16px] transition-all duration-300 md:h-10 md:w-10 md:rounded-xl"
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
              class="h-8 w-8 rounded-[16px] transition-all duration-300 md:h-10 md:w-10 md:rounded-xl"
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
                    class="h-9 w-9 md:h-10 md:w-10 rounded-xl text-destructive hover:bg-destructive/10 transition-all duration-300"
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
              class="h-8 w-8 rounded-[16px] text-muted-foreground/60 transition-all duration-300 hover:bg-primary/5 hover:text-primary md:h-10 md:w-10 md:rounded-xl"
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
