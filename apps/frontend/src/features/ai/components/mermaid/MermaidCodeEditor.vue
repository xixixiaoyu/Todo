<script setup lang="ts">
import { ref, nextTick, onUnmounted, watch } from 'vue'
import hljs from 'highlight.js'
import { useI18n } from 'vue-i18n'
import { MAX_HIGHLIGHT_CHARS } from '@/composables/markdown/mermaid'

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

/** HTML 转义，用于无高亮模式的纯文本渲染 */
const escapeHtml = (str: string): string => {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }
  return str.replace(/[&<>"']/g, (c) => map[c] || c)
}

const highlight = () => {
  const code = props.modelValue || ''
  if (code.length > MAX_HIGHLIGHT_CHARS) {
    highlightedCode.value = escapeHtml(code) + '\n'
    return
  }

  const result = hljs.highlight(code, {
    language: 'mermaid',
    ignoreIllegals: true,
  })
  highlightedCode.value = result.value + '\n'
}

// 条件性 requestIdleCallback，兼容测试环境（Happy DOM 不支持 rIC）
const requestIdleCallbackFn =
  typeof requestIdleCallback !== 'undefined'
    ? requestIdleCallback
    : (fn: IdleRequestCallback, opts?: IdleRequestOptions) => setTimeout(fn, opts?.timeout ?? 50)
const cancelIdleCallbackFn =
  typeof cancelIdleCallback !== 'undefined' ? cancelIdleCallback : (id: number) => clearTimeout(id)

let highlightHandle: number | null = null

const debouncedHighlight = () => {
  if (highlightHandle !== null) {
    cancelIdleCallbackFn(highlightHandle)
  }
  highlightHandle = requestIdleCallbackFn(
    () => {
      highlightHandle = null
      highlight()
    },
    { timeout: 100 },
  )
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

    // 在下一次 Vue 渲染后恢复光标位置（优先于 setTimeout）
    nextTick(() => {
      target.selectionStart = target.selectionEnd = start + 2
    })
  }
}

watch(() => props.modelValue, debouncedHighlight, { immediate: true })

onUnmounted(() => {
  if (highlightHandle !== null) {
    cancelIdleCallbackFn(highlightHandle)
    highlightHandle = null
  }
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
