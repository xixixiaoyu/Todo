<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue'
import { useI18n } from 'vue-i18n'
import { useMermaidEditor } from '../composables/useMermaidEditor'
import { useResizable } from '@/composables/useResizable'
import { useWindowSize } from '@/composables/useWindowSize'
import { useGsap } from '@/composables/useGsap'
import { useEscClose } from '@/composables/useEscClose'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { useToast } from '@/composables/useToast'
import MermaidCodeEditor from './MermaidCodeEditor.vue'
import MermaidPreviewPanel from './MermaidPreviewPanel.vue'

const { t } = useI18n()
const { success } = useToast()
const { width: windowWidth } = useWindowSize()
const isMobile = computed(() => windowWidth.value < 640)

const { isOpen, code, svgHtml, error, isRendering, closeEditor, updateCode } = useMermaidEditor()

// 只有在打开时才处理 ESC
useEscClose(isOpen, closeEditor)

// 分栏宽度管理
const {
  width: leftWidth,
  startResize,
  isResizing,
} = useResizable({
  initialWidth: 500,
  minWidth: 300,
  maxWidth: () => windowWidth.value - 300,
})

const leftPanelStyle = computed(() => ({
  width: isMobile.value ? '100%' : `${leftWidth.value}px`,
}))

// 动画
const dialogRef = ref<HTMLElement | null>(null)
const { gsap } = useGsap()

watch(isOpen, (newVal) => {
  if (newVal) {
    nextTick(() => {
      if (!dialogRef.value) return
      gsap.fromTo(
        dialogRef.value,
        { opacity: 0, scale: 0.95, y: 10 },
        { opacity: 1, scale: 1, y: 0, duration: 0.3, ease: 'power2.out' },
      )
    })
  }
})

// 功能操作
const copySource = async () => {
  try {
    await navigator.clipboard.writeText(code.value)
    success(t('ai.mermaidSourceCopied'))
  } catch (err) {
    console.error('Copy source failed:', err)
  }
}

const copySvg = async () => {
  if (!svgHtml.value) return
  try {
    await navigator.clipboard.writeText(svgHtml.value)
    success(t('ai.mermaidSvgCopied'))
  } catch (err) {
    console.error('Copy SVG failed:', err)
  }
}
</script>

<template>
  <Teleport to="body">
    <Transition
      :css="false"
      @enter="
        (el, done) => {
          gsap.fromTo(el, { opacity: 0 }, { opacity: 1, duration: 0.2, onComplete: done })
        }
      "
      @leave="
        (el, done) => {
          gsap.to(el, { opacity: 0, duration: 0.2, onComplete: done })
        }
      "
    >
      <div
        v-if="isOpen"
        class="fixed inset-0 z-[300] flex items-center justify-center bg-background/80 backdrop-blur-md"
        @click.self="closeEditor"
      >
        <div
          ref="dialogRef"
          class="relative flex h-[90vh] w-[95vw] flex-col overflow-hidden rounded-xl border border-border bg-background shadow-2xl"
        >
          <!-- Header -->
          <header class="flex h-14 items-center justify-between border-b border-border px-6">
            <div class="flex items-center gap-2">
              <div
                class="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary"
              >
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                >
                  <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"></path>
                  <path d="m15 5 4 4"></path>
                </svg>
              </div>
              <h2 class="text-lg font-semibold tracking-tight">{{ t('ai.mermaidEditorTitle') }}</h2>
            </div>
            <button
              class="rounded-full p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              @click="closeEditor"
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
                <path d="M18 6 6 18"></path>
                <path d="m6 6 12 12"></path>
              </svg>
            </button>
          </header>

          <!-- Main Content -->
          <main class="flex-1 overflow-hidden">
            <!-- Desktop: Split Layout -->
            <div v-if="!isMobile" class="flex h-full w-full overflow-hidden">
              <!-- Editor Panel -->
              <div :style="leftPanelStyle" class="flex flex-col overflow-hidden p-4">
                <div class="mb-2 flex items-center justify-between px-1">
                  <span
                    class="text-xs font-medium text-muted-foreground uppercase tracking-wider"
                    >{{ t('ai.mermaidEditorCodeLabel') }}</span
                  >
                </div>
                <div class="flex-1 overflow-hidden">
                  <MermaidCodeEditor :model-value="code" @update:model-value="updateCode" />
                </div>
              </div>

              <!-- Resizer -->
              <div
                class="group relative flex w-1 cursor-ew-resize items-center justify-center bg-border transition-colors hover:bg-primary/50"
                :class="{ 'bg-primary': isResizing }"
                @mousedown="startResize"
              >
                <div class="absolute inset-y-0 -left-1 -right-1 z-10"></div>
                <div class="h-8 w-1 rounded-full bg-border group-hover:bg-primary/50"></div>
              </div>

              <!-- Preview Panel -->
              <div class="flex flex-1 flex-col overflow-hidden p-4">
                <div class="mb-2 flex items-center justify-between px-1">
                  <span
                    class="text-xs font-medium text-muted-foreground uppercase tracking-wider"
                    >{{ t('ai.mermaidPreviewLabel') }}</span
                  >
                </div>
                <div class="flex-1 overflow-hidden">
                  <MermaidPreviewPanel
                    :svg-html="svgHtml"
                    :error="error"
                    :is-rendering="isRendering"
                  />
                </div>
              </div>
            </div>

            <!-- Mobile: Tabs Layout -->
            <div v-else class="h-full w-full overflow-hidden">
              <Tabs default-value="editor" class="flex h-full flex-col">
                <div class="flex justify-center border-b border-border bg-muted/20 py-2">
                  <TabsList>
                    <TabsTrigger value="editor">{{ t('ai.edit') }}</TabsTrigger>
                    <TabsTrigger value="preview">{{ t('ai.mermaidPreviewLabel') }}</TabsTrigger>
                  </TabsList>
                </div>
                <div class="flex-1 overflow-hidden p-4">
                  <TabsContent value="editor" class="m-0 h-full">
                    <MermaidCodeEditor :model-value="code" @update:model-value="updateCode" />
                  </TabsContent>
                  <TabsContent value="preview" class="m-0 h-full">
                    <MermaidPreviewPanel
                      :svg-html="svgHtml"
                      :error="error"
                      :is-rendering="isRendering"
                    />
                  </TabsContent>
                </div>
              </Tabs>
            </div>
          </main>

          <!-- Footer -->
          <footer
            class="flex h-16 items-center justify-end gap-3 border-t border-border px-6 bg-muted/5"
          >
            <Button variant="outline" size="sm" @click="copySource">
              <svg
                class="mr-2"
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
              </svg>
              {{ t('ai.mermaidCopySource') }}
            </Button>
            <Button variant="outline" size="sm" :disabled="!svgHtml" @click="copySvg">
              <svg
                class="mr-2"
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                <polyline points="7 10 12 15 17 10"></polyline>
                <line x1="12" y1="15" x2="12" y2="3"></line>
              </svg>
              {{ t('ai.mermaidCopySvg') }}
            </Button>
          </footer>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
/* 确保对话框在小屏幕上也能良好展示 */
@media (max-width: 640px) {
  .relative {
    height: 100vh;
    width: 100vw;
    border-radius: 0;
  }
}
</style>
