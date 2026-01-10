<script setup lang="ts">
import { watch } from 'vue'
import confetti from 'canvas-confetti'

const props = defineProps<{
  active: boolean
}>()

const emit = defineEmits<{
  complete: []
}>()

function startFireworks() {
  requestAnimationFrame(() => {
    confetti({
      particleCount: 100,
      spread: 70,
      origin: { y: 0.6 },
      disableForReducedMotion: true,
    })

    // 动画约 2.5 秒后完成
    setTimeout(() => {
      emit('complete')
    }, 2500)
  })
}

watch(
  () => props.active,
  (active) => {
    if (active) {
      startFireworks()
    }
  },
)

defineExpose({ startFireworks })
</script>

<template>
  <!-- canvas-confetti 自行管理 canvas，无需额外 DOM -->
  <slot />
</template>
