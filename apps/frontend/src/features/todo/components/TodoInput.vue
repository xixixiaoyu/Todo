<script setup lang="ts">
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

defineProps<{
  modelValue: string
  isShaking: boolean
  showTooltip: boolean
  errorMessage: string
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
  add: []
  keydown: [e: KeyboardEvent]
}>()
</script>

<template>
  <div class="relative mb-6">
    <div class="flex items-center gap-3">
      <div
        class="flex-1 rounded-xl border border-[#e8e4dd] bg-white px-4 py-3 transition-all dark:border-[#3a3a3a] dark:bg-[#2a2a2a]"
        :class="isShaking ? 'animate-shake border-[#d97757] dark:border-[#d97757]' : ''"
      >
        <input
          :value="modelValue"
          type="text"
          :placeholder="t('todo.inputPlaceholder')"
          class="w-full bg-transparent text-[#3a3a3a] outline-none placeholder:text-[#c4c0b8] dark:text-[#e0e0e0] dark:placeholder:text-[#6b6b6b]"
          @input="emit('update:modelValue', ($event.target as HTMLInputElement).value)"
          @keydown="emit('keydown', $event)"
        />
      </div>
      <button
        class="rounded-xl bg-[#c9b896] px-6 py-3 font-medium text-white transition-all hover:bg-[#b8a785] active:scale-95 dark:bg-[#b8a785] dark:hover:bg-[#a99676]"
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
        class="absolute -top-10 left-0 z-10 rounded-lg bg-[#3a3a3a] px-3 py-1.5 text-sm text-white shadow-lg dark:bg-[#4a4a4a]"
      >
        {{ errorMessage?.includes('.') ? t(errorMessage) : errorMessage || '' }}
        <!-- 小三角 -->
        <div class="absolute -bottom-1 left-4 h-2 w-2 rotate-45 bg-[#3a3a3a] dark:bg-[#4a4a4a]" />
      </div>
    </Transition>
  </div>
</template>
