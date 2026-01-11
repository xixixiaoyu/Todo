<script setup lang="ts">
import { RouterView } from 'vue-router'
import ToastProvider from '@/components/ui/ToastProvider.vue'
import { TooltipProvider } from '@/components/ui/tooltip'
</script>

<template>
  <TooltipProvider>
    <div class="min-h-screen bg-background text-foreground transition-colors duration-300">
      <RouterView />
      <ToastProvider />
    </div>
  </TooltipProvider>
</template>
