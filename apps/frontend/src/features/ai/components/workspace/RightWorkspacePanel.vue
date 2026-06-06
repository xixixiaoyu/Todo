<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useRouter } from 'vue-router'
import {
  FolderTree,
  Paperclip,
  ListTodo,
  PanelRightClose,
  PanelRightOpen,
  X,
  List,
  Network,
  Expand,
} from 'lucide-vue-next'
import SessionFileList from './SessionFileList.vue'
import WorkspaceFileTree from './WorkspaceFileTree.vue'
import TodoPanelContent from '@/features/todo/components/TodoPanelContent.vue'
import { useTodoStore } from '@/features/todo/stores/todo'
import { useI18n } from 'vue-i18n'
import axios from 'axios'

const { t } = useI18n()
const todoStore = useTodoStore()
const router = useRouter()

const props = defineProps<{
  workspacePath: string | null
  sidecarPort: number | null
  sidecarToken: string | null
  collapsed?: boolean
  showAgentTabs?: boolean
}>()

const emit = defineEmits<{
  (e: 'toggleCollapse'): void
}>()

const activeTab = ref<'todo' | 'workspace' | 'session-files'>('todo')

function loadPanelWidth(): number {
  try {
    const v = localStorage.getItem('lumina-right-workspace-width')
    return v ? Number(v) : 340
  } catch {
    return 340
  }
}
function savePanelWidth(w: number) {
  try {
    localStorage.setItem('lumina-right-workspace-width', String(w))
  } catch {
    /* ignore */
  }
}

const panelWidth = ref(loadPanelWidth())
const resizing = ref(false)

// File preview state
const previewFile = ref<{ path: string; name: string } | null>(null)
const previewContent = ref<string | null>(null)
const previewLoading = ref(false)

// ── Dynamic tabs ──
const agentTabs = [
  { id: 'workspace' as const, label: '工作区', icon: FolderTree },
  { id: 'session-files' as const, label: '会话文件', icon: Paperclip },
]

const todoTab = computed(() => ({ id: 'todo' as const, label: t('todo.title'), icon: ListTodo }))

// Agent 模式：仅工作区标签；非 Agent 模式：仅 Todo
const tabs = computed(() => {
  if (props.showAgentTabs) {
    return agentTabs
  }
  return [todoTab.value]
})

// Agent 模式切换时重置活动标签
watch(
  () => props.showAgentTabs,
  (val) => {
    if (val) {
      activeTab.value = 'workspace'
    } else {
      activeTab.value = 'todo'
    }
  },
)

// ── Tab slider style (dynamic columns) ──
const tabsStyle = computed(() => {
  const count = tabs.value.length
  const idx = tabs.value.findIndex((t) => t.id === activeTab.value)
  if (count <= 1) return {}
  const gapTotal = (count - 1) * 2
  const paddingTotal = 4
  return {
    '--rwp-tab-count': String(count),
    '--rwp-active-tab-index': String(idx),
    '--rwp-tab-slider-offset': idx === 0 ? '0px' : `calc(${idx} * (100% + 2px) / ${count})`,
    '--rwp-tab-slider-width': `calc((100% - ${gapTotal + paddingTotal}px) / ${count})`,
  }
})

// ── Expose for parent ──
function switchToTodoTab() {
  activeTab.value = 'todo'
}

defineExpose({ switchToTodoTab })

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
    savePanelWidth(panelWidth.value)
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
    :style="{ width: collapsed ? '36px' : panelWidth + 'px' }"
  >
    <!-- 拖拽手柄 -->
    <div
      class="rwp-handle"
      :class="{ 'rwp-handle--active': resizing }"
      @pointerdown.prevent="onResizeStart"
    />

    <!-- 折叠态：仅显示展开按钮 -->
    <template v-if="collapsed">
      <button class="rwp-collapsed-toggle" title="展开面板" @click="emit('toggleCollapse')">
        <PanelRightOpen :size="16" />
      </button>
    </template>

    <template v-else>
      <!-- Tab 滑动条 (multi-tab only) -->
      <div v-if="tabs.length > 1" class="rwp-tabs" :style="tabsStyle">
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

      <!-- 单 Tab 头部 -->
      <div v-else class="rwp-single-header">
        <component :is="todoTab.icon" :size="14" class="rwp-single-header-icon" />
        <span class="rwp-single-header-label">{{ t('todo.title') }}</span>
        <button
          class="rwp-view-toggle-btn"
          :title="todoStore.viewMode === 'list' ? t('todo.visualMode') : t('todo.listMode')"
          :aria-label="todoStore.viewMode === 'list' ? t('todo.visualMode') : t('todo.listMode')"
          @click="todoStore.viewMode = todoStore.viewMode === 'list' ? 'visual' : 'list'"
        >
          <component :is="todoStore.viewMode === 'list' ? Network : List" :size="14" />
        </button>
        <button
          class="rwp-view-toggle-btn"
          title="全屏打开待办"
          aria-label="全屏打开待办"
          @click="router.push('/todo')"
        >
          <Expand :size="14" />
        </button>
        <button class="rwp-collapse-btn" title="折叠面板" @click="emit('toggleCollapse')">
          <PanelRightClose :size="14" />
        </button>
      </div>

      <!-- 多 Tab 模式下的折叠按钮（单 Tab 已内嵌在 header 中） -->
      <button
        v-if="tabs.length > 1"
        class="rwp-collapse-btn"
        style="margin: 4px 8px 0 auto"
        title="折叠面板"
        @click="emit('toggleCollapse')"
      >
        <PanelRightClose :size="14" />
      </button>

      <!-- 内容区 -->
      <div class="rwp-body">
        <TodoPanelContent v-if="activeTab === 'todo'" />
        <SessionFileList v-else-if="activeTab === 'session-files'" />
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
  grid-template-columns: repeat(var(--rwp-tab-count, 2), minmax(0, 1fr));
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
  width: var(--rwp-tab-slider-width, calc((100% - 6px) / 2));
  border-radius: 4px;
  background: hsl(var(--background));
  box-shadow: 0 1px 3px hsl(var(--foreground) / 0.04);
  transform: translateX(var(--rwp-tab-slider-offset, 0px));
  transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

/* ── 单 Tab 头部 ── */
.rwp-single-header {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 10px 10px 6px;
  flex-shrink: 0;
}

.rwp-single-header-icon {
  color: hsl(var(--muted-foreground) / 0.6);
}

.rwp-single-header-label {
  font-size: 0.75rem;
  font-weight: 500;
  color: hsl(var(--foreground) / 0.7);
}

.rwp-view-toggle-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border: none;
  border-radius: 4px;
  background: none;
  color: hsl(var(--muted-foreground) / 0.5);
  cursor: pointer;
  transition: all 0.15s ease;
}

.rwp-view-toggle-btn:hover {
  color: hsl(var(--foreground) / 0.8);
  background: hsl(var(--foreground) / 0.06);
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

  /* Todo 侧边栏优化字号 token（仅在侧边栏上下文生效，不会覆盖弹窗） */
  --todo-font-title: 13px;
  --todo-font-body: 12px;
  --todo-font-meta: 11px;
  --todo-font-caption: 10px;
  --todo-control-primary-height: 40px;
  --todo-control-secondary-height: 32px;
  --todo-segment-height: 38px;
  --todo-item-height: 48px;
  --todo-item-child-height: 40px;
  --todo-radius-soft: 10px;
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

/* ── Collapsed Toggle ── */
.rwp-collapsed-toggle {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 40px;
  border: none;
  background: none;
  color: hsl(var(--muted-foreground) / 0.5);
  cursor: pointer;
  transition: all 0.15s ease;
}

.rwp-collapsed-toggle:hover {
  color: hsl(var(--foreground) / 0.8);
  background: hsl(var(--foreground) / 0.06);
}

/* ── Collapse Button in Header ── */
.rwp-collapse-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  border: none;
  border-radius: 5px;
  background: none;
  color: hsl(var(--muted-foreground) / 0.45);
  cursor: pointer;
  transition: all 0.15s ease;
  margin-left: auto;
}

.rwp-collapse-btn:hover {
  color: hsl(var(--foreground) / 0.8);
  background: hsl(var(--foreground) / 0.06);
}
</style>
