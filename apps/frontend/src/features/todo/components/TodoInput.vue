<script setup lang="ts">
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

defineProps<{
  modelValue: string
  isShaking: boolean
  showTooltip: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
  add: []
  keydown: [e: KeyboardEvent]
}>()
</script>

<template>
  <div class="mb-6 relative">
    <div class="flex items-center gap-3">
      <div
        class="flex-1 rounded-xl border border-[#e8e4dd] bg-white px-4 py-3 transition-all"
        :class="isShaking ? 'border-[#d97757] animate-shake' : ''"
      >
        <input
          :value="modelValue"
          type="text"
          :placeholder="t('todo.inputPlaceholder')"
          class="w-full bg-transparent text-[#3a3a3a] outline-none placeholder:text-[#c4c0b8]"
          @input="emit('update:modelValue', ($event.target as HTMLInputElement).value)"
          @keydown="emit('keydown', $event)"
        />
      </div>
      <button
        class="rounded-xl bg-[#c9b896] px-6 py-3 font-medium text-white transition-all hover:bg-[#b8a785] active:scale-95"
        @click="emit('add')"
      >
        {{ t('todo.add') }}
      </button>
    </div>
    <!-- 浮动提示 -->
    <Transition
      enter-active-class="transition-opacity duration-200"
      enter-from-class="opacity-0"
      enter-to-class="opacity-100"
      leave-active-class="transition-opacity duration-200"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0"
    >
      <div
        v-if="showTooltip"
        class="absolute -top-10 left-0 z-10 rounded-lg bg-[#3a3a3a] px-3 py-1.5 text-sm text-white shadow-lg"
      >
        {{ t('todo.duplicate') }}
        <!-- 小三角 -->
        <div class="absolute -bottom-1 left-4 h-2 w-2 rotate-45 bg-[#3a3a3a]" />
      </div>
    </Transition>
  </div>
</template>
