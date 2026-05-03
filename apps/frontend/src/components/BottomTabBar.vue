<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { ListTodo, BookOpen, GraduationCap } from 'lucide-vue-next'
import { usePomodoroStore } from '@/features/todo/stores/pomodoro'

const route = useRoute()
const router = useRouter()
const { t } = useI18n()
const pomodoroStore = usePomodoroStore()

const isVisible = computed(() => !pomodoroStore.isMiniMode)

const tabs = [
  { id: 'todo', path: '/', icon: ListTodo, label: 'common.nav.todo' },
  { id: 'novel', path: '/novel', icon: BookOpen, label: 'common.nav.novel' },
  { id: 'teaching', path: '/teaching', icon: GraduationCap, label: 'common.nav.teaching' },
] as const

function isActive(tab: (typeof tabs)[number]) {
  const path = route.path
  if (tab.id === 'todo') return path === '/' || path === ''
  return path.startsWith(tab.path)
}

function navigate(path: string) {
  void router.push(path)
}
</script>

<template>
  <Transition
    enter-active-class="transition-all duration-400 ease-out"
    enter-from-class="opacity-0 translate-y-full"
    enter-to-class="opacity-100 translate-y-0"
    leave-active-class="transition-all duration-300 ease-in"
    leave-from-class="opacity-100 translate-y-0"
    leave-to-class="opacity-0 translate-y-full"
  >
    <nav
      v-if="isVisible"
      class="fixed bottom-0 left-0 right-0 z-40 flex justify-center pointer-events-none"
      :style="{ paddingBottom: 'env(safe-area-inset-bottom, 0.5rem)' }"
    >
      <div
        class="pointer-events-auto flex items-center gap-1 rounded-2xl border border-white/10 bg-card/70 px-2 py-1.5 shadow-[0_-8px_32px_-8px_rgba(0,0,0,0.12)] backdrop-blur-xl dark:border-white/5 dark:bg-card/60 dark:shadow-[0_-8px_32px_-8px_rgba(0,0,0,0.4)]"
      >
        <button
          v-for="tab in tabs"
          :key="tab.id"
          class="relative flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-sm font-medium transition-all duration-300"
          :class="
            isActive(tab)
              ? 'bg-primary/15 text-primary'
              : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground'
          "
          @click="navigate(tab.path)"
        >
          <component :is="tab.icon" class="h-4 w-4" />
          <span class="hidden sm:inline">{{ t(tab.label) }}</span>
        </button>
      </div>
    </nav>
  </Transition>
</template>
