<script setup lang="ts">
import { Sun, Moon, Monitor } from 'lucide-vue-next'
import { useTheme } from '@/composables/useTheme'
import { useI18n } from 'vue-i18n'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

const props = withDefaults(
  defineProps<{
    size?: 'sm' | 'md' | 'lg'
  }>(),
  {
    size: 'md',
  },
)

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
  <Tooltip>
    <TooltipTrigger as-child>
      <Button
        variant="outline"
        size="icon"
        :class="
          cn(
            'rounded-xl bg-card border-border hover:bg-accent transition-all',
            props.size === 'sm' ? 'h-8 w-8' : props.size === 'lg' ? 'h-10 w-10' : 'h-9 w-9',
          )
        "
        @click="toggleTheme"
      >
        <component
          :is="getIcon()"
          :size="props.size === 'sm' ? 14 : props.size === 'lg' ? 18 : 16"
          class="transition-all"
        />
      </Button>
    </TooltipTrigger>
    <TooltipContent>
      {{ getTitle() }}
    </TooltipContent>
  </Tooltip>
</template>
