<script setup lang="ts">
import { ref, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { ChevronDown, Terminal, AlertCircle, Copy, Check, Activity } from 'lucide-vue-next'
import type { ChatMessage } from '@/features/ai/composables/useChat'
import { useGsap } from '@/composables/useGsap'

const props = defineProps<{
  message: ChatMessage
  isPrevTool?: boolean
  isNextTool?: boolean
}>()

const { t } = useI18n()
const isExpanded = ref(false)
const isCopied = ref(false)
const { gsap } = useGsap()

// 格式化 JSON 内容
const formattedContent = computed(() => {
  try {
    const parsed = JSON.parse(props.message.content)
    return JSON.stringify(parsed, null, 2)
  } catch {
    return props.message.content
  }
})

// 判断是否是错误结果
const isError = computed(() => {
  return (
    props.message.content.toLowerCase().includes('error:') ||
    props.message.content.toLowerCase().includes('"iserror":true')
  )
})

const toggleExpand = () => {
  isExpanded.value = !isExpanded.value
}

const copyToClipboard = async (e: MouseEvent) => {
  e.stopPropagation()
  try {
    await navigator.clipboard.writeText(formattedContent.value)
    isCopied.value = true
    setTimeout(() => {
      isCopied.value = false
    }, 2000)
  } catch (err) {
    console.error('Failed to copy:', err)
  }
}

// 动画逻辑
const onEnter = (el: Element) => {
  gsap.fromTo(
    el,
    { height: 0, opacity: 0, y: -4 },
    { height: 'auto', opacity: 1, y: 0, duration: 0.4, ease: 'back.out(1.2)' },
  )
}

const onLeave = (el: Element) => {
  gsap.to(el, { height: 0, opacity: 0, y: -4, duration: 0.3, ease: 'power2.in' })
}
</script>

<template>
  <div
    class="mcp-tool-wrapper relative pl-12 group/tool select-none"
    :class="[isPrevTool ? 'pt-0' : 'pt-1', isNextTool ? 'pb-0' : 'pb-1']"
  >
    <!-- Connecting Axis (精确对齐图标中心) -->
    <div class="absolute left-[30px] top-0 h-full w-[2px] z-0">
      <!-- Background Line -->
      <div
        class="h-full w-full bg-border/20 transition-colors duration-500 group-hover/tool:bg-primary/20"
        :class="{
          'rounded-t-full': !isPrevTool,
          'rounded-b-full': !isNextTool,
          'h-1/2 translate-y-1/2': !isPrevTool && isNextTool,
          'h-1/2': isPrevTool && !isNextTool,
          'h-full': isPrevTool && isNextTool,
        }"
      ></div>

      <!-- Dot / Node -->
      <div
        class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-1 w-1 rounded-full border border-background bg-border/60 transition-all duration-500 group-hover/tool:bg-primary/60 group-hover/tool:scale-110 z-10"
        :class="{ 'bg-primary/40': isExpanded }"
      ></div>
    </div>

    <!-- Main Container (材质增强) -->
    <div
      class="inline-flex flex-col min-w-[180px] max-w-full rounded-[0.75rem] border border-border/30 bg-white/40 dark:bg-white/[0.02] backdrop-blur-md transition-all duration-500 hover:border-primary/20 hover:bg-white/60 dark:hover:bg-white/[0.04] hover:shadow-[0_4px_20px_-4px_rgba(0,0,0,0.03)]"
      :class="{
        'border-primary/20 bg-white/80 dark:bg-white/[0.06] shadow-sm ring-1 ring-primary/5':
          isExpanded,
      }"
    >
      <!-- Header / Trigger -->
      <div class="flex items-center gap-2.5 px-2.5 py-0.5 cursor-pointer" @click="toggleExpand">
        <!-- Icon Shell (对齐轴线) -->
        <div
          class="flex h-6 w-6 items-center justify-center rounded-md transition-all duration-500"
          :class="[
            isError ? 'bg-destructive/5 text-destructive/60' : 'bg-primary/5 text-primary/60',
            isExpanded ? 'scale-105 shadow-inner bg-primary/10 text-primary/80' : '',
          ]"
        >
          <Activity v-if="!isExpanded && !isError" :size="12" class="animate-pulse" />
          <Terminal v-else-if="!isError" :size="12" />
          <AlertCircle v-else :size="12" />
        </div>

        <!-- Text Info -->
        <div class="flex flex-col gap-0 overflow-hidden">
          <div class="flex items-center gap-2">
            <span
              class="truncate text-[12px] font-medium tracking-tight text-foreground/70 leading-tight"
            >
              {{ message.toolName || t('ai.mcpToolResult') }}
            </span>
          </div>
          <span
            class="text-[9px] font-semibold tracking-wider text-muted-foreground/40 uppercase leading-none"
          >
            {{ isError ? t('ai.mcpToolError') : 'Success' }}
          </span>
        </div>

        <!-- Spacer -->
        <div class="flex-1 min-w-[12px]"></div>

        <!-- Arrow -->
        <div
          class="flex h-5 w-5 items-center justify-center rounded-full text-muted-foreground/20 transition-all duration-500 hover:bg-primary/5 hover:text-primary/40"
          :class="{ 'rotate-180 text-primary/40 bg-primary/5': isExpanded }"
        >
          <ChevronDown :size="13" stroke-width="2.5" />
        </div>
      </div>

      <!-- Expanded Content Area -->
      <Transition :css="false" @enter="onEnter" @leave="onLeave">
        <div v-if="isExpanded" class="overflow-hidden">
          <div class="px-2 pb-2">
            <div
              class="relative overflow-hidden rounded-[0.75rem] bg-black/[0.01] dark:bg-white/[0.01] border border-border/10"
            >
              <!-- Copy Button -->
              <button
                class="absolute right-1.5 top-1.5 z-10 flex h-6 w-6 items-center justify-center rounded-lg border border-border/20 bg-background/60 text-muted-foreground/60 backdrop-blur-md transition-all hover:bg-background hover:text-foreground active:scale-90 shadow-sm"
                :title="t('ai.copy')"
                @click="copyToClipboard"
              >
                <Check v-if="isCopied" :size="12" class="text-green-500/80" />
                <Copy v-else :size="12" />
              </button>

              <!-- Code Content -->
              <div class="max-h-[300px] overflow-auto p-3 font-mono text-[11px] leading-relaxed">
                <pre
                  class="text-foreground/50 selection:bg-primary/10"
                ><code>{{ formattedContent }}</code></pre>
              </div>
            </div>
          </div>
        </div>
      </Transition>
    </div>
  </div>
</template>

<style scoped>
.mcp-tool-wrapper {
  perspective: 1000px;
}

pre {
  scrollbar-width: thin;
  scrollbar-color: hsl(var(--border)) transparent;
}

pre::-webkit-scrollbar {
  width: 4px;
  height: 4px;
}

pre::-webkit-scrollbar-thumb {
  background: hsl(var(--border) / 0.4);
  border-radius: 10px;
}

.animate-pulse {
  animation: pulse 2.5s cubic-bezier(0.4, 0, 0.6, 1) infinite;
}

@keyframes pulse {
  0%,
  100% {
    opacity: 1;
    transform: scale(1);
  }
  50% {
    opacity: 0.4;
    transform: scale(0.85);
  }
}

/* 暖色调光影增强 */
.dark .mcp-tool-wrapper :deep(.bg-\[\#fdfcfb\]) {
  background-color: rgba(255, 255, 255, 0.03);
}
</style>
