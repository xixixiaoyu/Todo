<script setup lang="ts">
import { ref, computed } from 'vue'
import { ChevronDown, Copy, Check } from 'lucide-vue-next'
import type { ChatMessage } from '@/features/ai/composables/useChat'

const props = defineProps<{
  message: ChatMessage
  isPrevTool?: boolean
  isNextTool?: boolean
}>()

const isExpanded = ref(false)
const isCopied = ref(false)

const formattedContent = computed(() => {
  try {
    const parsed = JSON.parse(props.message.content)
    return JSON.stringify(parsed, null, 2)
  } catch {
    return props.message.content
  }
})

const isError = computed(
  () =>
    props.message.content.toLowerCase().includes('error:') ||
    props.message.content.toLowerCase().includes('"iserror":true'),
)

const displayName = computed(() => {
  const raw = props.message.toolName || 'agent_tool'
  return raw
    .replace(/^agent_/, '')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
})

const hasContent = computed(() => !!props.message.content)

function toggleExpand() {
  if (!hasContent.value) return
  isExpanded.value = !isExpanded.value
}

async function copyToClipboard(e: MouseEvent) {
  e.stopPropagation()
  try {
    await navigator.clipboard.writeText(formattedContent.value)
    isCopied.value = true
    setTimeout(() => {
      isCopied.value = false
    }, 2000)
  } catch {
    /* ignore */
  }
}
</script>

<template>
  <div class="tool-item group/tool" :class="{ 'mt-0': isPrevTool, 'mb-0': isNextTool }">
    <!-- 主体 -->
    <div
      class="tool-body"
      :class="{
        'tool-body--expanded': isExpanded && hasContent,
        'tool-body--error': isError && hasContent,
        'tool-body--running': !hasContent,
      }"
    >
      <button class="tool-header" :class="{ 'cursor-default': !hasContent }" @click="toggleExpand">
        <!-- 状态点 -->
        <span
          class="tool-dot"
          :class="{
            'tool-dot--pending': !hasContent,
            'tool-dot--ok': hasContent && !isError,
            'tool-dot--err': hasContent && isError,
          }"
        />

        <!-- 工具名 -->
        <span class="tool-name">{{ displayName }}</span>

        <!-- 状态标签 -->
        <span
          class="tool-tag"
          :class="{
            'tool-tag--pending': !hasContent,
            'tool-tag--ok': hasContent && !isError,
          }"
        >
          {{ hasContent ? 'done' : 'running' }}
        </span>

        <span class="flex-1" />

        <!-- 展开 -->
        <ChevronDown
          v-if="hasContent"
          :size="13"
          class="tool-chevron"
          :class="{ 'rotate-180': isExpanded }"
        />
      </button>

      <!-- 内容 -->
      <div v-if="isExpanded && hasContent" class="tool-content">
        <div class="tool-content-inner">
          <button class="tool-copy" @click="copyToClipboard">
            <Check v-if="isCopied" :size="11" class="text-emerald-500" />
            <Copy v-else :size="11" />
          </button>
          <pre><code>{{ formattedContent }}</code></pre>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.tool-item {
  min-height: 36px;
  margin: 4px 0;
}

/* ── 主体 ── */
.tool-body {
  position: relative;
  border: 1px solid hsl(var(--border) / 0.25);
  border-radius: 10px;
  background: hsl(var(--muted) / 0.2);
  overflow: hidden;
  transition:
    border-color 0.3s,
    background 0.3s;
}

.tool-body:hover {
  border-color: hsl(var(--border) / 0.45);
}

.tool-body--expanded {
  border-color: hsl(var(--border) / 0.4);
  background: hsl(var(--muted) / 0.35);
}

.tool-body--running::after {
  content: '';
  position: absolute;
  top: 0;
  bottom: 0;
  left: -35%;
  width: 30%;
  pointer-events: none;
  background: linear-gradient(
    90deg,
    transparent 0%,
    hsl(var(--foreground) / 0.02) 35%,
    hsl(var(--foreground) / 0.07) 50%,
    hsl(var(--foreground) / 0.02) 65%,
    transparent 100%
  );
  animation: tool-running-sheen 2.1s cubic-bezier(0.4, 0, 0.2, 1) infinite;
}

.tool-body--error {
  border-color: hsl(var(--destructive) / 0.2);
}

/* ── 头部 ── */
.tool-header {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 7px 12px;
  border: none;
  background: transparent;
  cursor: pointer;
  font: inherit;
  color: inherit;
}

/* ── 状态点 ── */
.tool-dot {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  flex-shrink: 0;
}

.tool-dot--pending {
  background: hsl(var(--muted-foreground) / 0.35);
  animation: dot-pulse 2s ease-in-out infinite;
}

.tool-dot--ok {
  background: hsl(var(--primary) / 0.5);
}

.tool-dot--err {
  background: hsl(var(--destructive) / 0.5);
}

@keyframes dot-pulse {
  0%,
  100% {
    opacity: 0.3;
  }
  50% {
    opacity: 1;
  }
}

@keyframes tool-running-sheen {
  0% {
    transform: translateX(0);
    opacity: 0;
  }
  12% {
    opacity: 1;
  }
  78% {
    opacity: 0.75;
  }
  100% {
    transform: translateX(470%);
    opacity: 0;
  }
}

/* ── 名称 ── */
.tool-name {
  font-size: 0.78rem;
  font-weight: 450;
  color: hsl(var(--foreground) / 0.75);
  letter-spacing: -0.01em;
}

/* ── 状态标签 ── */
.tool-tag {
  font-size: 0.6rem;
  font-weight: 500;
  letter-spacing: 0.03em;
  padding: 1px 6px;
  border-radius: 3px;
}

.tool-tag--pending {
  color: hsl(var(--muted-foreground) / 0.5);
  background: hsl(var(--muted-foreground) / 0.06);
}

.tool-tag--ok {
  color: hsl(var(--primary) / 0.55);
  background: hsl(var(--primary) / 0.06);
}

/* ── 展开箭头 ── */
.tool-chevron {
  color: hsl(var(--muted-foreground) / 0.25);
  flex-shrink: 0;
  transition: transform 0.25s ease;
}

/* ── 内容 ── */
.tool-content {
  padding: 0 12px 8px;
}

.tool-content-inner {
  position: relative;
  border-radius: 7px;
  background: hsl(var(--background) / 0.5);
  border: 1px solid hsl(var(--border) / 0.12);
  overflow: hidden;
}

.tool-copy {
  position: absolute;
  right: 5px;
  top: 5px;
  z-index: 2;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border: none;
  border-radius: 5px;
  background: transparent;
  color: hsl(var(--muted-foreground) / 0.3);
  cursor: pointer;
  transition: all 0.2s;
}

.tool-copy:hover {
  background: hsl(var(--foreground) / 0.04);
  color: hsl(var(--foreground) / 0.5);
}

pre {
  margin: 0;
  padding: 8px 12px;
  max-height: 240px;
  overflow: auto;
  font-family: 'SF Mono', 'JetBrains Mono', ui-monospace, monospace;
  font-size: 0.68rem;
  line-height: 1.55;
  color: hsl(var(--foreground) / 0.5);
  white-space: pre-wrap;
  word-break: break-all;
  scrollbar-width: thin;
  scrollbar-color: hsl(var(--border) / 0.2) transparent;
}

pre::-webkit-scrollbar {
  width: 4px;
}
pre::-webkit-scrollbar-thumb {
  background: hsl(var(--border) / 0.3);
  border-radius: 2px;
}

@media (prefers-reduced-motion: reduce) {
  .tool-dot--pending,
  .tool-body--running::after {
    animation: none;
  }
}
</style>
