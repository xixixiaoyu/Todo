<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { Search, Clover, Languages } from 'lucide-vue-next'

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
      class="cursor-default bg-gradient-to-r from-[#fde68a] via-[#fbbf24] to-[#f59e0b] bg-clip-text text-2xl font-bold tracking-tight text-transparent transition-transform duration-300 hover:scale-105 md:text-3xl"
    >
      {{ t('todo.title') }}
    </h1>
    <div class="flex items-center gap-2">
      <button
        class="flex h-10 w-10 items-center justify-center rounded-xl border border-[#e8e4dd] bg-white text-[#6b5c4d] transition-all hover:bg-[#f5f3ed] dark:border-[#3a3a3a] dark:bg-[#2a2a2a] dark:text-[#a0a0a0] dark:hover:bg-[#3a3a3a]"
        @click="emit('update:isDrawerOpen', true)"
      >
        <Clover :size="18" />
      </button>
      <button
        class="flex h-10 w-10 items-center justify-center rounded-xl border transition-all"
        :class="
          showSearch
            ? 'border-[#c9b896] bg-[#3a3a3a] text-white dark:bg-[#c9b896] dark:text-[#1a1a1a]'
            : 'border-[#e8e4dd] bg-white text-[#8b8680] hover:bg-[#f5f3ed] dark:border-[#3a3a3a] dark:bg-[#2a2a2a] dark:text-[#a0a0a0] dark:hover:bg-[#3a3a3a]'
        "
        :title="t('todo.search')"
        @click="emit('update:showSearch', !showSearch)"
      >
        <Search :size="18" />
      </button>
      <button
        class="flex h-10 w-10 items-center justify-center rounded-xl border border-[#e8e4dd] bg-white text-[#6b5c4d] transition-all hover:bg-[#f5f3ed] dark:border-[#3a3a3a] dark:bg-[#2a2a2a] dark:text-[#a0a0a0] dark:hover:bg-[#3a3a3a]"
        :title="t('todo.language')"
        @click="toggleLanguage"
      >
        <Languages :size="18" />
      </button>
    </div>
  </header>
</template>
