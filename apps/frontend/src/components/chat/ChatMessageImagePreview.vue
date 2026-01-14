<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { X } from 'lucide-vue-next'

defineProps<{
  url: string | null
}>()

const emit = defineEmits<{
  (e: 'close'): void
}>()

const { t } = useI18n()
</script>

<template>
  <Teleport to="body">
    <Transition
      enter-active-class="transition duration-200 ease-out"
      enter-from-class="opacity-0"
      enter-to-class="opacity-100"
      leave-active-class="transition duration-150 ease-in"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0"
    >
      <div
        v-if="url"
        class="fixed inset-0 z-[9999] flex items-center justify-center bg-black/90 p-4 backdrop-blur-sm"
        @click="emit('close')"
      >
        <button
          class="absolute right-6 top-6 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white transition-all hover:bg-white/20 hover:scale-110 active:scale-95"
          :aria-label="t('common.close')"
          @click="emit('close')"
        >
          <X :size="24" />
        </button>
        <img
          :src="url"
          class="max-h-[90vh] max-w-[90vw] animate-in zoom-in-95 duration-300 rounded-lg shadow-2xl object-contain"
          alt="Preview"
          @click.stop
        />
      </div>
    </Transition>
  </Teleport>
</template>
