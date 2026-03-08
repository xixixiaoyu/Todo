<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import ImageLoadingState from './ImageLoadingState.vue'
import AiLuminaIcon from './AiLuminaIcon.vue'

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
        <div class="flex items-center justify-center text-primary">
          <AiLuminaIcon :size="16" />
        </div>
        <span class="shimmer-text text-[13px] font-medium leading-none">{{
          t('ai.isThinking')
        }}</span>
      </div>
      <div class="flex flex-col gap-2">
        <div class="h-2.5 w-[90%] animate-pulse rounded-full bg-ai-message-border"></div>
        <div class="h-2.5 w-[75%] animate-pulse rounded-full bg-ai-message-border delay-75"></div>
        <div class="h-2.5 w-[85%] animate-pulse rounded-full bg-ai-message-border delay-150"></div>
      </div>
    </template>
  </div>
</template>
