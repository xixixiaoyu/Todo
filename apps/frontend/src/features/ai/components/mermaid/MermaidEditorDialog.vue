<script setup lang="ts">
import { ref, computed } from 'vue'
import type { CSSProperties } from 'vue'
import { useI18n } from 'vue-i18n'
import { PanelLeftClose, PanelLeftOpen, Copy, Download } from 'lucide-vue-next'
import { useMermaidEditor } from '../../composables/useMermaidEditor'
import { useResizable } from '@/composables/useResizable'
import { useWindowSize } from '@/composables/useWindowSize'
import { useToast } from '@/composables/useToast'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import EditorDialog from '../EditorDialog.vue'
import MermaidCodeEditor from './MermaidCodeEditor.vue'
import MermaidPreviewPanel from './MermaidPreviewPanel.vue'

const { t } = useI18n()
const { success } = useToast()
const { width: windowWidth } = useWindowSize()
const isMobile = computed(() => windowWidth.value < 640)

const { isOpen, code, svgHtml, error, isRendering, closeEditor, updateCode } = useMermaidEditor()

const isLeftPanelCollapsed = ref(false)

const {
  width: leftWidth,
  startResize,
  isResizing,
} = useResizable({
  initialWidth: 500,
  minWidth: 300,
  maxWidth: () => windowWidth.value - 300,
})

const leftPanelStyle = computed((): CSSProperties => {
  if (isMobile.value) return { width: '100%' }
  if (isLeftPanelCollapsed.value) {
    return { width: '0px', padding: '0px', opacity: '0', pointerEvents: 'none' }
  }
  return { width: `${leftWidth.value}px` }
})

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
  <EditorDialog
    :is-open="isOpen"
    :title="t('ai.mermaidEditorTitle')"
    size="xl"
    @close="closeEditor"
  >
    <!-- 顶栏额外按钮：折叠源码面板 -->
    <template #header-actions>
      <Button
        v-if="!isMobile"
        variant="ghost"
        size="icon"
        class="h-8 w-8 text-muted-foreground hover:bg-muted hover:text-foreground"
        :title="isLeftPanelCollapsed ? t('ai.mermaidExpandSource') : t('ai.mermaidCollapseSource')"
        @click="isLeftPanelCollapsed = !isLeftPanelCollapsed"
      >
        <PanelLeftOpen v-if="isLeftPanelCollapsed" :size="18" />
        <PanelLeftClose v-else :size="18" />
      </Button>
    </template>

    <!-- 主体：分栏 / Tab 布局 -->
    <div class="flex h-full w-full overflow-hidden">
      <!-- Desktop: Split Layout -->
      <div v-if="!isMobile" class="flex h-full w-full overflow-hidden">
        <div
          :style="leftPanelStyle"
          class="flex flex-col overflow-hidden transition-all duration-300 ease-in-out"
          :class="isLeftPanelCollapsed ? 'p-0' : 'p-4'"
        >
          <div class="mb-2 flex items-center justify-between whitespace-nowrap px-1">
            <span class="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              {{ t('ai.mermaidEditorCodeLabel') }}
            </span>
          </div>
          <div class="min-h-0 flex-1 overflow-hidden">
            <MermaidCodeEditor :model-value="code" @update:model-value="updateCode" />
          </div>
        </div>

        <div
          v-if="!isLeftPanelCollapsed"
          class="group relative flex w-1 cursor-ew-resize items-center justify-center bg-border transition-colors hover:bg-primary/50"
          :class="{ 'bg-primary': isResizing }"
          @mousedown="startResize"
        >
          <div class="-left-1 -right-1 absolute inset-y-0 z-10"></div>
          <div class="h-8 w-1 rounded-full bg-border group-hover:bg-primary/50"></div>
        </div>

        <div class="flex min-h-0 flex-1 flex-col overflow-hidden p-4">
          <div class="mb-2 flex items-center justify-between px-1">
            <span class="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              {{ t('ai.mermaidPreviewLabel') }}
            </span>
          </div>
          <div class="min-h-0 flex-1 overflow-hidden">
            <MermaidPreviewPanel :svg-html="svgHtml" :error="error" :is-rendering="isRendering" />
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
          <div class="min-h-0 flex-1 overflow-hidden p-4">
            <TabsContent value="editor" class="m-0 h-full">
              <MermaidCodeEditor :model-value="code" @update:model-value="updateCode" />
            </TabsContent>
            <TabsContent value="preview" class="m-0 h-full">
              <MermaidPreviewPanel :svg-html="svgHtml" :error="error" :is-rendering="isRendering" />
            </TabsContent>
          </div>
        </Tabs>
      </div>
    </div>

    <!-- Footer: 复制操作 -->
    <template #footer>
      <Button variant="outline" size="sm" @click="copySource">
        <Copy :size="14" class="mr-2" />
        {{ t('ai.mermaidCopySource') }}
      </Button>
      <Button variant="outline" size="sm" :disabled="!svgHtml" @click="copySvg">
        <Download :size="14" class="mr-2" />
        {{ t('ai.mermaidCopySvg') }}
      </Button>
    </template>
  </EditorDialog>
</template>
