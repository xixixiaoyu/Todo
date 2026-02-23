<script setup lang="ts">
import ChatHistoryPanel from '@/features/ai/components/ChatHistoryPanel.vue'

defineProps<{
  isMobile: boolean
  historyWidth: number
  isResizing: boolean
  startResize: (event: MouseEvent) => void
}>()

const showHistory = defineModel<boolean>({ required: true })

const emit = defineEmits<{
  (e: 'select', sessionId: string): void
  (e: 'new-chat'): void
}>()
</script>

<template>
  <Transition
    enter-active-class="transition-opacity duration-150 ease-out"
    leave-active-class="transition-opacity duration-150 ease-in"
    enter-from-class="opacity-0"
    enter-to-class="opacity-100"
    leave-from-class="opacity-100"
    leave-to-class="opacity-0"
  >
    <div
      v-if="showHistory"
      class="absolute inset-0 z-10 bg-black/20 dark:bg-black/40"
      @click="showHistory = false"
    />
  </Transition>

  <Transition
    enter-active-class="transition-transform duration-250 cubic-bezier(0.16, 1, 0.3, 1)"
    leave-active-class="transition-transform duration-200 cubic-bezier(0.16, 1, 0.3, 1)"
    enter-from-class="-translate-x-full"
    enter-to-class="translate-x-0"
    leave-from-class="translate-x-0"
    leave-to-class="-translate-x-full"
  >
    <div
      v-if="showHistory"
      class="absolute inset-y-0 left-0 z-20 flex flex-col border-r border-border/40 bg-card shadow-xl"
      :style="{ width: isMobile ? '100%' : `${historyWidth}px` }"
    >
      <ChatHistoryPanel
        @select="(id) => emit('select', id)"
        @close="showHistory = false"
        @new-chat="emit('new-chat')"
      />

      <div
        v-if="!isMobile"
        class="absolute -right-1.5 top-0 z-30 flex h-full w-3 cursor-ew-resize items-center justify-center transition-colors hover:bg-primary/10"
        :class="{ 'bg-primary/20': isResizing }"
        @mousedown="startResize"
      >
        <div
          class="h-12 w-1 rounded-full bg-border transition-colors group-hover:bg-primary/30"
          :class="{ 'bg-primary/50': isResizing }"
        />
      </div>
    </div>
  </Transition>
</template>
