<script setup lang="ts">
import { computed } from 'vue'

const isElectron = computed(() => !!window.electronAPI)
</script>

<template>
  <div
    v-if="isElectron"
    class="electron-titlebar pointer-events-none fixed top-0 left-0 right-0 z-[100] flex select-none items-center px-4 h-14"
  >
    <!-- Draggable area -->
    <div class="pointer-events-auto h-full w-full drag-region" />
  </div>
</template>

<style scoped>
.electron-titlebar {
  -webkit-user-select: none;
  user-select: none;
}

.drag-region {
  -webkit-app-region: drag;
}
</style>
