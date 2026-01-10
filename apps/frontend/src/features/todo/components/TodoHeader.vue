<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { Search, Clover, Languages } from 'lucide-vue-next'
import ThemeToggle from './ThemeToggle.vue'

const { t, locale } = useI18n()

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
  <header class="mb-6 flex items-center justify-between">
    <h1
      class="cursor-default bg-gradient-to-r from-primary via-primary/80 to-primary/60 bg-clip-text text-2xl font-bold tracking-tight text-transparent transition-transform duration-300 hover:scale-105 md:text-3xl"
    >
      {{ t('todo.title') }}
    </h1>
    <div class="flex items-center gap-2">
      <button
        class="flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-card text-muted-foreground transition-all hover:bg-accent hover:text-accent-foreground"
        @click="emit('update:isDrawerOpen', true)"
      >
        <Clover :size="18" />
      </button>
      <button
        class="flex h-10 w-10 items-center justify-center rounded-xl border transition-all"
        :class="
          showSearch
            ? 'border-primary bg-primary text-primary-foreground'
            : 'border-border bg-card text-muted-foreground hover:bg-accent hover:text-accent-foreground'
        "
        :title="t('todo.search')"
        @click="emit('update:showSearch', !showSearch)"
      >
        <Search :size="18" />
      </button>
      <ThemeToggle />
      <button
        class="flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-card text-muted-foreground transition-all hover:bg-accent hover:text-accent-foreground"
        :title="t('todo.language')"
        @click="toggleLanguage"
      >
        <Languages :size="18" />
      </button>
    </div>
  </header>
</template>
