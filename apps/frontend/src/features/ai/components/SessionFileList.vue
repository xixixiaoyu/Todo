<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import { File, FileCode, FileImage, FileArchive, FileText } from 'lucide-vue-next'
import axios from 'axios'

interface SessionFile {
  id: string
  filePath: string
  label: string
  ext: string
  size: number
  createdAt: string
}

const props = defineProps<{
  sessionId: string | null
  backendUrl: string
  authToken: string | null
}>()

const files = ref<SessionFile[]>([])
const loading = ref(false)

function getClient() {
  if (!props.authToken) return null
  return axios.create({
    baseURL: props.backendUrl,
    timeout: 5000,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${props.authToken}` },
  })
}

async function loadFiles() {
  if (!props.sessionId) return
  const client = getClient()
  if (!client) return
  loading.value = true
  try {
    const { data } = await client.get('/api/agent/session-files', {
      params: { sessionId: props.sessionId },
    })
    if (data.success && data.data?.files) files.value = data.data.files
  } catch (err) {
    console.error('[SessionFileList] Failed to load files:', err)
  } finally {
    loading.value = false
  }
}

function fileIcon(ext: string) {
  if (['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg'].includes(ext)) return FileImage
  if (['.zip', '.tar', '.gz', '.7z'].includes(ext)) return FileArchive
  if (['.ts', '.js', '.vue', '.py', '.json', '.css', '.html'].includes(ext)) return FileCode
  if (['.md', '.txt'].includes(ext)) return FileText
  return File
}

function fmtSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)}K`
  return `${(bytes / (1024 * 1024)).toFixed(1)}M`
}

watch(
  () => props.sessionId,
  () => {
    if (props.sessionId) loadFiles()
  },
)
onMounted(() => {
  if (props.sessionId) loadFiles()
})
</script>

<template>
  <div class="sfl">
    <div v-if="loading" class="sfl-status">加载中...</div>

    <div v-else-if="files.length === 0" class="sfl-status">暂无会话文件</div>

    <div v-else class="sfl-list">
      <div v-for="file in files" :key="file.id" class="sfl-row">
        <component :is="fileIcon(file.ext)" :size="14" class="sfl-icon" />
        <span class="sfl-label" :title="file.filePath">{{ file.label }}</span>
        <span v-if="file.size" class="sfl-size">{{ fmtSize(file.size) }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.sfl {
  font-size: 0.74rem;
  user-select: none;
}

.sfl-status {
  padding: 24px 12px;
  font-size: 0.72rem;
  color: hsl(var(--muted-foreground));
  text-align: center;
  line-height: 1.6;
}

.sfl-list {
  padding: 2px 0;
}

.sfl-row {
  display: flex;
  align-items: center;
  gap: 6px;
  height: 28px;
  padding: 0 10px;
  margin: 0 2px;
  border-radius: 4px;
  transition: background 0.1s;
}

.sfl-row:hover {
  background: hsl(var(--foreground) / 0.04);
}

.sfl-icon {
  flex-shrink: 0;
  opacity: 0.45;
}

.sfl-label {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.sfl-size {
  flex-shrink: 0;
  font-size: 0.62rem;
  color: hsl(var(--muted-foreground));
}
</style>
