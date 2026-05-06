<script setup lang="ts">
import { ref, computed } from 'vue'
import { FolderTree, Paperclip, X } from 'lucide-vue-next'
import SessionFileList from './SessionFileList.vue'
import WorkspaceFileTree from './WorkspaceFileTree.vue'
import axios from 'axios'

const props = defineProps<{
  workspacePath: string | null
  sidecarPort: number | null
  sidecarToken: string | null
  collapsed?: boolean
}>()

const activeTab = ref<'session-files' | 'workspace'>('workspace')
const panelWidth = ref(260)
const resizing = ref(false)

// File preview state
const previewFile = ref<{ path: string; name: string } | null>(null)
const previewContent = ref<string | null>(null)
const previewLoading = ref(false)

const tabs = [
  { id: 'workspace' as const, label: '工作区', icon: FolderTree },
  { id: 'session-files' as const, label: '会话文件', icon: Paperclip },
]

const tabsStyle = computed(() => {
  const idx = activeTab.value === 'workspace' ? 0 : 1
  return {
    '--rwp-active-tab-index': String(idx),
    '--rwp-tab-slider-offset': idx === 0 ? '0px' : 'calc(100% + 2px)',
  }
})

// ── Resize ──
function onResizeStart(e: PointerEvent) {
  resizing.value = true
  const startX = e.clientX
  const startWidth = panelWidth.value

  function onMove(ev: PointerEvent) {
    const delta = startX - ev.clientX
    const next = Math.max(180, Math.min(500, startWidth + delta))
    panelWidth.value = next
  }

  function onUp() {
    resizing.value = false
    document.removeEventListener('pointermove', onMove)
    document.removeEventListener('pointerup', onUp)
  }

  document.addEventListener('pointermove', onMove)
  document.addEventListener('pointerup', onUp)
}

// ── File preview ──
function onFileClick(filePath: string, fileName: string) {
  previewFile.value = { path: filePath, name: fileName }
  loadPreview(filePath)
}

async function loadPreview(filePath: string) {
  if (!props.sidecarPort || !props.sidecarToken) return
  previewLoading.value = true
  previewContent.value = null
  try {
    const client = axios.create({
      baseURL: `http://127.0.0.1:${props.sidecarPort}/sidecar`,
      timeout: 5000,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${props.sidecarToken}`,
      },
    })
    const { data } = await client.post('/fs/read', { filePath })
    if (data.success) {
      previewContent.value = data.data.content
    } else {
      previewContent.value = `Error: ${data.message || 'Failed to read file'}`
    }
  } catch (err) {
    previewContent.value = `Error: ${err instanceof Error ? err.message : 'Request failed'}`
  } finally {
    previewLoading.value = false
  }
}

function closePreview() {
  previewFile.value = null
  previewContent.value = null
}
</script>

<template>
  <aside
    class="rwp"
    :class="{ 'rwp--collapsed': collapsed }"
    :style="{ width: collapsed ? '0px' : panelWidth + 'px' }"
  >
    <!-- 拖拽手柄 -->
    <div
      class="rwp-handle"
      :class="{ 'rwp-handle--active': resizing }"
      @pointerdown.prevent="onResizeStart"
    />

    <template v-if="!collapsed">
      <!-- Tab 滑动条 -->
      <div class="rwp-tabs" :style="tabsStyle">
        <div class="rwp-tab-slider" />
        <button
          v-for="tab in tabs"
          :key="tab.id"
          :class="['rwp-tab', { 'rwp-tab--active': activeTab === tab.id }]"
          @click="activeTab = tab.id"
        >
          <component :is="tab.icon" :size="13" />
          <span>{{ tab.label }}</span>
        </button>
      </div>

      <!-- 内容区 -->
      <div class="rwp-body">
        <SessionFileList v-if="activeTab === 'session-files'" />
        <WorkspaceFileTree
          v-else-if="activeTab === 'workspace' && workspacePath"
          :workspace-path="workspacePath"
          :sidecar-port="sidecarPort"
          :sidecar-token="sidecarToken"
          @file-click="onFileClick"
        />
      </div>

      <!-- 文件预览 -->
      <div v-if="previewFile" class="rwp-preview">
        <div class="rwp-preview-header">
          <span class="rwp-preview-name">{{ previewFile.name }}</span>
          <button class="rwp-preview-close" @click="closePreview">
            <X :size="12" />
          </button>
        </div>
        <div class="rwp-preview-body">
          <div v-if="previewLoading" class="rwp-preview-loading">加载中...</div>
          <pre v-else class="rwp-preview-content">{{ previewContent }}</pre>
        </div>
      </div>
    </template>
  </aside>
</template>

<style scoped>
.rwp {
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
  position: relative;
  border-left: 1px solid hsl(var(--border) / 0.2);
  background: hsl(var(--card) / 0.5);
  backdrop-filter: blur(12px);
  overflow: hidden;
  transition: width 0.25s cubic-bezier(0.16, 1, 0.3, 1);
}

.rwp--collapsed {
  border-left-color: transparent;
}

/* ── 拖拽手柄 ── */
.rwp-handle {
  position: absolute;
  left: -3px;
  top: 0;
  bottom: 0;
  width: 7px;
  cursor: col-resize;
  z-index: 10;
  transition: background 0.15s;
}

.rwp-handle:hover,
.rwp-handle--active {
  background: hsl(var(--primary) / 0.2);
}

/* ── Tab 滑动条 ── */
.rwp-tabs {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 2px;
  margin: 8px 8px 0;
  padding: 2px;
  border-radius: 6px;
  background: hsl(var(--muted) / 0.3);
  border: 1px solid hsl(var(--border) / 0.15);
  position: relative;
  flex-shrink: 0;
}

.rwp-tab-slider {
  position: absolute;
  top: 2px;
  bottom: 2px;
  left: 2px;
  z-index: 0;
  width: calc((100% - 6px) / 2);
  border-radius: 4px;
  background: hsl(var(--background));
  box-shadow: 0 1px 3px hsl(var(--foreground) / 0.04);
  transform: translateX(var(--rwp-tab-slider-offset));
  transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.rwp-tab {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  height: 24px;
  border: none;
  border-radius: 4px;
  background: transparent;
  color: hsl(var(--muted-foreground));
  font-size: 0.7rem;
  font-weight: 400;
  cursor: pointer;
  transition: color 0.2s;
}

.rwp-tab--active {
  color: hsl(var(--foreground));
}

/* ── 内容区 ── */
.rwp-body {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
}

/* ── 文件预览 ── */
.rwp-preview {
  display: flex;
  flex-direction: column;
  border-top: 1px solid hsl(var(--border) / 0.25);
  background: hsl(var(--muted) / 0.2);
  max-height: 40%;
  flex-shrink: 0;
}

.rwp-preview-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 5px 10px;
  border-bottom: 1px solid hsl(var(--border) / 0.15);
  flex-shrink: 0;
}

.rwp-preview-name {
  flex: 1;
  font-size: 0.7rem;
  font-weight: 500;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.rwp-preview-close {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  border: none;
  border-radius: 3px;
  background: transparent;
  color: hsl(var(--muted-foreground));
  cursor: pointer;
}

.rwp-preview-close:hover {
  background: hsl(var(--foreground) / 0.06);
}

.rwp-preview-body {
  flex: 1;
  overflow: auto;
  padding: 8px 10px;
}

.rwp-preview-loading {
  font-size: 0.7rem;
  color: hsl(var(--muted-foreground));
}

.rwp-preview-content {
  font-family: ui-monospace, 'Cascadia Code', 'Fira Code', monospace;
  font-size: 0.7rem;
  line-height: 1.45;
  white-space: pre-wrap;
  word-break: break-all;
  margin: 0;
  color: hsl(var(--foreground));
}
</style>
