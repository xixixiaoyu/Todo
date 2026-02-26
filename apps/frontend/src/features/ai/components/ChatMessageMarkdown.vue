<script setup lang="ts">
import { toRefs } from 'vue'
import { useChatMessageMarkdownRender } from '@/features/ai/composables/useChatMessageMarkdownRender'
import ChatMessageAskSelection from '@/features/ai/components/ChatMessageAskSelection.vue'

const props = defineProps<{
  content: string
  isStreaming: boolean
  isMobile: boolean
}>()

const emit = defineEmits<{
  (e: 'ask-selection', prompt: string): void
  (e: 'transfer-selection'): void
}>()

const { content, isStreaming } = toRefs(props)
const { containerRef, renderedHtml, injectInteractions, initCodeInteractions } =
  useChatMessageMarkdownRender({
    content,
    isStreaming,
  })

defineExpose({
  initCodeInteractions,
  injectInteractions,
})
</script>

<template>
  <div ref="containerRef">
    <div
      v-if="renderedHtml"
      class="markdown-content selectable relative break-words leading-relaxed select-text"
    >
      <!-- eslint-disable-next-line vue/no-v-html -->
      <div v-html="renderedHtml" />
    </div>

    <div
      v-else-if="content"
      :class="[
        'relative selectable select-text break-words leading-relaxed',
        isMobile ? 'text-[14px]' : 'text-[15px]',
      ]"
    >
      {{ content }}
    </div>
  </div>

  <ChatMessageAskSelection
    :container="containerRef"
    @ask-selection="(prompt) => emit('ask-selection', prompt)"
    @transfer-selection="() => emit('transfer-selection')"
  />
</template>

<style scoped>
.markdown-content :deep(.hljs) {
  background: transparent;
  padding: 0;
}
</style>
