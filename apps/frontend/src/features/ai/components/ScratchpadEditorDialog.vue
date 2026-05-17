<script setup lang="ts">
import { ref, watch, nextTick } from 'vue'
import { X } from 'lucide-vue-next'
import { useScratchpadEditor } from '../composables/useScratchpadEditor'
import { useGsap } from '@/composables/useGsap'
import { useEscClose } from '@/composables/useEscClose'
import TodoScratchpad from '@/features/todo/components/TodoScratchpad.vue'

const { isOpen, closeEditor } = useScratchpadEditor()

useEscClose(isOpen, closeEditor)

const dialogRef = ref<HTMLElement | null>(null)
const { gsap } = useGsap()

watch(isOpen, (newVal) => {
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
})
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
        @click.self="closeEditor"
      >
        <div
          ref="dialogRef"
          class="relative flex h-[95vh] w-[98vw] flex-col overflow-hidden rounded-xl border border-border bg-background shadow-2xl"
        >
          <!-- 顶栏：仅关闭按钮 -->
          <div class="flex h-10 shrink-0 items-center justify-end px-4">
            <button
              class="rounded-full p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              aria-label="Close scratchpad"
              @click="closeEditor"
            >
              <X :size="18" />
            </button>
          </div>

          <!-- Content -->
          <main class="flex-1 overflow-hidden px-6 pb-6">
            <TodoScratchpad />
          </main>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
@media (max-width: 640px) {
  .relative {
    height: 100vh;
    width: 100vw;
    border-radius: 0;
  }
}
</style>
