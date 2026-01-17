<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { Clover, Languages, Network, List } from 'lucide-vue-next'
import ThemeToggle from './ThemeToggle.vue'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useTodoStore } from '../stores/todo'
import { isWails, system } from '@/lib/wails'

const { t, locale } = useI18n()
const todoStore = useTodoStore()

const toggleLanguage = () => {
  const newLocale = locale.value === 'zh-CN' ? 'en-US' : 'zh-CN'
  locale.value = newLocale
  localStorage.setItem('locale', newLocale)
}

const handleDblClick = () => {
  if (isWails()) {
    system.toggleMaximise()
  }
}
</script>

<template>
  <header
    class="mb-8 flex items-center justify-between transition-all duration-300 select-none"
    style="--wails-draggable: drag"
    @dblclick="handleDblClick"
  >
    <div class="flex items-center gap-3 group">
      <div
        class="p-2 rounded-xl bg-amber-500/10 text-amber-600 transition-transform group-hover:rotate-12"
      >
        <Clover :size="24" />
      </div>
      <h1
        class="cursor-default text-amber-600 text-2xl font-extrabold tracking-tight transition-transform hover:scale-105 md:text-3xl"
      >
        {{ t('todo.title') }}
      </h1>
    </div>
    <div class="flex items-center gap-2">
      <Tooltip>
        <TooltipTrigger as-child>
          <Button
            variant="outline"
            size="icon"
            class="h-10 w-10 rounded-xl bg-card border-border hover:bg-accent transition-all"
            :class="todoStore.viewMode === 'visual' ? 'text-primary border-primary' : ''"
            @click="todoStore.viewMode = todoStore.viewMode === 'list' ? 'visual' : 'list'"
          >
            <component :is="todoStore.viewMode === 'list' ? Network : List" :size="18" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>{{
          todoStore.viewMode === 'list' ? t('todo.visualMode') : t('todo.listMode')
        }}</TooltipContent>
      </Tooltip>

      <ThemeToggle />

      <Tooltip>
        <TooltipTrigger as-child>
          <Button
            variant="outline"
            size="icon"
            class="h-10 w-10 rounded-xl bg-card border-border hover:bg-accent"
            @click="toggleLanguage"
          >
            <Languages :size="18" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>{{ t('common.toggleLanguage') }}</TooltipContent>
      </Tooltip>
    </div>
  </header>
</template>

<style scoped></style>
