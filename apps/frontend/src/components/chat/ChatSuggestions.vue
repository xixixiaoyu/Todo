<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { ListTree, Pin, ClipboardList } from 'lucide-vue-next'

const emit = defineEmits<{
  (e: 'select', text: string, options?: { requireTodo?: boolean }): void
}>()

const { t } = useI18n()

const suggestions = computed(() => [
  {
    icon: ListTree,
    title: t('ai.suggestion1Title'),
    desc: t('ai.suggestion1Desc'),
    color: 'text-indigo-500',
    bg: 'bg-indigo-500/10',
    requireTodo: true,
  },
  {
    icon: Pin,
    title: t('ai.suggestion2Title'),
    desc: t('ai.suggestion2Desc'),
    color: 'text-amber-500',
    bg: 'bg-amber-500/10',
    requireTodo: true,
  },
  {
    icon: ClipboardList,
    title: t('ai.suggestion3Title'),
    desc: t('ai.suggestion3Desc'),
    color: 'text-emerald-500',
    bg: 'bg-emerald-500/10',
    requireTodo: true,
  },
])
</script>

<template>
  <div class="grid w-full max-w-2xl gap-3 sm:grid-cols-3">
    <button
      v-for="item in suggestions"
      :key="item.title"
      class="group relative flex flex-col items-start rounded-xl border border-border bg-card/50 p-4 text-left transition-all hover:border-primary/30 hover:bg-primary/5 hover:shadow-sm active:scale-[0.98]"
      @click="emit('select', item.desc, { requireTodo: item.requireTodo })"
    >
      <div class="mb-3 flex w-full items-center justify-between">
        <div
          :class="[
            'flex h-9 w-9 items-center justify-center rounded-lg transition-colors group-hover:bg-white/50 dark:group-hover:bg-black/20',
            item.bg,
          ]"
        >
          <component :is="item.icon" :class="['h-4.5 w-4.5', item.color]" />
        </div>
      </div>

      <h3 class="mb-1 text-sm font-bold text-foreground transition-colors group-hover:text-primary">
        {{ item.title }}
      </h3>
      <p class="text-[11px] leading-snug text-muted-foreground/70 line-clamp-2">
        {{ item.desc }}
      </p>
    </button>
  </div>
</template>
