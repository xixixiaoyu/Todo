<script setup lang="ts">
import { ref, watch, nextTick, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { initMermaidInteractions } from '@/composables/markdown/mermaid-interactions'

const props = defineProps<{
  svgHtml: string
  error: string | null
  isRendering: boolean
}>()

const { t } = useI18n()
const containerRef = ref<HTMLElement | null>(null)

const updateInteractions = () => {
  if (!containerRef.value) return

  // 查找内部的 mermaid-container
  const mermaidContainer = containerRef.value.querySelector('.mermaid-container') as HTMLElement
  if (mermaidContainer) {
    // 清除之前的交互状态以便重新绑定
    delete mermaidContainer.dataset.interacted
    initMermaidInteractions(mermaidContainer)
  }
}

watch(
  () => props.svgHtml,
  () => {
    void nextTick(updateInteractions)
  },
)

onMounted(() => {
  updateInteractions()
})
</script>

<template>
  <div
    class="mermaid-preview-panel relative h-full w-full overflow-hidden rounded-lg border border-border bg-background"
  >
    <!-- 状态层：渲染中 -->
    <div
      v-if="isRendering && !svgHtml"
      class="absolute inset-0 z-10 flex items-center justify-center bg-background/50 backdrop-blur-sm"
    >
      <div class="flex flex-col items-center gap-2">
        <div
          class="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent"
        ></div>
        <span class="text-xs text-muted-foreground">正在渲染...</span>
      </div>
    </div>

    <!-- 状态层：错误 -->
    <div
      v-if="error"
      class="absolute inset-0 z-20 flex items-center justify-center p-6 bg-background"
    >
      <div class="max-w-md space-y-2 text-center">
        <div
          class="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-destructive/10 text-destructive"
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="12" y1="8" x2="12" y2="12"></line>
            <line x1="12" y1="16" x2="12.01" y2="16"></line>
          </svg>
        </div>
        <h3 class="font-medium text-destructive">{{ t('ai.mermaidRenderError') }}</h3>
        <p class="text-xs text-muted-foreground break-all font-mono">{{ error }}</p>
      </div>
    </div>

    <!-- 状态层：空代码 -->
    <div
      v-if="!svgHtml && !error && !isRendering"
      class="absolute inset-0 flex items-center justify-center text-muted-foreground"
    >
      <div class="flex flex-col items-center gap-2 opacity-50">
        <svg
          width="40"
          height="40"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="1.5"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"></path>
          <polyline points="14 2 14 8 20 8"></polyline>
          <path d="M12 18v-6"></path>
          <path d="M8 15h8"></path>
        </svg>
        <p class="text-sm">{{ t('ai.mermaidEmptyCode') }}</p>
      </div>
    </div>

    <!-- 内容层：SVG 渲染 -->
    <div ref="containerRef" class="h-full w-full overflow-hidden">
      <div v-if="svgHtml" class="mermaid-container h-full w-full" data-processed="true">
        <div class="mermaid-zoom-controls">
          <div class="mermaid-zoom-divider"></div>
          <button class="mermaid-zoom-btn" data-action="in" title="放大">+</button>
          <button class="mermaid-zoom-btn" data-action="out" title="缩小">−</button>
          <button class="mermaid-zoom-btn" data-action="reset" title="重置">⌂</button>
        </div>
        <!-- eslint-disable vue/no-v-html -->
        <div
          class="mermaid-diagram h-full w-full flex items-center justify-center"
          v-html="svgHtml"
        ></div>
        <!-- eslint-enable vue/no-v-html -->
      </div>
    </div>
  </div>
</template>

<style scoped>
.mermaid-preview-panel :deep(.mermaid-container) {
  position: relative;
  background: transparent;
  border: none;
  margin: 0;
  padding: 0;
}

.mermaid-preview-panel :deep(.mermaid-zoom-controls) {
  opacity: 1; /* 在编辑器中始终显示控制栏 */
  top: 1rem;
  right: 1rem;
}
</style>
