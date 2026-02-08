<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import ImageLoadingState from './ImageLoadingState.vue'

defineProps<{
  isImageGenerating: boolean
}>()

const { t } = useI18n()
</script>

<template>
  <div
    class="loading-container flex flex-col gap-3 rounded-2xl border border-ai-message-border bg-ai-message-bg p-4 shadow-sm"
  >
    <!-- 场景 A: 正在生成图片 -->
    <ImageLoadingState v-if="isImageGenerating" />

    <!-- 场景 B: 正在思考文字 -->
    <template v-else>
      <div class="flex items-center gap-2">
        <div class="ai-icon translate-y-[2px] animate-ai-float text-primary">
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M12 2L13.09 8.26L20 9L13.09 9.74L12 16L10.91 9.74L4 9L10.91 8.26L12 2Z"
              fill="currentColor"
              class="ai-star"
            />
          </svg>
        </div>
        <span class="shimmer-text font-medium">{{ t('ai.isThinking') }}</span>
      </div>
      <div class="flex flex-col gap-2">
        <div class="h-2.5 w-[90%] animate-pulse rounded-full bg-ai-message-border"></div>
        <div class="h-2.5 w-[75%] animate-pulse rounded-full bg-ai-message-border delay-75"></div>
        <div class="h-2.5 w-[85%] animate-pulse rounded-full bg-ai-message-border delay-150"></div>
      </div>
    </template>
  </div>
</template>
