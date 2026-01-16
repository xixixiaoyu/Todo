<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'

const isElectron = computed(() => !!window.electronAPI)
const isMac = computed(() => window.electronAPI?.platform === 'darwin')
const isLinux = computed(() => window.electronAPI?.platform === 'linux')

const isMaximized = ref(false)

const handleMinimize = () => window.electronAPI?.window.minimize()
const handleMaximize = async () => {
  if (!window.electronAPI) return
  if (await window.electronAPI.window.isMaximized()) {
    window.electronAPI.window.unmaximize()
    isMaximized.value = false
  } else {
    window.electronAPI.window.maximize()
    isMaximized.value = true
  }
}
const handleClose = () => window.electronAPI?.window.close()

onMounted(async () => {
  if (isElectron.value && window.electronAPI) {
    isMaximized.value = await window.electronAPI.window.isMaximized()
  }
})
</script>

<template>
  <div
    v-if="isElectron"
    class="electron-titlebar pointer-events-none fixed top-0 left-0 right-0 z-[100] flex select-none items-center h-10"
    :class="[isMac ? 'px-4' : 'pl-4']"
  >
    <!-- Draggable area -->
    <div class="pointer-events-auto h-full w-full drag-region" />

    <!-- Window Controls (Linux only, Windows uses overlay, Mac uses traffic lights) -->
    <div v-if="isLinux" class="pointer-events-auto flex items-center h-full no-drag">
      <button
        class="flex h-10 w-12 items-center justify-center hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
        @click="handleMinimize"
      >
        <div class="h-[1px] w-3 bg-current" />
      </button>
      <button
        class="flex h-10 w-12 items-center justify-center hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
        @click="handleMaximize"
      >
        <div class="h-3 w-3 border border-current" />
      </button>
      <button
        class="flex h-10 w-12 items-center justify-center hover:bg-red-500 hover:text-white transition-colors"
        @click="handleClose"
      >
        <svg class="h-3 w-3" viewBox="0 0 10 10">
          <path
            fill="currentColor"
            d="M0 0 L10 10 M10 0 L0 10"
            stroke="currentColor"
            stroke-width="1.2"
          />
        </svg>
      </button>
    </div>
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

.no-drag {
  -webkit-app-region: no-drag;
}
</style>
