<script setup lang="ts">
import { useId } from 'vue'
import { Clock, Search, Plus, Trash2, X, FileDown } from 'lucide-vue-next'
import { useI18n } from 'vue-i18n'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'

defineProps<{
  hasSessions: boolean
  isMobile: boolean
}>()

const searchQuery = defineModel<string>({ required: true })

const emit = defineEmits<{
  (e: 'new-chat'): void
  (e: 'export-all'): void
  (e: 'clear-all'): void
  (e: 'close'): void
}>()

const { t } = useI18n()
const searchInputId = useId()
</script>

<template>
  <div class="shrink-0 border-b border-[hsl(var(--ai-glass-border))] px-4 py-4">
    <div class="flex items-center justify-between mb-4">
      <h3 class="flex items-center gap-2 text-sm font-semibold text-foreground">
        <Clock :size="16" class="text-primary" />
        {{ t('ai.historyTitle') }}
      </h3>
      <div class="flex items-center gap-1">
        <TooltipProvider>
          <Tooltip v-if="hasSessions">
            <TooltipTrigger as-child>
              <button
                class="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
                @click="emit('export-all')"
              >
                <FileDown :size="16" />
              </button>
            </TooltipTrigger>
            <TooltipContent>
              <p>{{ t('ai.exportAll') }}</p>
            </TooltipContent>
          </Tooltip>

          <Tooltip v-if="hasSessions">
            <TooltipTrigger as-child>
              <button
                class="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                @click="emit('clear-all')"
              >
                <Trash2 :size="16" />
              </button>
            </TooltipTrigger>
            <TooltipContent>
              <p>{{ t('ai.clearAll') }}</p>
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger as-child>
              <button
                class="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
                @click="emit('close')"
              >
                <X :size="16" />
              </button>
            </TooltipTrigger>
            <TooltipContent>
              <p>{{ t('common.close') }}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
    </div>

    <div class="flex flex-col gap-2">
      <div class="relative group">
        <Search
          :size="14"
          class="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors group-focus-within:text-primary"
        />
        <label :for="searchInputId" class="sr-only">{{ t('common.search') }}</label>
        <input
          :id="searchInputId"
          v-model="searchQuery"
          name="history-search"
          :placeholder="t('common.search')"
          class="w-full rounded-lg border border-border bg-muted/50 py-1.5 pl-9 pr-3 text-xs outline-none transition-all focus:border-primary/50 focus:bg-background focus:ring-2 focus:ring-primary/10"
        />
      </div>

      <button
        class="flex items-center justify-center gap-2 rounded-lg border border-dashed border-border py-2 text-xs font-medium text-muted-foreground transition-all hover:border-primary/50 hover:bg-primary/5 hover:text-primary active:scale-[0.98]"
        :class="isMobile ? 'py-2.5' : ''"
        @click="emit('new-chat')"
      >
        <Plus :size="14" />
        {{ t('ai.newChat') }}
      </button>
    </div>
  </div>
</template>
