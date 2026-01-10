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
    class="flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-card text-muted-foreground transition-all hover:bg-accent hover:text-accent-foreground"
    :title="getTitle()"
    @click="toggleTheme"
  >
    <component :is="getIcon()" :size="18" />
  </button>
</template>
