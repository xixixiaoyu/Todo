<script setup lang="ts">
import type { Component } from 'vue'

type SlashCommand = {
  id: string
  title: string
  icon: Component
  active: boolean
}

defineProps<{
  commands: SlashCommand[]
}>()

const open = defineModel<boolean>('open', { required: true })
const selectedIndex = defineModel<number>('selectedIndex', { required: true })

const emit = defineEmits<{
  (e: 'select', index: number): void
}>()
</script>

<template>
  <Transition
    enter-active-class="transition duration-200 ease-out"
    enter-from-class="transform translate-y-2 opacity-0 scale-95"
    enter-to-class="transform translate-y-0 opacity-100 scale-100"
    leave-active-class="transition duration-150 ease-in"
    leave-from-class="transform translate-y-0 opacity-100 scale-100"
    leave-to-class="transform translate-y-2 opacity-0 scale-95"
  >
    <div
      v-if="open"
      class="slash-commands-menu absolute bottom-full left-0 z-50 mb-3 w-64 overflow-hidden rounded-2xl border border-border/40 bg-background p-1.5 shadow-2xl shadow-black/10"
    >
      <div class="flex flex-col gap-0.5">
        <button
          v-for="(cmd, index) in commands"
          :key="cmd.id"
          class="group flex items-center justify-between rounded-lg px-3 py-2 text-left transition-all"
          :class="[
            selectedIndex === index
              ? 'bg-primary text-primary-foreground shadow-sm'
              : 'text-muted-foreground hover:bg-accent hover:text-foreground',
          ]"
          @click="emit('select', index)"
          @mouseenter="selectedIndex = index"
        >
          <div class="flex items-center gap-2.5">
            <div
              class="flex h-7 w-7 items-center justify-center rounded-md"
              :class="[
                selectedIndex === index
                  ? 'bg-white/20 text-white'
                  : cmd.active
                    ? 'bg-primary/10 text-primary'
                    : 'bg-muted text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary',
              ]"
            >
              <component :is="cmd.icon" :size="16" />
            </div>
            <span class="text-[13px] font-medium">{{ cmd.title }}</span>
          </div>
          <div
            v-if="cmd.active"
            class="h-1.5 w-1.5 rounded-full"
            :class="selectedIndex === index ? 'bg-white' : 'bg-primary'"
          />
        </button>
      </div>
    </div>
  </Transition>
</template>
