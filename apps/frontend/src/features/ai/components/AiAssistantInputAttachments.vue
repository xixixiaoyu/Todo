<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { X, AlertCircle, FileText, Loader2 } from 'lucide-vue-next'
import type { ParsedFile } from '@/composables/useFileParsing'

defineProps<{
  selectedImages: string[]
  parsedFiles: ParsedFile[]
  isMobile: boolean
}>()

const emit = defineEmits<{
  (e: 'removeImage', index: number): void
  (e: 'removeFile', id: string): void
}>()

const { t } = useI18n()
</script>

<template>
  <div
    v-if="selectedImages.length > 0 || parsedFiles.length > 0"
    :class="['flex flex-wrap gap-2 px-2 pt-2', isMobile ? 'max-h-32 overflow-y-auto' : '']"
  >
    <div
      v-for="(img, index) in selectedImages"
      :key="`img-${index}`"
      :class="[
        'group relative overflow-hidden rounded-lg border border-border bg-muted',
        isMobile ? 'h-14 w-14' : 'h-16 w-16',
      ]"
    >
      <img :src="img" class="h-full w-full object-cover" />
      <button
        class="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-black/50 text-white opacity-0 transition-opacity group-hover:opacity-100"
        @click="emit('removeImage', index)"
      >
        <X :size="12" />
      </button>
    </div>

    <div
      v-for="file in parsedFiles"
      :key="file.id"
      :class="[
        'group relative flex items-center gap-2 rounded-lg border border-border bg-muted/50 px-2 py-1.5 transition-colors hover:bg-muted',
        isMobile ? 'h-14 w-28' : 'h-16 w-32',
      ]"
    >
      <div
        class="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-primary/10 text-primary"
      >
        <Loader2 v-if="file.status === 'parsing'" :size="14" class="animate-spin" />
        <AlertCircle v-else-if="file.status === 'error'" :size="14" class="text-red-500" />
        <FileText v-else :size="14" />
      </div>
      <div class="min-w-0 flex-1">
        <p class="truncate text-[11px] font-medium leading-none">{{ file.name }}</p>
        <p class="mt-1 text-[9px] text-muted-foreground">
          {{ file.status === 'parsing' ? t('ai.parsing') : (file.size / 1024).toFixed(1) + ' KB' }}
        </p>
      </div>
      <button
        class="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-black/50 text-white opacity-0 transition-opacity group-hover:opacity-100"
        @click="emit('removeFile', file.id)"
      >
        <X :size="12" />
      </button>
    </div>
  </div>
</template>
