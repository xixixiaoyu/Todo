<script setup lang="ts">
import { useToast, type Toast } from '@/composables/useToast'
import { AlertCircle, CheckCircle2, Info, AlertTriangle, X } from 'lucide-vue-next'

const { toasts, removeToast, pauseToast, resumeToast } = useToast()

function handleAction(toast: Toast) {
  if (toast.action) {
    toast.action.onClick()
    removeToast(toast.id)
  }
}

const icons = {
  success: CheckCircle2,
  error: AlertCircle,
  info: Info,
  warning: AlertTriangle,
}

const styles = {
  success: 'bg-background/80 backdrop-blur-md border-success/20 text-success shadow-success/5',
  error:
    'bg-background/80 backdrop-blur-md border-destructive/20 text-destructive shadow-destructive/5',
  info: 'bg-background/80 backdrop-blur-md border-primary/20 text-primary shadow-primary/5',
  warning: 'bg-background/80 backdrop-blur-md border-warning/20 text-warning shadow-warning/5',
}
</script>

<template>
  <div
    class="fixed top-8 left-1/2 -translate-x-1/2 z-[300] flex flex-col gap-3 pointer-events-none items-center w-full max-w-md px-4"
  >
    <TransitionGroup
      enter-active-class="transition duration-500 cubic-bezier(0.34, 1.56, 0.64, 1)"
      enter-from-class="transform -translate-y-8 opacity-0 scale-90"
      enter-to-class="transform translate-y-0 opacity-100 scale-100"
      leave-active-class="transition duration-300 ease-in"
      leave-from-class="transform translate-y-0 opacity-100 scale-100"
      leave-to-class="transform -translate-y-4 opacity-0 scale-95"
    >
      <div
        v-for="toast in toasts"
        :key="toast.id"
        class="pointer-events-auto flex items-center gap-3 rounded-2xl border p-4 shadow-2xl min-w-[320px] max-w-[440px] transition-all duration-300 hover:scale-[1.02] hover:shadow-primary/10"
        :class="styles[toast.type || 'info']"
        @mouseenter="pauseToast(toast.id)"
        @mouseleave="resumeToast(toast.id)"
      >
        <div
          class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full"
          :class="{
            'bg-success/10': toast.type === 'success',
            'bg-destructive/10': toast.type === 'error',
            'bg-primary/10': toast.type === 'info',
            'bg-warning/10': toast.type === 'warning',
          }"
        >
          <component :is="icons[toast.type || 'info']" class="h-4 w-4" />
        </div>
        <div class="flex-1 text-sm font-medium leading-relaxed">
          {{ toast.message }}
        </div>
        <button
          v-if="toast.action"
          class="shrink-0 text-xs font-bold uppercase tracking-wider px-3 py-1.5 rounded-lg bg-primary/10 hover:bg-primary/20 transition-all active:scale-95 border border-primary/20"
          @click="handleAction(toast)"
        >
          {{ toast.action.label }}
        </button>
        <button
          class="shrink-0 rounded-full p-1.5 hover:bg-muted transition-colors"
          @click="removeToast(toast.id)"
        >
          <X class="h-3.5 w-3.5 opacity-50 hover:opacity-100" />
        </button>
      </div>
    </TransitionGroup>
  </div>
</template>
