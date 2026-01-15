<script setup lang="ts">
defineProps<{
  title: string
  description?: string
}>()
</script>

<template>
  <div class="flex-1 flex items-center justify-center bg-background px-4 py-12 overflow-y-auto">
    <div
      class="w-full max-w-[480px] bg-card rounded-[20px] p-12 shadow-card animate-fade-in-up my-auto"
    >
      <div class="mb-8">
        <h2 class="text-3xl font-bold text-foreground text-center">
          {{ title }}
        </h2>
        <p v-if="description" class="mt-3 text-muted-foreground text-center leading-relaxed">
          {{ description }}
        </p>
      </div>

      <slot />
    </div>
  </div>
</template>
