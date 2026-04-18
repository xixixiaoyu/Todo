<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import hljs from 'highlight.js'
import { useI18n } from 'vue-i18n'

const props = defineProps<{
  modelValue: string
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void
}>()

const { t } = useI18n()
const textareaRef = ref<HTMLTextAreaElement | null>(null)
const preRef = ref<HTMLPreElement | null>(null)
const highlightedCode = ref('')

const highlight = () => {
  const result = hljs.highlight(props.modelValue || '', {
    language: 'mermaid',
    ignoreIllegals: true,
  })
  highlightedCode.value = result.value + '\n' // 增加换行符以防止最后一行抖动
}

const syncScroll = () => {
  if (!textareaRef.value || !preRef.value) return
  preRef.value.scrollTop = textareaRef.value.scrollTop
  preRef.value.scrollLeft = textareaRef.value.scrollLeft
}

const handleInput = (e: Event) => {
  const target = e.target as HTMLTextAreaElement
  emit('update:modelValue', target.value)
}

const handleKeydown = (e: KeyboardEvent) => {
  if (e.key === 'Tab') {
    e.preventDefault()
    const target = e.target as HTMLTextAreaElement
    const start = target.selectionStart
    const end = target.selectionEnd

    const newValue = target.value.substring(0, start) + '  ' + target.value.substring(end)
    emit('update:modelValue', newValue)

    // 在下一次渲染后恢复光标位置
    setTimeout(() => {
      target.selectionStart = target.selectionEnd = start + 2
    }, 0)
  }
}

watch(() => props.modelValue, highlight, { immediate: true })

onMounted(() => {
  highlight()
})
</script>

<template>
  <div
    class="mermaid-code-editor relative h-full w-full overflow-hidden rounded-lg border border-border bg-muted/30"
  >
    <!-- 高亮显示层 -->
    <pre
      ref="preRef"
      class="pointer-events-none absolute inset-0 m-0 h-full w-full overflow-hidden p-4 font-mono text-sm leading-relaxed"
      aria-hidden="true"
    >
      <!-- eslint-disable-next-line vue/no-v-html -->
      <code class="hljs language-mermaid" v-html="highlightedCode"></code>
    </pre>

    <!-- 输入层 -->
    <textarea
      ref="textareaRef"
      :value="modelValue"
      class="absolute inset-0 h-full w-full resize-none border-none bg-transparent p-4 font-mono text-sm leading-relaxed text-transparent caret-foreground outline-none focus:ring-0"
      spellcheck="false"
      :aria-label="t('ai.mermaidEditorCodeLabel')"
      :placeholder="t('ai.mermaidEmptyCode')"
      @input="handleInput"
      @scroll="syncScroll"
      @keydown="handleKeydown"
    ></textarea>
  </div>
</template>

<style scoped>
.mermaid-code-editor pre,
.mermaid-code-editor textarea {
  white-space: pre-wrap;
  word-wrap: break-word;
  tab-size: 2;
  -moz-tab-size: 2;
}

/* 确保高亮代码的字体样式与 textarea 完全一致 */
.mermaid-code-editor code {
  font-family: inherit;
  font-size: inherit;
  line-height: inherit;
  background: transparent;
  padding: 0;
}
</style>
