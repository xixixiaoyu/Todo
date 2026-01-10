<script setup lang="ts">
import { RouterLink } from 'vue-router'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
</script>

<template>
  <div class="min-h-[60vh] flex flex-col items-center justify-center bg-background">
    <h1 class="text-9xl font-bold text-muted-foreground/20">404</h1>
    <h2 class="text-2xl font-semibold text-foreground mt-4">{{ t('notFound.title') }}</h2>
    <p class="text-muted-foreground mt-2 mb-8">{{ t('notFound.description') }}</p>
    <RouterLink
      to="/"
      class="px-6 py-3 bg-primary text-primary-foreground font-medium rounded-lg hover:bg-primary/90 transition-colors"
    >
      {{ t('common.backToHome') }}
    </RouterLink>
  </div>
</template>
