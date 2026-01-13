<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { Search, Clover, Languages, Network, List } from 'lucide-vue-next'
import ThemeToggle from './ThemeToggle.vue'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useTodoStore } from '../stores/todo'

const { t, locale } = useI18n()
const todoStore = useTodoStore()

defineProps<{
  isDrawerOpen: boolean
  showSearch: boolean
}>()

const emit = defineEmits<{
  'update:isDrawerOpen': [value: boolean]
  'update:showSearch': [value: boolean]
}>()

const toggleLanguage = () => {
  const newLocale = locale.value === 'zh-CN' ? 'en-US' : 'zh-CN'
  locale.value = newLocale
  localStorage.setItem('locale', newLocale)
}
</script>

<template>
  <header
    class="flex items-center justify-between transition-all duration-300"
    :class="showSearch ? 'mb-5' : 'mb-8'"
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
            class="h-10 w-10 rounded-xl bg-card border-border hover:bg-accent"
            @click="emit('update:isDrawerOpen', true)"
          >
            <Clover :size="18" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>{{ t('ai.assistant') }}</TooltipContent>
      </Tooltip>

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
        <TooltipContent>{{ t('todo.language') }}</TooltipContent>
      </Tooltip>
    </div>
  </header>
</template>
