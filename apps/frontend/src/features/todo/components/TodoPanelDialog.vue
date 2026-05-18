<script setup lang="ts">
import { ref, watch, nextTick } from 'vue'
import { List, Network, X } from 'lucide-vue-next'
import { useTodoPanel } from '../composables/useTodoPanel'
import { useTodoStore } from '../stores/todo'
import { useGsap } from '@/composables/useGsap'
import { useEscClose } from '@/composables/useEscClose'
import { useI18n } from 'vue-i18n'
import { Card, CardContent } from '@/components/ui/card'
import TodoPanelContent from './TodoPanelContent.vue'

const { t } = useI18n()
const { isOpen, closePanel } = useTodoPanel()
const todoStore = useTodoStore()

useEscClose(isOpen, closePanel)

const dialogRef = ref<HTMLElement | null>(null)
const { gsap } = useGsap()

function toggleViewMode() {
  todoStore.viewMode = todoStore.viewMode === 'list' ? 'visual' : 'list'
}

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
        @click.self="closePanel"
      >
        <div ref="dialogRef" class="relative flex h-[95vh] w-[98vw] max-w-4xl flex-col">
          <!-- Dialog Header -->
          <div class="flex h-12 shrink-0 items-center justify-between px-4 md:px-6">
            <h2 class="text-base font-semibold text-foreground md:text-lg">
              {{ t('todo.title') }}
            </h2>
            <div class="flex items-center gap-1">
              <button
                class="rounded-full p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                :aria-label="
                  todoStore.viewMode === 'list' ? t('todo.visualMode') : t('todo.listMode')
                "
                :title="todoStore.viewMode === 'list' ? t('todo.visualMode') : t('todo.listMode')"
                @click="toggleViewMode"
              >
                <component :is="todoStore.viewMode === 'list' ? Network : List" :size="18" />
              </button>
              <button
                class="rounded-full p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                aria-label="Close todo panel"
                @click="closePanel"
              >
                <X :size="18" />
              </button>
            </div>
          </div>

          <!-- Glass Card -->
          <Card
            class="flex-1 flex flex-col border border-white/5 dark:border-white/10 shadow-none overflow-hidden bg-card/40 md:bg-card/60 backdrop-blur-[40px] relative group/card transition-all duration-500 ease-in-out"
            :class="[
              'md:shadow-[0_32px_64px_-16px_rgba(0,0,0,0.3)] dark:md:shadow-[0_40px_80px_-20px_rgba(0,0,0,0.6)] rounded-none md:rounded-[32px]',
            ]"
          >
            <div
              class="absolute inset-0 rounded-[32px] pointer-events-none border border-white/10 dark:border-white/5 mask-edge"
            ></div>

            <CardContent
              class="todo-typography p-4 pt-3 md:p-6 md:pt-4 flex flex-col flex-1 min-h-0 relative z-10 pb-[max(1rem,env(safe-area-inset-bottom))]"
            >
              <TodoPanelContent />
            </CardContent>
          </Card>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.mask-edge {
  mask-image:
    linear-gradient(to bottom, black, transparent 15%, transparent 85%, black),
    linear-gradient(to right, black, transparent 15%, transparent 85%, black);
  mask-composite: intersect;
  pointer-events: none;
}

.todo-typography {
  --todo-font-title: 18px;
  --todo-font-body: 14px;
  --todo-font-meta: 12px;
  --todo-font-caption: 11px;
  --todo-control-primary-height: 48px;
  --todo-control-secondary-height: 38px;
  --todo-segment-height: 42px;
  --todo-item-height: 52px;
  --todo-item-child-height: 44px;
  --todo-radius-soft: 14px;
}

@media (max-width: 767px) {
  .relative {
    height: 100vh !important;
    width: 100vw !important;
    max-width: none;
    border-radius: 0;
  }

  .todo-typography {
    --todo-font-title: 16px;
    --todo-font-body: 13px;
    --todo-font-meta: 11px;
    --todo-font-caption: 10px;
    --todo-control-primary-height: 40px;
    --todo-control-secondary-height: 30px;
    --todo-segment-height: 38px;
    --todo-item-height: 48px;
    --todo-item-child-height: 40px;
    --todo-radius-soft: 16px;
  }
}
</style>
