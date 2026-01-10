<script setup lang="ts">
import { Sun, Moon, Monitor } from 'lucide-vue-next'
import { useTheme } from '@/composables/useTheme'
import { useI18n } from 'vue-i18n'

const { theme, setTheme } = useTheme()
const { t } = useI18n()

const toggleTheme = () => {
  if (theme.value === 'light') {
    setTheme('dark')
  } else if (theme.value === 'dark') {
    setTheme('auto')
  } else {
    setTheme('light')
  }
}

const getIcon = () => {
  if (theme.value === 'light') return Sun
  if (theme.value === 'dark') return Moon
  return Monitor
}

const getTitle = () => {
  if (theme.value === 'light') return t('common.theme.light')
  if (theme.value === 'dark') return t('common.theme.dark')
  return t('common.theme.system')
}
</script>

<template>
  <button
    class="flex h-10 w-10 items-center justify-center rounded-xl border border-[#e8e4dd] bg-white text-[#6b5c4d] transition-all hover:bg-[#f5f3ed] dark:border-[#3a3a3a] dark:bg-[#2a2a2a] dark:text-[#a0a0a0] dark:hover:bg-[#3a3a3a]"
    :title="getTitle()"
    @click="toggleTheme"
  >
    <component :is="getIcon()" :size="18" />
  </button>
</template>
