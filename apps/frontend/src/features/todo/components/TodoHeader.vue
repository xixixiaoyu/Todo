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
    <h1 class="text-2xl md:text-3xl font-medium text-[#c4694a]">
      {{ t('todo.title') }}
    </h1>
    <div class="flex items-center gap-2">
      <button
        class="flex h-10 w-10 items-center justify-center rounded-xl border border-[#e8e4dd] bg-white text-[#6b5c4d] transition-all hover:bg-[#f5f3ed]"
        @click="emit('update:isDrawerOpen', true)"
      >
        <Clover :size="18" />
      </button>
      <button
        class="flex h-10 w-10 items-center justify-center rounded-xl border border-[#e8e4dd] transition-all"
        :class="
          showSearch ? 'bg-[#3a3a3a] text-white' : 'bg-white text-[#8b8680] hover:bg-[#f5f3ed]'
        "
        :title="t('todo.search')"
        @click="emit('update:showSearch', !showSearch)"
      >
        <Search :size="18" />
      </button>
    </div>
  </header>
</template>
