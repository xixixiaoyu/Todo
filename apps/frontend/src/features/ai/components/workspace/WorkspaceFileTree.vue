<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { ChevronRight, Folder, File } from 'lucide-vue-next'
import axios from 'axios'

interface DirEntry {
  name: string
  type: 'file' | 'directory'
  size: number
}

const props = defineProps<{
  workspacePath: string
  sidecarPort: number | null
  sidecarToken: string | null
  depth?: number
}>()

const depth = props.depth ?? 0
const entries = ref<DirEntry[]>([])
const loading = ref(false)
const error = ref<string | null>(null)
const expandedDirs = ref(new Set<string>())
const selectedName = ref<string | null>(null)

const currentPath = computed(() => props.workspacePath)
const folderName = computed(() => {
  const parts = props.workspacePath.split('/')
  return parts[parts.length - 1] || props.workspacePath
})

function getClient() {
  if (!props.sidecarPort || !props.sidecarToken) return null
  return axios.create({
    baseURL: `http://127.0.0.1:${props.sidecarPort}/sidecar`,
    timeout: 5000,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${props.sidecarToken}` },
  })
}

async function loadDir() {
  const client = getClient()
  if (!client) {
    error.value = 'Sidecar 不可用'
    return
  }
  loading.value = true
  error.value = null
  try {
    const { data } = await client.post('/fs/ls', { dirPath: currentPath.value })
    if (data.success && data.data?.entries) {
      entries.value = [...data.data.entries].sort((a: DirEntry, b: DirEntry) => {
        if (a.type !== b.type) return a.type === 'directory' ? -1 : 1
        return a.name.localeCompare(b.name)
      })
    }
  } catch (err) {
    error.value = err instanceof Error ? err.message : '请求失败'
  } finally {
    loading.value = false
  }
}

function toggleDir(name: string) {
  const next = new Set(expandedDirs.value)
  if (next.has(name)) {
    next.delete(name)
  } else {
    next.add(name)
  }
  expandedDirs.value = next
}

const emit = defineEmits<{
  (e: 'file-click', filePath: string, fileName: string): void
}>()

function selectFile(name: string) {
  selectedName.value = name
  emit('file-click', currentPath.value + '/' + name, name)
}

function fmtSize(bytes: number): string {
  if (!bytes) return ''
  if (bytes < 1024) return `${bytes}B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)}K`
  return `${(bytes / (1024 * 1024)).toFixed(1)}M`
}

onMounted(() => {
  if (props.sidecarPort && props.sidecarToken) loadDir()
})
watch(
  () => props.workspacePath,
  () => {
    expandedDirs.value = new Set()
    loadDir()
  },
)
watch([() => props.sidecarPort, () => props.sidecarToken], ([port, token]) => {
  if (port && token && (error.value || entries.value.length === 0)) loadDir()
})
</script>

<template>
  <div class="wt" :style="{ '--wt-depth': depth }">
    <div v-if="depth === 0" class="wt-cwd">
      <span class="wt-cwd-label">{{ folderName }}</span>
    </div>

    <div v-if="loading" class="wt-status">加载中...</div>
    <div v-else-if="error" class="wt-status wt-status--err">{{ error }}</div>

    <template v-else>
      <template v-for="entry in entries" :key="entry.name">
        <div
          :class="[
            'wt-row',
            entry.type === 'directory' ? 'wt-row--dir' : 'wt-row--file',
            { 'wt-row--selected': selectedName === entry.name },
          ]"
          :style="{
            paddingLeft: depth * 16 + 10 + 'px',
            paddingRight: '10px',
          }"
          @click="entry.type === 'directory' ? toggleDir(entry.name) : selectFile(entry.name)"
        >
          <span
            v-if="entry.type === 'directory'"
            class="wt-chevron"
            :class="{ 'wt-chevron--open': expandedDirs.has(entry.name) }"
          >
            <ChevronRight :size="12" />
          </span>
          <span v-else class="wt-chevron wt-chevron--spacer" />

          <Folder v-if="entry.type === 'directory'" :size="14" class="wt-icon wt-icon--dir" />
          <File v-else :size="14" class="wt-icon wt-icon--file" />

          <span class="wt-name">{{ entry.name }}</span>
          <span v-if="entry.type === 'file' && entry.size" class="wt-size">{{
            fmtSize(entry.size)
          }}</span>
        </div>

        <WorkspaceFileTree
          v-if="entry.type === 'directory' && expandedDirs.has(entry.name)"
          :workspace-path="currentPath + '/' + entry.name"
          :sidecar-port="sidecarPort"
          :sidecar-token="sidecarToken"
          :depth="depth + 1"
          @file-click="(path, name) => emit('file-click', path, name)"
        />
      </template>
    </template>

    <div v-if="!loading && !error && entries.length === 0 && depth === 0" class="wt-status">
      目录为空
    </div>
  </div>
</template>

<style scoped>
.wt {
  user-select: none;
}

.wt-cwd {
  padding: 6px 12px;
  border-bottom: 1px solid hsl(var(--border) / 0.15);
}

.wt-cwd-label {
  font-size: 0.75rem;
  font-weight: 500;
  color: hsl(var(--foreground));
  word-break: break-all;
  line-height: 1.3;
}

.wt-status {
  padding: 16px 12px;
  font-size: 0.7rem;
  color: hsl(var(--muted-foreground));
  text-align: center;
}

.wt-status--err {
  color: hsl(var(--destructive));
}

/* ── 文件行 ── */
.wt-row {
  display: flex;
  align-items: center;
  gap: 5px;
  height: 28px;
  margin: 0 2px;
  border-radius: 4px;
  font-size: 0.74rem;
  color: hsl(var(--foreground));
  cursor: default;
  transition: background 0.1s;
}

.wt-row:hover {
  background: hsl(var(--foreground) / 0.04);
}

.wt-row--selected {
  background: hsl(var(--primary) / 0.1);
}

.wt-row--dir {
  cursor: pointer;
}

/* ── 展开箭头 ── */
.wt-chevron {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 14px;
  flex-shrink: 0;
  opacity: 0.35;
  transition: transform 0.15s;
}

.wt-chevron--open {
  transform: rotate(90deg);
}

.wt-chevron--spacer {
  visibility: hidden;
}

/* ── 图标 ── */
.wt-icon {
  flex-shrink: 0;
  opacity: 0.45;
}

.wt-icon--dir {
  color: hsl(var(--primary));
}

/* ── 文件名 ── */
.wt-name {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* ── 大小 ── */
.wt-size {
  flex-shrink: 0;
  font-size: 0.62rem;
  color: hsl(var(--muted-foreground));
}
</style>
