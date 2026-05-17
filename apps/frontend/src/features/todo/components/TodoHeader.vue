<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { Snowflake, Network, List, MoreHorizontal } from 'lucide-vue-next'
import AiAssistantQuickModesMenu from '@/features/ai/components/AiAssistantQuickModesMenu.vue'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useTodoStore } from '../stores/todo'

const { t } = useI18n()
const todoStore = useTodoStore()
</script>

<template>
  <header
    class="mb-2 md:mb-3 flex items-center justify-between transition-all duration-300 select-none"
  >
    <div class="flex items-center gap-2 md:gap-3 group">
      <div
        class="rounded-[18px] border border-primary/10 bg-primary/10 p-2 text-primary/85 transition-transform group-hover:rotate-12 md:rounded-xl"
      >
        <Snowflake :size="16" class="md:h-6 md:w-6" />
      </div>
      <h1
        class="hidden sm:flex items-center gap-2 cursor-default text-[18px] font-semibold tracking-tight text-primary transition-transform hover:scale-105 md:text-[var(--todo-font-title)]"
      >
        {{ t('common.appName') }}
      </h1>
    </div>
    <div class="flex items-center gap-1 md:gap-2">
      <!-- AI Assistant - Split Button（主入口 + 模式快捷菜单，桌面端悬浮自动弹出） -->
      <AiAssistantQuickModesMenu />

      <div class="hidden md:block mx-1 h-6 w-px bg-border/40"></div>

      <!-- View Mode Toggle Group - Compact on mobile -->
      <div
        class="hidden md:flex items-center gap-1.5 p-1 bg-muted/50 rounded-2xl border border-border/50"
      >
        <Tooltip>
          <TooltipTrigger as-child>
            <Button
              variant="ghost"
              size="icon"
              class="h-9 w-9 rounded-xl transition-all"
              :class="
                todoStore.viewMode === 'list'
                  ? 'bg-background text-primary shadow-sm'
                  : 'text-muted-foreground hover:text-foreground hover:bg-background/50'
              "
              @click="todoStore.viewMode = 'list'"
            >
              <List :size="18" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>{{ t('todo.listMode') }}</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger as-child>
            <Button
              variant="ghost"
              size="icon"
              class="h-9 w-9 rounded-xl transition-all"
              :class="
                todoStore.viewMode === 'visual'
                  ? 'bg-background text-primary shadow-sm'
                  : 'text-muted-foreground hover:text-foreground hover:bg-background/50'
              "
              @click="todoStore.viewMode = 'visual'"
            >
              <Network :size="18" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>{{ t('todo.visualMode') }}</TooltipContent>
        </Tooltip>
      </div>

      <!-- More Actions Dropdown for Mobile -->
      <DropdownMenu :modal="false">
        <DropdownMenuTrigger as-child>
          <Button
            variant="ghost"
            size="icon"
            class="h-8 w-8 rounded-[16px] border border-transparent text-muted-foreground/70 transition-all hover:bg-muted/40 hover:text-foreground md:hidden"
          >
            <MoreHorizontal :size="18" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" class="w-48 rounded-xl p-2">
          <DropdownMenuLabel
            class="text-[var(--todo-font-caption)] text-muted-foreground font-normal"
          >
            {{ t('common.settings') }}
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem class="rounded-lg cursor-pointer" @click="todoStore.viewMode = 'list'">
            <List class="mr-2 h-4 w-4" />
            <span>{{ t('todo.listMode') }}</span>
          </DropdownMenuItem>
          <DropdownMenuItem
            class="rounded-lg cursor-pointer"
            @click="todoStore.viewMode = 'visual'"
          >
            <Network class="mr-2 h-4 w-4" />
            <span>{{ t('todo.visualMode') }}</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  </header>
</template>

<style scoped></style>
