<script setup lang="ts">
import { ref, watch, nextTick, toRef } from 'vue'
import type { Component } from 'vue'
import { X } from 'lucide-vue-next'
import { useEscClose } from '@/composables/useEscClose'
import { useGsap } from '@/composables/useGsap'

const props = withDefaults(
  defineProps<{
    isOpen: boolean
    title?: string
    icon?: Component
    size?: 'sm' | 'md' | 'lg' | 'xl'
  }>(),
  {
    size: 'md',
  },
)

const emit = defineEmits<{
  close: []
}>()

useEscClose(
  toRef(() => props.isOpen),
  () => emit('close'),
)

const dialogRef = ref<HTMLElement | null>(null)
const { gsap } = useGsap()

watch(
  () => props.isOpen,
  (newVal) => {
    if (newVal) {
      void nextTick(() => {
        if (!dialogRef.value) return
        gsap.fromTo(
          dialogRef.value,
          { opacity: 0, scale: 0.95, y: 10 },
          { opacity: 1, scale: 1, y: 0, duration: 0.3, ease: 'power2.out' },
        )
      })
    }
  },
)

const sizeClasses: Record<'sm' | 'md' | 'lg' | 'xl', string> = {
  sm: 'max-w-3xl h-[82vh]',
  md: 'max-w-4xl h-[90vh]',
  lg: 'max-w-6xl h-[94vh]',
  xl: 'max-w-[95vw] h-[94vh]',
}
</script>

<template>
  <Teleport to="body">
    <Transition
      :css="false"
      @enter="
        (el, done) => {
          gsap.fromTo(el, { opacity: 0 }, { opacity: 1, duration: 0.2, onComplete: done })
        }
      "
      @leave="
        (el, done) => {
          gsap.to(el, { opacity: 0, duration: 0.2, onComplete: done })
        }
      "
    >
      <div
        v-if="isOpen"
        class="fixed inset-0 z-[300] flex items-center justify-center bg-background/80 backdrop-blur-md"
        @click.self="emit('close')"
      >
        <div
          ref="dialogRef"
          :class="[
            'relative mx-4 flex w-full flex-col overflow-hidden rounded-2xl border border-border bg-background shadow-2xl',
            sizeClasses[size],
          ]"
        >
          <!-- Header -->
          <header
            class="flex h-12 shrink-0 items-center justify-between border-b border-border px-5"
          >
            <div class="flex min-w-0 items-center gap-2.5">
              <div
                v-if="icon"
                class="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"
              >
                <component :is="icon" :size="16" />
              </div>
              <h2 class="truncate text-sm font-semibold tracking-tight">{{ title }}</h2>
            </div>
            <div class="flex items-center gap-1">
              <slot name="header-actions" />
              <button
                class="rounded-full p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                aria-label="Close editor"
                @click="emit('close')"
              >
                <X :size="16" />
              </button>
            </div>
          </header>

          <!-- Content -->
          <main class="min-h-0 flex-1 overflow-hidden">
            <slot />
          </main>

          <!-- Footer -->
          <footer
            v-if="$slots.footer"
            class="flex h-14 shrink-0 items-center justify-end gap-3 border-t border-border bg-muted/5 px-5"
          >
            <slot name="footer" />
          </footer>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
@media (max-width: 640px) {
  .relative {
    max-width: none;
    height: 100vh;
    border-radius: 0;
    margin-left: 0;
    margin-right: 0;
  }
}
</style>
