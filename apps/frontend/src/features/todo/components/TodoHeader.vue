<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { Search, Clover } from 'lucide-vue-next'

const { t } = useI18n()

defineProps<{
  isDrawerOpen: boolean
  showSearch: boolean
}>()

const emit = defineEmits<{
  'update:isDrawerOpen': [value: boolean]
  'update:showSearch': [value: boolean]
}>()
</script>

<template>
  <header class="mb-6 flex items-center justify-between">
    <h1 class="text-2xl font-medium text-[#c4694a] md:text-3xl dark:text-[#e8a08a]">
      {{ t('todo.title') }}
    </h1>
    <div class="flex items-center gap-2">
      <button
        class="flex h-10 w-10 items-center justify-center rounded-xl border border-[#e8e4dd] bg-white text-[#6b5c4d] transition-all hover:bg-[#f5f3ed] dark:border-[#3a3a3a] dark:bg-[#2a2a2a] dark:text-[#a0a0a0] dark:hover:bg-[#3a3a3a]"
        :title="t('todo.language')"
        @click="toggleLanguage"
      >
        <Languages :size="18" />
      </button>
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
    </div>
  </header>
</template>
