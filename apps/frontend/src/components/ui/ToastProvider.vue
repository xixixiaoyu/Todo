<script setup lang="ts">
import { useToast } from '@/composables/useToast'
import { AlertCircle, CheckCircle2, Info, AlertTriangle, X } from 'lucide-vue-next'

const { toasts, removeToast } = useToast()

const icons = {
  success: CheckCircle2,
  error: AlertCircle,
  info: Info,
  warning: AlertTriangle,
}

const styles = {
  success:
    'bg-green-50 border-green-200 text-green-800 dark:bg-green-900/30 dark:border-green-800 dark:text-green-400',
  error:
    'bg-red-50 border-red-200 text-red-800 dark:bg-red-900/30 dark:border-red-800 dark:text-red-400',
  info: 'bg-blue-50 border-blue-200 text-blue-800 dark:bg-blue-900/30 dark:border-blue-800 dark:text-blue-400',
  warning:
    'bg-yellow-50 border-yellow-200 text-yellow-800 dark:bg-yellow-900/30 dark:border-yellow-800 dark:text-yellow-400',
}
</script>

<template>
  <div class="fixed bottom-4 right-4 z-[300] flex flex-col gap-2 pointer-events-none">
    <TransitionGroup
      enter-active-class="transition duration-300 ease-out"
      enter-from-class="transform translate-y-2 opacity-0 scale-95"
      enter-to-class="transform translate-y-0 opacity-100 scale-100"
      leave-active-class="transition duration-200 ease-in"
      leave-from-class="transform translate-y-0 opacity-100 scale-100"
      leave-to-class="transform translate-y-2 opacity-0 scale-95"
    >
      <div
        v-for="toast in toasts"
        :key="toast.id"
        class="pointer-events-auto flex items-start gap-3 rounded-lg border p-4 shadow-lg min-w-[300px] max-w-[400px]"
        :class="styles[toast.type || 'info']"
      >
        <component :is="icons[toast.type || 'info']" class="h-5 w-5 shrink-0" />
        <div class="flex-1 text-sm font-medium">
          {{ toast.message }}
        </div>
        <button
          class="shrink-0 rounded-md p-0.5 hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
          @click="removeToast(toast.id)"
        >
          <X class="h-4 w-4" />
        </button>
      </div>
    </TransitionGroup>
  </div>
</template>
